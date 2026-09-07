"""FastAPI 服务：API + 静态页面 + 内置定时任务（爬取/复检）。"""
import asyncio
import datetime as dt
import io
import json
import os
import re
import secrets
import time
import zipfile
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import quote, urlparse

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from . import checker, discover
from .config import load_config
from .db import DB
from .progress import Progress

cfg = load_config()
db = DB(cfg.db_path)
STATIC_DIR = Path(__file__).resolve().parent / "static"

# ---------- HTML 静态资源缓存治理 ----------
# HTML 里对 js/css 的引用带上文件 mtime 作为版本号（?v=...），
# 文件一变 URL 就变，浏览器自然会拉新版本，不必手动改版本号。
# HTML 本身回 no-cache，保证每次都能拿到引用了新 URL 的页面。
_HTML_CACHE: dict[str, str] = {}


def _load_html(name: str) -> str:
    html = (STATIC_DIR / name).read_text(encoding="utf-8")

    def _repl(m: re.Match) -> str:
        path = m.group(1)
        try:
            ver = int((STATIC_DIR / path).stat().st_mtime)
        except OSError:
            ver = 0
        return f"/static/{path}?v={ver}"

    return re.sub(r"/static/([\w./-]+\.(?:js|css))", _repl, html)


def _html(name: str) -> Response:
    if name not in _HTML_CACHE:
        try:
            _HTML_CACHE[name] = _load_html(name)
        except OSError:
            return Response("页面缺失", status_code=500)
    return Response(_HTML_CACHE[name], media_type="text/html; charset=utf-8",
                    headers={"Cache-Control": "no-cache"})

# ---------- 后台管理（可选，由环境变量 LXH_ADMIN_USER / LXH_ADMIN_PASS 启用） ----------
ADMIN_USER = os.environ.get("LXH_ADMIN_USER", "admin")
ADMIN_PASS = os.environ.get("LXH_ADMIN_PASS", "")
SESSIONS: dict = {}
SESSION_TTL = 8 * 3600
OVERRIDE_PATH = Path(cfg.db_path).resolve().parent / "config.override.json"

def _to_bool(v):
    """把前端传来的 true/false/"true"/"1"/"on" 等统一转成 bool。"""
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return bool(v)
    s = str(v).strip().lower()
    if s in ("true", "1", "yes", "on"):
        return True
    if s in ("false", "0", "no", "off", ""):
        return False
    raise ValueError("必须是 true/false")


# 网页后台可编辑的字段（github_token 亦可在此填写，但会明文落盘到数据卷）
EDITABLE = {
    "github_token": str,
    "keywords": list,
    "seed_repos": list,
    "seed_urls": list,
    "max_repos_per_keyword": int,
    "max_repos_total": int,
    "max_files_per_repo": int,
    "max_file_bytes": int,
    "request_timeout": float,
    "concurrency": int,
    "check_interval_hours": float,
    "crawl_interval_hours": float,
    "mirror_prefixes": list,
    "show_update_button": _to_bool,
}

# 后台表单只填一个 URL，不填生效域名时的默认值：
# 本项目收录的链接均来自 GitHub，加速前缀也只对这些镜像站有意义，
# 不兜底的话前缀会被拼到任何链接上（万一混入非 GitHub 链接就打不开了）。
DEFAULT_MIRROR_HOSTS = ("github.com", "githubusercontent.com", "github.io")


def _norm_mirror(v):
    """归一化一条加速前缀。

    后台只填 URL（字符串）即可；name 从域名推导，hosts 缺省用 DEFAULT_MIRROR_HOSTS。
    需要自定义 hosts 的场景直接改 config.json。
    """
    if isinstance(v, str):
        p = v.strip()
        if not p:
            raise ValueError("不能为空")
        explicit_hosts = None
    elif isinstance(v, dict):
        p = str(v.get("prefix") or "").strip()
        if not p:
            raise ValueError("缺少 prefix 字段")
        explicit_hosts = [str(h).strip() for h in (v.get("hosts") or []) if str(h).strip()]
    else:
        raise ValueError("必须是 URL 字符串或对象")
    if "://" not in p and not p.endswith("="):
        # 只填了域名（如 gh1.lhl.one）时补全协议，否则拼出来的是无效相对路径
        p = "https://" + p
    if not p.endswith(("/", "=")):
        p += "/"
    name = str(v.get("name") or "") if isinstance(v, dict) else ""
    if not name:
        name = urlparse(p).netloc or p
    hosts = DEFAULT_MIRROR_HOSTS if explicit_hosts is None else explicit_hosts
    return {"name": name, "prefix": p, "hosts": list(hosts)}


def _save_overrides(data: dict):
    """把变更**合并**进既有 override 文件。

    必须合并而非覆盖：后台可能只提交部分字段，整体覆盖会清掉其余已保存配置
    （曾导致只改一个开关就把 github_token 等全部抹掉）。
    """
    try:
        cur: dict = {}
        try:
            cur = json.loads(OVERRIDE_PATH.read_text(encoding="utf-8"))
            if not isinstance(cur, dict):
                cur = {}
        except (OSError, json.JSONDecodeError):
            cur = {}
        cur.update(data)
        OVERRIDE_PATH.parent.mkdir(parents=True, exist_ok=True)
        OVERRIDE_PATH.write_text(json.dumps(cur, ensure_ascii=False, indent=1), encoding="utf-8")
    except OSError as e:
        print(f"[admin] 保存配置失败: {e!r}")

