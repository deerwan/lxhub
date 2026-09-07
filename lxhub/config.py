"""配置加载：默认值 <- config.json <- 环境变量 (GITHUB_TOKEN / LXH_HOST / LXH_PORT / LXH_DB)"""
import json
import os
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

DEFAULTS = {
    "db_path": "data/lxhub.db",
    "host": "127.0.0.1",
    "port": 8787,
    "github_token": "",
    "keywords": ["lx 音源", "洛雪 音源", "lx-music 音源", "lx music 自定义源",
                 "lx-music-source", "lxmusic", "洛雪音乐 音源", "lx source"],
    "seed_repos": ["ZxwyWebSite/lx-source", "lyswhut/lx-music-desktop", "lyswhut/lx-music-mobile"],
    "seed_urls": [],
    "max_repos_per_keyword": 20,
    "max_repos_total": 60,
    "max_files_per_repo": 40,
    "max_file_bytes": 1_500_000,
    "request_timeout": 15,
    "concurrency": 8,
    "check_interval_hours": 12,
    "crawl_interval_hours": 24,
    # 复制链接时可拼接的加速前缀：[{"name":"","prefix":"https://gh1.lhl.one/","hosts":[...]}]
    "mirror_prefixes": [],
    # 是否在前台首页显示「更新」按钮；关闭后只能从 /admin 触发爬取/检测
    "show_update_button": True,
}


@dataclass
class Config:
    db_path: str
    host: str
    port: int
    github_token: str
    keywords: list
    seed_repos: list
    seed_urls: list
    max_repos_per_keyword: int
    max_repos_total: int
    max_files_per_repo: int
    max_file_bytes: int
    request_timeout: float
    concurrency: int
    check_interval_hours: float
    crawl_interval_hours: float
    mirror_prefixes: list
    show_update_button: bool


def _read_dotenv(path: Path) -> dict:
    """极简 .env 解析（KEY=VALUE），不引入额外依赖。

    .env 不进版本库，适合放 GITHUB_TOKEN 这类密钥；解析失败一律忽略。
    """
    out: dict = {}
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return out
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        out[key.strip()] = value.strip().strip("'\"")
    return out


def load_config(path: str | None = None) -> Config:
    data = dict(DEFAULTS)
    p = Path(path) if path else ROOT / "config.json"
    if p.exists():
        try:
            data.update(json.loads(p.read_text(encoding="utf-8")))
        except (json.JSONDecodeError, OSError) as e:
            print(f"[config] 读取 {p} 失败，使用默认配置: {e!r}")
    # 优先级：进程环境变量 > .env > config.json 默认值
    env = dict(os.environ)
    for k, v in _read_dotenv(ROOT / ".env").items():
        env.setdefault(k, v)
    for env_key, cfg_key in (("GITHUB_TOKEN", "github_token"), ("LXH_HOST", "host"),
                             ("LXH_PORT", "port"), ("PORT", "port"), ("LXH_DB", "db_path")):
        if env.get(env_key):
            data[cfg_key] = env[env_key]
    data["port"] = int(data["port"])
    fields = Config.__dataclass_fields__
    return Config(**{k: v for k, v in data.items() if k in fields})
