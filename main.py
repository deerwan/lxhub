"""CLI 入口：

  python main.py serve [--host H] [--port P]   启动 Web 服务（内置定时任务）
  python main.py crawl [--export FILE]         手动爬取一次
  python main.py check                         手动复检一次可用性
  python main.py export [--out FILE]           导出 JSON
"""
import argparse
import asyncio
import json
import sys
from pathlib import Path

from lxhub.config import load_config
from lxhub.db import DB


def main():
    ap = argparse.ArgumentParser(prog="lxhub", description="lx 音源链接聚合工具（自部署）")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_serve = sub.add_parser("serve", help="启动 Web 服务")
    p_serve.add_argument("--host")
    p_serve.add_argument("--port", type=int)

    p_crawl = sub.add_parser("crawl", help="手动爬取一次")
    p_crawl.add_argument("--export", help="爬取完成后导出 JSON 到指定文件")

    sub.add_parser("check", help="手动复检一次可用性")

    p_exp = sub.add_parser("export", help="导出 JSON")
    p_exp.add_argument("--out", default="export.json")

    args = ap.parse_args()
    cfg = load_config()
    db = DB(cfg.db_path)

    if args.cmd == "serve":
        import uvicorn
        from lxhub.server import app
        uvicorn.run(app, host=args.host or cfg.host, port=args.port or cfg.port,
                    log_level="info")
    elif args.cmd == "crawl":
        from lxhub.discover import run_crawl
        asyncio.run(run_crawl(cfg, db))
        if args.export:
            Path(args.export).write_text(
                json.dumps(db.export(cfg.mirror_prefixes), ensure_ascii=False, indent=1),
                encoding="utf-8")
            print(f"[导出] {args.export}")
    elif args.cmd == "check":
        from lxhub.checker import run_check
        asyncio.run(run_check(cfg, db))
    elif args.cmd == "export":
        Path(args.out).write_text(
            json.dumps(db.export(cfg.mirror_prefixes), ensure_ascii=False, indent=1),
            encoding="utf-8")
        print(f"[导出] {args.out}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
