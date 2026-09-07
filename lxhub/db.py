"""SQLite 存储层：线程级持久连接 + 写锁，WAL 模式。"""
import datetime as dt
import json
import sqlite3
import threading
from pathlib import Path

class _Conn:
    """单实例持久连接（线程安全读、写锁保护）。"""
    def __init__(self, path: str):
        self.conn = sqlite3.connect(path, timeout=30)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.execute("PRAGMA synchronous=NORMAL")


_LOCK = threading.Lock()


SCHEMA = """
CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT UNIQUE NOT NULL,
    name TEXT DEFAULT '',
    version TEXT DEFAULT '',
    author TEXT DEFAULT '',
    description TEXT DEFAULT '',
    homepage TEXT DEFAULT '',
    platforms TEXT DEFAULT '[]',
    origin_repo TEXT DEFAULT '',
    origin_url TEXT DEFAULT '',
    origin_kind TEXT DEFAULT '',
    file_size INTEGER DEFAULT 0,
    sha256 TEXT DEFAULT '',
    http_status INTEGER DEFAULT 0,
    is_alive INTEGER DEFAULT 0,
    looks_valid INTEGER DEFAULT 0,
    script_type TEXT DEFAULT '',
    api_hosts TEXT DEFAULT '[]',
    api_alive TEXT DEFAULT '',
    api_checked TEXT DEFAULT '',
    content_text TEXT DEFAULT '',
    first_seen TEXT DEFAULT '',
    last_checked TEXT DEFAULT '',
    last_alive TEXT DEFAULT '',
    content_updated_at TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_sources_alive ON sources(is_alive, looks_valid);
CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT DEFAULT '',
    detail TEXT DEFAULT ''
);
"""

_INSERT_COLS = [
    "url", "name", "version", "author", "description", "homepage", "platforms",
    "origin_repo", "origin_url", "origin_kind", "file_size", "sha256",
    "http_status", "is_alive", "looks_valid", "script_type",
    "api_hosts", "api_alive", "api_checked", "content_text",
    "first_seen", "last_checked", "last_alive", "content_updated_at",
]

_UPSERT_SQL = f"""
INSERT INTO sources ({", ".join(_INSERT_COLS)})
VALUES ({", ".join("?" * len(_INSERT_COLS))})
ON CONFLICT(url) DO UPDATE SET
    name=excluded.name,
    version=excluded.version,
    author=excluded.author,
    description=excluded.description,
    homepage=excluded.homepage,
    platforms=excluded.platforms,
    origin_repo=CASE WHEN excluded.origin_repo != '' THEN excluded.origin_repo ELSE sources.origin_repo END,
    origin_url=CASE WHEN excluded.origin_url != '' THEN excluded.origin_url ELSE sources.origin_url END,
    origin_kind=CASE WHEN excluded.origin_kind != '' THEN excluded.origin_kind ELSE sources.origin_kind END,
    file_size=excluded.file_size,
    sha256=excluded.sha256,
    http_status=excluded.http_status,
    is_alive=excluded.is_alive,
    looks_valid=excluded.looks_valid,
    script_type=excluded.script_type,
    api_hosts=CASE WHEN excluded.is_alive = 1 THEN excluded.api_hosts ELSE sources.api_hosts END,
    api_alive=excluded.api_alive,
    api_checked=excluded.api_checked,
    content_text=CASE WHEN excluded.content_text != '' THEN excluded.content_text ELSE sources.content_text END,
    content_updated_at=CASE
        WHEN excluded.sha256 != '' AND sources.sha256 != '' AND excluded.sha256 != sources.sha256
            THEN excluded.last_checked
        WHEN sources.content_updated_at != '' THEN sources.content_updated_at
        ELSE sources.first_seen END,
    last_checked=excluded.last_checked,
    last_alive=CASE WHEN excluded.is_alive = 1 THEN excluded.last_alive ELSE sources.last_alive END
"""

_DEFAULTS = {
    "name": "", "version": "", "author": "", "description": "", "homepage": "",
    "platforms": "[]", "origin_repo": "", "origin_url": "", "origin_kind": "",
    "file_size": 0, "sha256": "", "http_status": 0, "is_alive": 0,
    "looks_valid": 0, "script_type": "", "api_hosts": "[]", "api_alive": "",
    "api_checked": "", "content_text": "", "first_seen": "",
    "last_checked": "", "last_alive": "", "content_updated_at": "",
}


