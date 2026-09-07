"""从音源脚本文本中提取元数据（脚本头 @ 注释）、判定“是否像 lx 音源脚本”、猜测支持的平台。

这些全部是静态文本分析：不执行脚本、不请求任何音乐接口。
"""
import re

# 脚本头注释里常见的 @键 值 写法（中英文键都收）
ANN_RE = re.compile(
    r"@([A-Za-z_\u4e00-\u9fff]+)\s*[=:：]?\s*([^\r\n]+)")

_KEY_MAP = {
    "name": "name", "title": "name", "名称": "name", "名字": "name",
    "version": "version", "版本": "version", "版本号": "version",
    "author": "author", "作者": "author",
    "description": "description", "describe": "description", "描述": "description",
    "说明": "description", "简介": "description",
    "homepage": "homepage", "home": "homepage", "网址": "homepage", "主页": "homepage",
}

_CODE_MAP = {
    "kw": "kw", "kuwo": "kw", "酷我": "kw",
    "wy": "wy", "netease": "wy", "wangyi": "wy", "wangyiyun": "wy", "网易": "wy", "网易云": "wy",
    "kg": "kg", "kugou": "kg", "酷狗": "kg",
    "mg": "mg", "migu": "mg", "咪咕": "mg",
    "tx": "tx", "qq": "tx", "tencent": "tx", "企鹅": "tx",
}


def _clean(value: str) -> str:
    value = value.strip()
    # 去掉注释结尾的 */ 和装饰性星号
    value = value.strip("*/ \t").strip()
    return value[:200]


def parse_annotations(text: str, limit: int = 8000) -> dict:
    meta = {}
    for m in ANN_RE.finditer(text[:limit]):
        key = _KEY_MAP.get(m.group(1).lower()) or _KEY_MAP.get(m.group(1))
        if not key:
            continue
        value = _clean(m.group(2))
        # 值里不该再出现 @（那是下一个键），也不该是模板占位符式的长串
        if not value or "@" in value or len(value) > 150:
            continue
        if value and not meta.get(key):
            meta[key] = value
        if all(meta.get(x) for x in ("name", "version", "author", "description")):
            break
    return meta


def looks_valid(text: str) -> bool:
    """静态特征评分判定“像不像一个可导入的 lx 自定义源脚本”。"""
    if not text:
        return False
    head = text[:600].lower()
    if "<!doctype" in head or "<html" in head:
        return False
    # lx 自定义源跑在无 require 的沙箱里；Node 代码（运行时框架/桥接服务）不是音源
    if "module.exports" in text or len(re.findall(r"\brequire\s*\(", text)) >= 3:
        return False
    score = 0
    if "globalthis.lx" in text.lower():
        score += 2
    if "EVENT_NAMES" in text:
        score += 1
    if re.search(r"EVENT_NAMES\s*\.\s*request|\blx\s*\.\s*on\s*\(", text):
        score += 1
    if "musicUrl" in text:
        score += 2
    if "sources" in text and ("inited" in text or "qualitys" in text):
        score += 1
    if "__lx_native_call__" in text or "lx_setup" in text:
        score -= 3
    return score >= 4


def classify_script(text: str) -> str:
    """对完整脚本文本分类：source / companion / unknown。"""
    if not text:
        return "unknown"
    tl = text.lower()
    if "__lx_native_call__" in text or "lx_setup" in text:
        return "companion"
    if re.search(r"user[\s_-]?api", tl) and "preload" in tl:
        return "companion"
    if re.search(r"json[\s_-]?rpc", tl) or ("stdin" in tl and "stdout" in tl):
        return "companion"
    if "module.exports" in text or len(re.findall(r"\brequire\s*\(", text)) >= 3:
        return "companion"
    if (re.search(r"EVENT_NAMES\s*\.\s*request|EVENT_NAMES\[.request.]", text)
            and "musicUrl" in text):
        return "source"
    if "globalthis.lx" in tl and "musicUrl" in text:
        return "source"
    return "unknown"


# 这些域名是脚本托管/CDN，不是音源的后端 API
_HOST_BLOCK_SUFFIX = (
    "github.com", "github.io", "githubusercontent.com", "jsdelivr.net",
    "gitee.com", "unpkg.com", "npmjs.com", "w3.org", "schema.org",
    "gitmirror.com", "ghproxy.com", "stackoverflow.com", "gnu.org",
)


def extract_api_hosts(text: str, limit: int = 6) -> list:
    """提取脚本里声明的后端域名（含裸域名与 URL host），用于存活探测。"""
    if not text:
        return []
    hosts = []

    def add(h: str):
        h = h.lower().rstrip(".")
        if (h and "." in h and len(h) <= 60
                and not h.endswith(_HOST_BLOCK_SUFFIX)
                and not h.startswith(("127.", "0.0.0.", "192.168.", "10."))
                and h not in hosts):
            hosts.append(h)

    for m in re.finditer(r"https?://([A-Za-z0-9._-]+)", text):
        add(m.group(1))
    # 引号中的裸域名，如 domains: { primary: 'yy.zddyr.top' }；末段必须是字母 TLD，
    # 排除 '1.1.0' 这类版本号
    for m in re.finditer(
            r"['\"]([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)*\.[a-z]{2,12})['\"]",
            text, re.I):
        cand = m.group(1)
        # 排除明显的文件名/路径片段
        if re.search(r"\.(js|json|css|png|jpe?g|gif|svg|woff2?|ttf|md|txt|html?)$", cand, re.I):
            continue
        add(cand)
    return hosts[:limit]


def detect_platforms(text: str) -> list:
    """数词频猜平台，只做展示用途（UI 上标注为“疑似支持”）。"""
    if not text:
        return []
    low = text.lower()[:200_000]
    found = set()
    for token, code in _CODE_MAP.items():
        pattern = re.escape(token) if token.isascii() else token
        if len(re.findall(rf"(?<![A-Za-z]){pattern}(?![A-Za-z])", low)) >= 2:
            found.add(code)
    return sorted(found)
