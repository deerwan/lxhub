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
    # 与 config.json 保持一致（config.json 存在时以其为准）
    "keywords": ["lx 音源", "洛雪 音源", "lx-music 音源", "lx music 自定义源",
                 "lxmusic", "洛雪音乐 音源", "lx音乐源", "洛雪音乐 源",
                 "lx 源脚本", "洛雪音源js"],
    "seed_repos": ["ZxwyWebSite/lx-source"],
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


# 允许在 .env 中设置的键（进程环境变量优先级更高，不会被 .env 覆盖）
ENV_KEYS = ("GITHUB_TOKEN", "LXH_HOST", "LXH_PORT", "PORT", "LXH_DB",
            "LXH_ADMIN_USER", "LXH_ADMIN_PASS")


def load_dotenv(path: Path | None = None) -> None:
    """把 .env 里的键合并进 os.environ（不覆盖已有的进程环境变量）。

    必须写进 os.environ 而非只返回 dict：server.py 等模块在导入时直接用
    os.environ.get() 读取 LXH_ADMIN_USER / LXH_ADMIN_PASS 这类不进 Config 的字段，
    只靠 load_config 的返回值是读不到的。
    """
    for k, v in _read_dotenv(Path(path) if path else ROOT / ".env").items():
        if k in ENV_KEYS and v:
            os.environ.setdefault(k, v)


# 在 config 模块导入时就注入，保证后续任何 os.environ.get 都能读到 .env 的值
load_dotenv()


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
