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
    "update_url": "update_url", "updateurl": "update_url", "更新地址": "update_url",
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
        if all(meta.get(x) for x in ("name", "version", "author", "description",
                                     "update_url")):
            break
    return meta


# ---------- 混淆脚本识别 ----------
# javascript-obfuscator 产物特征：_0x 十六进制标识符、长 \x 转义串。
# 混淆会把 musicUrl / EVENT_NAMES 等字面量藏进字符串表，词面匹配全部失效，
# 只能改信脚本头部的明文 @ 注释（混淆源几乎都保留可读头，便于用户辨识）。
_OBF_ID = re.compile(r"\b_0x[a-f0-9]{4,}\b")
_HEX_ESC = re.compile(r"(?:\\x[0-9a-fA-F]{2}){6,}")


def is_obfuscated(text: str, sample: int = 20_000) -> bool:
    head = text[:sample]
    return len(_OBF_ID.findall(head)) >= 10 or len(_HEX_ESC.findall(head)) >= 3


# 事件注册骨架：lx 自定义源必须订阅 request 事件才能工作，写法有
# on(EVENT_NAMES.request / on(globalThis.lx.EVENT_NAMES.request /
# on(EVENT_NAMES['request'] / on('request' 等，点号/方括号访问、任意
# 长度的对象链前缀都要兼容（混淆前的小型混淆器只藏部分字面量）。
_EVT_REG = re.compile(
    r"\bon\s*\(\s*(?:[A-Za-z_$][\w$]*\s*\.\s*)*EVENT_NAMES"
    r"\s*(?:\.\s*request|\[\s*['\"]request['\"]\s*\])"
    r"|\bon\s*\(\s*['\"]request['\"]\s*,")

# musicUrl 的两种形态：actions 里定义 getMusicUrl 方法，或在 request
# 分发处匹配 'musicUrl' action 字符串（switch case / === 比较都算）。
_MUSIC_URL_ACT = re.compile(r"['\"]musicUrl['\"]")


def valid_tier(text: str) -> str:
    """结构化置信分级：confirmed / probable / ''（不收录）。

    只靠 "globalThis.lx + musicUrl" 词面共现凑分会误收仓库里的模板/脚手架文件，
    改为要求真实音源的注册结构：
      - confirmed：订阅 request 事件 + 应答 musicUrl（方法名或 action 字符串）
      - probable ：仅订阅 request 事件，或混淆脚本（字面量不可信，改凭明文
                   头注释 @name + @version/@update_url 识别）
      - ''       ：无任何结构特征，不再收录（前端也不必展示）
    """
    if not text:
        return ""
    head = text[:600].lower()
    if "<!doctype" in head or "<html" in head:
        return ""
    # lx 自定义源跑在无 require 的沙箱里；Node 代码（运行时框架/桥接服务）不是音源
    if "module.exports" in text or len(re.findall(r"\brequire\s*\(", text)) >= 3:
        return ""
    if _EVT_REG.search(text):
        if "getMusicUrl" in text or _MUSIC_URL_ACT.search(text):
            return "confirmed"
        return "probable"
    if is_obfuscated(text):
        meta = parse_annotations(text)
        if meta.get("name") and (meta.get("version") or meta.get("update_url")):
            return "probable"
    return ""


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
    if _EVT_REG.search(text) and "musicUrl" in text:
        return "source"
    if "globalthis.lx" in tl and "musicUrl" in text:
        return "source"
    # 混淆脚本：musicUrl 等字面量被藏进字符串表，改信明文头注释
    if is_obfuscated(text):
        meta = parse_annotations(text)
        if meta.get("name") and (meta.get("version") or meta.get("update_url")):
            return "source"
    return "unknown"


# 这些域名是脚本托管/CDN，不是音源的后端 API
_HOST_BLOCK_SUFFIX = (
    "github.com", "github.io", "githubusercontent.com", "jsdelivr.net",
    "gitee.com", "unpkg.com", "npmjs.com", "w3.org", "schema.org",
    "gitmirror.com", "ghproxy.com", "stackoverflow.com", "gnu.org",
)

# 私网/保留段（与 probe 沙箱 assertPublicHost 口径对齐）：
# 127./8、10./8、0./8、192.168./16、172.16-31、169.254 链路本地
_PRIVATE_V4 = re.compile(
    r"^(127\.|10\.|0\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)")


def extract_api_hosts(text: str, limit: int = 6) -> list:
    """提取脚本里声明的后端域名（含裸域名与 URL host），用于存活探测。"""
    if not text:
        return []
    hosts = []

    def add(h: str):
        h = h.lower().rstrip(".")
        if (h and "." in h and len(h) <= 60
                and not h.endswith(_HOST_BLOCK_SUFFIX)
                and not _PRIVATE_V4.match(h)
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
