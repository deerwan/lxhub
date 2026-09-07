"""统一的 HTTP 抓取工具：共享 AsyncClient + 带大小上限的流式 GET。"""
import asyncio
import httpx

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) lx-source-hub/0.1")


def new_client(timeout: float = 15.0) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        follow_redirects=True,
        timeout=timeout,
        headers={"User-Agent": UA, "Accept": "*/*"},
    )


async def fetch_limited(client: httpx.AsyncClient, url: str, max_bytes: int) -> dict:
    """GET 并最多读 max_bytes 字节。网络错误时 status=0，不抛异常。"""
    try:
        async with client.stream("GET", url) as r:
            if r.status_code >= 400:
                return {"status": r.status_code, "content": b"", "truncated": False,
                        "content_type": "", "error": None}
            buf = bytearray()
            truncated = False
            async for chunk in r.aiter_bytes(65536):
                buf.extend(chunk)
                if len(buf) >= max_bytes:
                    truncated = True
                    break
            return {"status": r.status_code, "content": bytes(buf), "truncated": truncated,
                    "content_type": r.headers.get("content-type", ""), "error": None}
    except httpx.HTTPError as e:
        return {"status": 0, "content": b"", "truncated": False,
                "content_type": "", "error": repr(e)}


def decode_bytes(b: bytes) -> str:
    try:
        return b.decode("utf-8")
    except UnicodeDecodeError:
        try:
            return b.decode("gbk", "ignore")
        except Exception:
            return b.decode("utf-8", "ignore")


async def probe_host(client: httpx.AsyncClient, host: str) -> bool:
    """探测一台后端服务器是否存活：仅请求站点根路径，任何 HTTP 响应都算活。"""
    for scheme in ("https", "http"):
        try:
            await client.get(f"{scheme}://{host}/", timeout=6)
            return True
        except httpx.HTTPError:
            continue
    return False


async def probe_hosts(client: httpx.AsyncClient, hosts: list) -> bool:
    """任一后端存活即视为可用（有主/备域名时只挂一个还能用）。"""
    if not hosts:
        return False
    results = await asyncio.gather(
        *(probe_host(client, h) for h in hosts),
        return_exceptions=True
    )
    return any(r is True for r in results if isinstance(r, bool))
