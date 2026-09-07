# 工作原理

[← 返回 README](../README.md)

```
发现仓库                 收集候选链接                逐个抓取 + 静态解析           展示
┌──────────────────┐   ┌───────────────────────┐   ┌──────────────────────┐   ┌─────────┐
│ GitHub 搜索 API   │   │ README 中的 .js 直链    │   │ HTTP 状态 / 大小 / 哈希 │   │ FastAPI │
│ 搜索页 HTML 兜底   │ → │ GitHub trees API 列文件  │ → │ @注释元数据            │ → │ SQLite  │
│ 种子仓库 + 一跳扩展 │   │ jsDelivr 兜底 + 种子直链 │   │ lx 脚本静态特征         │   │ 静态页   │
└──────────────────┘   └───────────────────────┘   └──────────────────────┘   └─────────┘
```

## 发现仓库

按优先级，全部失败时仍有种子仓库兜底：

1. GitHub 搜索 API（配置 Token 后稳定；未配置也会尝试）
2. `github.com` 搜索结果页 HTML 解析（免配额，但可能被 429）
3. `config.json` 里的种子仓库 + 种子仓库 README 中的一跳引用扩展

## 收集候选链接

- README 里的绝对 / 相对 `.js` 链接 → 转 `raw.githubusercontent.com` 直链
- **GitHub git trees API 列全量文件**（覆盖最全，需 Token 保障配额）
- 拿不到时降级 jsDelivr data API（免配额，但对没有 release 的仓库列不出文件）

应用内部路径（`src/main/`、`android/`、`node_modules/` 等）会被跳过。

## 判定与解析

- 「疑似音源脚本」= 文本中包含 `globalThis.lx` / `EVENT_NAMES` / `lx.on(` 等自定义源 API 特征，
  且不是 Node 代码（运行时框架、桥接服务会被排除）；
  **非音源的候选（普通 js）不会入库**；真音源失效后保留 7 天宽限期再清除，方便看到"失效"状态；
- 「可用」= 该 URL 当前能以 HTTP 2xx 下载到文件；SHA256 用于发现脚本内容更新，
  相同内容的仓库镜像自动合并为一条主记录（`mirrors` 字段）；
- 复检**覆盖每一个 URL**（含镜像，不只是主记录）。主记录失效时，存活的镜像会自动
  顶替为新主记录（列表按 `is_alive DESC` 排序），失效的原链接退回 `mirrors`，
  因此不会出现「还有可用副本却显示失效」的误判；
- 「后端状态」= 从脚本里提取其声明的后端 API 域名并探测存活（仅测服务器是否响应，
  **不调用任何取歌接口**）；所有后端均不可达时标「后端·挂」，该源大概率已不可用；
- 平台标签（酷我 / 网易云等）来自词频猜测，仅供展示参考。

## 为什么用 trees API 而不是 jsDelivr

实测对比（同一仓库的 js 文件数）：

| 仓库 | jsDelivr | GitHub trees API |
|---|---|---|
| `Macrohard0001/lx-ikun-music-sources` | 0 | 969 |
| `guoyue2010/lxmusic-` | 0 | 274 |

jsDelivr 依赖仓库有 release / tag，而多数音源仓库不打 tag，导致整库被跳过。
trees API 不依赖 release，但要消耗核心 API 配额，因此需要 Token——这也是
[配置 Token](github-token.md) 能显著提升收录量的原因。

## 代码结构

```
main.py              CLI 入口：serve / crawl / check / export
lxhub/
  config.py          配置：默认值 <- config.json <- .env <- 环境变量
  discover.py        发现仓库 → 收集 .js 候选 → 抓取静态解析 → 入库
  fetcher.py         httpx 封装：流式限大小 GET、后端域名存活探测
  metadata.py        @注释元数据、音源特征评分、类型分类、平台猜测
  checker.py         复检链接存活 + 后端探测
  db.py              SQLite 存储 + 镜像合并 + 失效清理
  progress.py        任务进度 / 日志环形缓冲 / 取消标记
  server.py          FastAPI 路由 + 内置定时调度器
```