class DB:
    def __init__(self, path: str):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.path = str(path)
        self._c = _Conn(path)
        self._migrate(self._c.conn)
        self._c.conn.commit()

    @staticmethod
    def _migrate(conn: sqlite3.Connection):
        """确保所有表存在并补全新列（旧库迁移）。"""
        tables = {r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
        if "sources" not in tables:
            conn.execute("""
                CREATE TABLE sources (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    url TEXT UNIQUE NOT NULL,
                    name TEXT DEFAULT '',
                    version TEXT DEFAULT '',
                    author TEXT DEFAULT '',
                    description TEXT DEFAULT '',
                    homepage TEXT DEFAULT '',
                    platforms TEXT DEFAULT '[]',
                    origin_repo TEXT DEFAULT '',
                    origin_url TEXT DEFAULT '',
                    origin_kind TEXT DEFAULT '',
                    file_size INTEGER DEFAULT 0,
                    sha256 TEXT DEFAULT '',
                    http_status INTEGER DEFAULT 0,
                    is_alive INTEGER DEFAULT 0,
                    looks_valid INTEGER DEFAULT 0,
                    script_type TEXT DEFAULT '',
                    api_hosts TEXT DEFAULT '[]',
                    api_alive TEXT DEFAULT '',
                    api_checked TEXT DEFAULT '',
                    content_text TEXT DEFAULT '',
                    first_seen TEXT DEFAULT '',
                    last_checked TEXT DEFAULT '',
                    last_alive TEXT DEFAULT '',
                    content_updated_at TEXT DEFAULT ''
                )""")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_sources_alive ON sources(is_alive, looks_valid)")
        if "runs" not in tables:
            conn.execute("""
                CREATE TABLE runs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    kind TEXT NOT NULL,
                    started_at TEXT NOT NULL,
                    finished_at TEXT DEFAULT '',
                    detail TEXT DEFAULT ''
                )""")
        cols = {r[1] for r in conn.execute("PRAGMA table_info(sources)")}
        for col, ddl in (
                ("script_type", "TEXT DEFAULT ''"),
                ("api_hosts", "TEXT DEFAULT '[]'"),
                ("api_alive", "TEXT DEFAULT ''"),
                ("api_checked", "TEXT DEFAULT ''"),
                ("content_updated_at", "TEXT DEFAULT ''")):
            if col not in cols:
                try:
                    conn.execute(f"ALTER TABLE sources ADD COLUMN {col} {ddl}")
                    if col == "content_updated_at":
                        conn.execute(
                            "UPDATE sources SET content_updated_at = first_seen "
                            "WHERE content_updated_at = '' OR content_updated_at IS NULL")
                except sqlite3.OperationalError:
                    pass

    def _run(self, sql: str, params: tuple = ()) -> list:
        with _LOCK:
            cur = self._c.conn.execute(sql, params)
            self._c.conn.commit()
            return cur.fetchall()

    # ---------- sources ----------

    def upsert_source(self, d: dict):
        row = dict(_DEFAULTS)
        for k in _DEFAULTS:
            if d.get(k) is not None:
                row[k] = d[k]
        row["url"] = d["url"]
        if not row.get("content_updated_at"):
            row["content_updated_at"] = row.get("first_seen") or ""
        if isinstance(row.get("platforms"), list):
            row["platforms"] = json.dumps(row["platforms"], ensure_ascii=False)
        params = tuple(row[c] for c in _INSERT_COLS)
        self._run(_UPSERT_SQL, params)

    def _to_source_dict(self, r: sqlite3.Row, with_content: bool = False) -> dict:
        d = dict(r)
        # 旧库文件里可能还留着已废弃的标注列，统一不对外输出
        d.pop("user_mark", None)
        d.pop("marked_at", None)
        try:
            d["platforms"] = json.loads(d.get("platforms") or "[]")
        except json.JSONDecodeError:
            d["platforms"] = []
        d["is_alive"] = bool(d["is_alive"])
        d["looks_valid"] = bool(d["looks_valid"])
        if not with_content:
            d.pop("content_text", None)
        return d

    def list_sources(self, valid_only: bool = False, limit: int = 5000) -> list:
        sql = "SELECT * FROM sources"
        if valid_only:
            sql += " WHERE looks_valid = 1"
        sql += " ORDER BY is_alive DESC, looks_valid DESC, last_alive DESC, first_seen DESC LIMIT ?"
        rows = [self._to_source_dict(r) for r in self._run(sql, (limit,))]
        # 同内容多仓库镜像合并：保留一条主记录，其余记入 mirrors
        merged: list = []
        by_hash: dict = {}
        for d in rows:
            key = d["sha256"] or f"url:{d['id']}"
            if key in by_hash:
                by_hash[key]["mirrors"].append(d["url"])
            else:
                d["mirrors"] = []
                by_hash[key] = d
                merged.append(d)
        return merged

    def all_sources_rows(self, limit: int = 100_000, with_content: bool = False) -> list:
        """全部原始行（不合并镜像），供复检使用。

        list_sources() 会把相同 sha256 的镜像合并掉，复检若只用它就会漏掉镜像
        URL——主记录失效时无法感知镜像是否仍可用。因此复检必须遍历每一行。
        with_content=True 时一并返回完整脚本内容（用于打包导出）。
        """
        rows = self._run("SELECT * FROM sources ORDER BY last_checked ASC LIMIT ?", (limit,))
        return [self._to_source_dict(r, with_content=with_content) for r in rows]

    def get_source(self, sid: int) -> dict | None:
        rows = self._run("SELECT * FROM sources WHERE id = ?", (sid,))
        return self._to_source_dict(rows[0], with_content=True) if rows else None

    def all_urls(self) -> set:
        return {r["url"] for r in self._run("SELECT url FROM sources")}

    def stale_sources(self, hours: float) -> list:
        rows = self._run("SELECT id, url FROM sources ORDER BY last_checked ASC LIMIT 500")
        return [dict(r) for r in rows]  # 过滤逻辑交给调用方按时间判断，这里全量给

    def update_check(self, sid: int, status: int, alive: bool, size: int,
                     sha256: str, checked_at: str):
        self._run(
            """UPDATE sources SET
                 http_status = ?,
                 is_alive = ?,
                 file_size = CASE WHEN ? > 0 THEN ? ELSE file_size END,
                 sha256 = CASE WHEN ? != '' THEN ? ELSE sha256 END,
                 content_updated_at = CASE
                     WHEN ? != '' AND sha256 != '' AND ? != sha256 THEN ?
                     WHEN content_updated_at != '' THEN content_updated_at
                     ELSE ? END,
                 last_checked = ?,
                 last_alive = CASE WHEN ? = 1 THEN ? ELSE last_alive END
               WHERE id = ?""",
            (status, 1 if alive else 0,
             size, size,
             sha256, sha256,
             sha256, sha256, checked_at, checked_at,
             checked_at,
             1 if alive else 0, checked_at,
             sid))

    def delete_url(self, url: str):
        self._run("DELETE FROM sources WHERE url = ?", (url,))

    def delete_urls(self, urls: list):
        with _LOCK:
            self._c.conn.executemany("DELETE FROM sources WHERE url = ?",
                                     [(u,) for u in urls])
            self._c.conn.commit()

    def prune_invalid(self, older_than: str) -> int:
        """删除非音源记录；失效音源保留到 older_than（ISO 时间）之后。

        - 能正常下载但不是音源脚本（普通 js）→ 立即删除
        - 曾是音源、现在下载失败 → 宽限期内保留展示"失效"，过期删除
        """
        with _LOCK:
            cur = self._c.conn.execute(
                """DELETE FROM sources WHERE looks_valid = 0 AND (
                     is_alive = 1 OR last_alive = '' OR last_alive < ?)""",
                (older_than,))
            self._c.conn.commit()
            return cur.rowcount

    def update_api_probe(self, sid: int, alive: str, checked_at: str):
        self._run("UPDATE sources SET api_alive = ?, api_checked = ? WHERE id = ?",
                  (alive, checked_at, sid))

    def stats(self) -> dict:
        rows = self._run(
            """SELECT COUNT(*) AS total,
                      COALESCE(SUM(is_alive), 0) AS alive,
                      COALESCE(SUM(looks_valid), 0) AS valid,
                      COALESCE(SUM(CASE WHEN looks_valid = 1 AND is_alive = 1 THEN 1 ELSE 0 END), 0) AS valid_alive
               FROM sources""")
        d = dict(rows[0])
        return {k: int(v) for k, v in d.items()}

    def export(self, mirror_prefixes: list | None = None) -> dict:
        """导出全量数据。

        mirror_prefixes 会随数据一起下发，静态模式（GitHub Pages）的前端
        依赖它渲染「加速前缀」开关。
        """
        return {
            "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
            "stats": self.stats(),
            "sources": self.list_sources(limit=100_000),
            "mirror_prefixes": mirror_prefixes or [],
        }

    # ---------- runs ----------

    def new_run(self, kind: str, started_at: str) -> int:
        with _LOCK:
            cur = self._c.conn.execute(
                "INSERT INTO runs (kind, started_at) VALUES (?, ?)",
                (kind, started_at))
            self._c.conn.commit()
            return cur.lastrowid

    def finish_run(self, run_id: int, finished_at: str, detail: str = ""):
        self._run("UPDATE runs SET finished_at = ?, detail = ? WHERE id = ?",
                  (finished_at, detail, run_id))

    def last_run(self, kind: str) -> dict | None:
        rows = self._run(
            "SELECT * FROM runs WHERE kind = ? ORDER BY id DESC LIMIT 1", (kind,))
        return dict(rows[0]) if rows else None