def _load_overrides():
    try:
        data = json.loads(OVERRIDE_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return
    for k, v in data.items():
        if k in EDITABLE:
            try:
                setattr(cfg, k, v)
            except Exception:
                pass

def _clean_sessions():
    now = time.time()
    expired = [t for t, e in SESSIONS.items() if e < now]
    for t in expired:
        del SESSIONS[t]

def _check_admin(req: Request):
    """未设置 LXH_ADMIN_PASS 时放行（保持默认部署的公开触发行为）；
    设置后则要求 Bearer token，否则 401。"""
    if not ADMIN_PASS:
        return
    auth = req.headers.get("Authorization", "")
    token = auth[7:] if auth.lower().startswith("bearer ") else ""
    _clean_sessions()
    if not token or SESSIONS.get(token, 0) < time.time():
        raise HTTPException(401, "未登录或会话已过期")

_load_overrides()

def _base_name(url: str) -> str:
    name = (url or "").rstrip("/").split("/")[-1]
    return name or "source"


def _safe_filename(name: str) -> str:
    name = (name or "source").strip()
    name = re.sub(r'[\\/:*?"<>|\x00-\x1f]', "_", name).strip(". ")
    return name[:80] or "source"


STATE = {"busy": None}  # None | "crawl" | "check"
PROGRESS: Progress | None = None


def _hours_since(iso: str) -> float:
    if not iso:
        return 1e9
    try:
        t = dt.datetime.fromisoformat(iso)
    except ValueError:
        return 1e9
    if t.tzinfo is None:
        t = t.replace(tzinfo=dt.timezone.utc)
    return (dt.datetime.now(dt.timezone.utc) - t).total_seconds() / 3600


async def _run_task(kind: str):
    global PROGRESS
    if STATE["busy"]:
        return
    STATE["busy"] = kind
    PROGRESS = Progress(kind)

    def _log(msg: str):
        print(msg)
        PROGRESS.log(msg)

    try:
        if kind == "crawl":
            await discover.run_crawl(cfg, db, log=_log, progress=PROGRESS)
        else:
            await checker.run_check(cfg, db, log=_log, progress=PROGRESS)
    except Exception as e:
        print(f"[任务] {kind} 失败: {e!r}")
        PROGRESS.log(f"任务失败: {e!r}")
    finally:
        PROGRESS.finished_at = time.time()
        STATE["busy"] = None


async def _scheduler():
    """每 15 分钟醒来检查一次是否到了爬取/复检的时间。"""
    while True:
        await asyncio.sleep(900)
        try:
            if STATE["busy"]:
                continue
            crawl_run = db.last_run("crawl")
            if crawl_run and not crawl_run["finished_at"] and _hours_since(crawl_run["started_at"]) < 6:
                pass  # 上次爬取疑似未结束，等它
            elif not crawl_run or _hours_since(crawl_run["finished_at"] or crawl_run["started_at"]) >= cfg.crawl_interval_hours:
                await _run_task("crawl")
                continue
            check_run = db.last_run("check")
            if not check_run or _hours_since(check_run["finished_at"] or check_run["started_at"]) >= cfg.check_interval_hours:
                await _run_task("check")
        except Exception as e:
            print(f"[定时器] {e!r}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(_scheduler())
    yield
    task.cancel()


app = FastAPI(title="LX Source Hub", lifespan=lifespan)


@app.get("/")
async def index():
    return _html("index.html")


@app.get("/admin")
async def admin_page():
    return _html("admin.html")


@app.get("/login")
async def login_page():
    return _html("admin.html")


@app.get("/healthz")
async def healthz():
    return {"ok": True}


@app.get("/api/sources")
async def api_sources():
    return {"sources": db.list_sources(), "mirror_prefixes": cfg.mirror_prefixes}


@app.get("/api/sources/{sid}")
async def api_source_detail(sid: int):
    row = db.get_source(sid)
    if not row:
        raise HTTPException(404, "not found")
    return row


@app.get("/api/status")
async def api_status():
    return {
        "busy": STATE["busy"],
        "stats": db.stats(),
        "last_crawl": db.last_run("crawl"),
        "last_check": db.last_run("check"),
        "show_update": cfg.show_update_button,
    }


@app.get("/api/progress")
async def api_progress():
    if PROGRESS is None:
        return {"running": False, "kind": None}
    return PROGRESS.snapshot()


@app.post("/api/cancel")
async def api_cancel(req: Request):
    _check_admin(req)
    if not STATE["busy"]:
        raise HTTPException(409, "没有进行中的任务")
    if PROGRESS is not None:
        PROGRESS.cancelled = True
    return {"ok": True}


@app.post("/api/crawl")
async def api_crawl(req: Request):
    _check_admin(req)
    if STATE["busy"]:
        raise HTTPException(409, f"任务进行中: {STATE['busy']}")
    asyncio.create_task(_run_task("crawl"))
    return {"started": True}


@app.post("/api/check")
async def api_check(req: Request):
    _check_admin(req)
    if STATE["busy"]:
        raise HTTPException(409, f"任务进行中: {STATE['busy']}")
    asyncio.create_task(_run_task("check"))
    return {"started": True}


@app.get("/export.json")
async def export_json():
    return JSONResponse(db.export(cfg.mirror_prefixes))


@app.get("/api/sources/{sid}/download")
async def api_download(sid: int):
    """下载单个音源脚本（完整内容，来自数据库中保存的 content_text）。"""
    row = db.get_source(sid)
    if not row:
        raise HTTPException(404, "not found")
    content = (row.get("content_text") or "").strip()
    if not content:
        raise HTTPException(404, "该记录没有可下载的脚本内容")
    filename = _safe_filename(row.get("name") or _base_name(row["url"])) + ".js"
    return Response(
        content.encode("utf-8"),
        media_type="text/javascript; charset=utf-8",
        headers={
            "Content-Disposition":
                f"attachment; filename=\"{_ascii_fallback(filename)}\"; "
                f"filename*=UTF-8''{quote(filename)}"
        },
    )


@app.get("/api/export/zip")
async def api_export_zip(ids: str = ""):
    """将（筛选后）音源脚本打包成一个 ZIP 下载。ids 为空则导出全部。"""
    rows = db.all_sources_rows(with_content=True)
    if ids:
        want = {int(x) for x in ids.split(",") if x.strip().isdigit()}
        if want:
            rows = [r for r in rows if r["id"] in want]
    buf = io.BytesIO()
    seen: set = set()
    written = 0
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for r in rows:
            content = (r.get("content_text") or "").strip()
            if not content:
                continue
            base = _safe_filename(r.get("name") or _base_name(r["url"]))
            fname = f"{base}.js"
            n = 1
            while fname in seen:
                fname = f"{base}_{n}.js"
                n += 1
            seen.add(fname)
            z.writestr(fname, content.encode("utf-8"))
            written += 1
    if written == 0:
        raise HTTPException(404, "没有可下载的脚本内容")
    buf.seek(0)
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")
    return Response(
        buf.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=\"lx-sources-{stamp}.zip\""},
    )


@app.post("/api/admin/login")
async def admin_login(req: Request):
    if not ADMIN_PASS:
        raise HTTPException(403, "后台未启用：请在环境变量设置 LXH_ADMIN_USER / LXH_ADMIN_PASS 启用网页后台")
    try:
        body = await req.json()
    except Exception:
        body = {}
    if not isinstance(body, dict):
        raise HTTPException(400, "请求体必须是 JSON 对象")
    user = (body.get("username") or "").strip()
    passwd = (body.get("password") or "").strip()
    if user != ADMIN_USER or passwd != ADMIN_PASS:
        raise HTTPException(401, "账户名或密码错误")
    token = secrets.token_hex(24)
    SESSIONS[token] = time.time() + SESSION_TTL
    return {"token": token, "expires_in": SESSION_TTL}


@app.post("/api/admin/logout")
async def admin_logout(req: Request):
    auth = req.headers.get("Authorization", "")
    token = auth[7:] if auth.lower().startswith("bearer ") else ""
    SESSIONS.pop(token, None)
    return {"ok": True}


@app.get("/api/admin/config")
async def admin_get(req: Request):
    _check_admin(req)
    data = {k: getattr(cfg, k) for k in EDITABLE}
    # 不回传真实 token：否则打开后台点一下保存，环境变量里的 token 就会被明文写进数据卷
    data["github_token"] = ""
    return {
        "config": data,
        "github_token_set": bool(cfg.github_token),
        "admin_enabled": True,
    }


@app.post("/api/admin/config")
async def admin_set(req: Request):
    _check_admin(req)
    try:
        partial = await req.json()
    except Exception:
        raise HTTPException(400, "请求体不是合法 JSON")
    if not isinstance(partial, dict):
        raise HTTPException(400, "请求体必须是对象")
    applied = {}
    for k, cast in EDITABLE.items():
        if k not in partial:
            continue
        v = partial[k]
        try:
            if cast is list:
                if not isinstance(v, list):
                    raise ValueError("必须是数组")
                applied[k] = v
            else:
                applied[k] = cast(v)
        except (ValueError, TypeError) as e:
            raise HTTPException(400, f"字段 {k} 无效: {e}")
    if "mirror_prefixes" in applied:
        try:
            applied["mirror_prefixes"] = [_norm_mirror(x) for x in applied["mirror_prefixes"]]
        except ValueError as e:
            raise HTTPException(400, f"字段 mirror_prefixes 无效: {e}")
    for k, v in applied.items():
        setattr(cfg, k, v)
    _save_overrides(applied)
    return {"ok": True, "applied": list(applied.keys())}


def _ascii_fallback(name: str) -> str:
    """给不支持 RFC 5987 filename* 的旧客户端一个纯 ASCII 兜底文件名。"""
    return re.sub(r"[^\x20-\x7e]", "_", name) or "source.js"


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
