# 沙箱实测（probe）

[← 返回 README](../README.md)

「收录 + 链接可达性检查」无法回答最关键的问题：**这个音源脚本现在还能不能真正取到歌？**
沙箱实测（probe）把收录的脚本放进隔离环境的沙箱里真实调用一次取歌接口，回答这个问题。

## 功能边界

- 只测**固定测试歌曲**（128k 可听级起步），目的是验证脚本可用性，不是验证高端音质的账号/付费可用性；
- 脚本运行在 node 原生 `vm` 沙箱 + 模拟的 `lx` 全局环境中（每次探测使用独立子进程，结束即销毁）；
- 请求侧有 **DNS 解析防护（禁私网地址）**，可配置 `probe.allow_private` 放行本网段后端；
- 不修改、不落地脚本音频以外的任何文件；结果只写数据库（probe_* 列）。

## 状态语义

| probe_status | 含义 |
|---|---|
| `usable` | 至少一个平台返回了真实音频链接，并通过 Range/指纹校验 |
| `degraded` | 脚本加载成功（inited 完成），但所有平台取歌失败 |
| `not-loadable` | 脚本执行报错、超时或未正确调用 `lx.on(EVENT_NAMES.request, ...)` |

除状态外，每平台都会附上失败原因（如「GD 接口状态 403」），以及 `deep` 模式下的音质核验结论。

## 开启方式（推荐：后台设置）

**方式一 · 后台管理页（推荐）**：「配置管理 → 沙箱实测」，开关与全部参数（定时周期、
每轮上限、deep 核验、并发、缓存时长、Node 路径等）均可在页面修改，保存即生效、
无需重启，设置持久化在 `data/config.override.json`。

**方式二 · config.json**（等效，适合容器编排等场景）：

```json
{
  "probe": {
    "enabled": false,
    "node": "node",
    "interval_hours": 24,
    "concurrency": 2,
    "max_per_run": 20,
    "refresh_hours": 72,
    "deep": false,
    "qualities": ["flac", "flac24bit"],
    "timeout": 60
  }
}
```

| 字段 | 默认值 | 说明 |
|---|---|---|
| `enabled` | `false` | **默认关闭**。开启后：定时任务每 `interval_hours` 跑一轮，复检任务收尾也会自动补测更新的/未测过的音源。手动触发（按钮/CLI `--yes`）不受此开关限制 |
| `interval_hours` | `24` | 定时实测周期（小时），`0` = 不定时，仅手动/检测后补测 |
| `node` | `"node"` | Node 可执行文件（≥ 20），也可以写绝对路径 |
| `concurrency` | `2` | 并行 probe 子进程数 |
| `max_per_run` | `20` | 每轮（或手动点一次）最多探测多少条，避免流量被拖爆 |
| `refresh_hours` | `72` | cache 命中后多久强行重测一次 |
| `deep` | `false` | 是否进 L2 音质核验（对声明 flac/flac24bit 的平台逐一重新取链核实） |
| `qualities` | `["flac", "flac24bit"]` | deep 模式核验的音质清单 |
| `timeout` | `60` | 单条脚本的总预算（秒），超时按 `not-loadable` 处理 |

## 深入：L1 / L2 两级判定

1. **L1 存活探测（默认）**：按脚本声明的平台（wy/tx/kw/kg/mg）逐一以 128k 试听固定测试歌曲，
   对返回的地址发 `Range: bytes=0-16383` 请求并按魔数判断是否为真实音频
   （mp3 / flac / ogg / m4a / id3 前缀），通过即 `usable`。
2. **L2 音质核验（`deep=true`）**：对 L1 通过的平台，逐一声称音质重新取链，
   读出容器真实参数（FLAC STREAMINFO 的采样率/位深/总样本；mp3 帧头），
   得出 `matched / degraded / mismatch / refused / unknown` 结论。

> 观察到的小坑（也是 deep 模式会标出的）：部分后端会对 flac 试听直接返回加密改写头
> （STREAMINFO 的时长和文件长度对不上），或直接拒绝（如 kw 的 403/444 响应、
> kg 的"歌曲不存在"）。这些都会在详情弹层逐行显示。

## 使用方式

- 后台：「配置管理 → 沙箱实测」完成后点「立即实测一轮」；概览页也有「沙箱实测」按钮。
- 定时：开启 `enabled` 并设置 `interval_hours` 后，服务内置调度器会周期触发
  （0 = 关闭定时）；同一时刻只允许一个任务在跑（爬取/复检/实测互斥）。
- CLI：
  ```bash
  .venv/bin/python main.py probe --yes          # 手动补测（绕过 enabled 开关）
  .venv/bin/python main.py probe --deep         # 补测 + L2 音质核验
  .venv/bin/python main.py probe --limit 5 --deep
  ```
- 常规复检是自动衔接：`check` 任务结束后（`enabled` 时）对「内容 hash 变化、
  未测、缓存过期」的条目统一排队补测。
- 前端展示请在「音源管理」/「首页」查看红绿灯列（实测可用/实测降级/实测失败），
  详情弹层有逐平台的失败原因与耗时明细。

## 什么情况下不启用？

- 部署环境没有 Node ≥ 20。官方 Docker 镜像已内置 Node（构建阶段同源拷贝），
  Docker Compose / Railway 等部署开箱即用；**源码裸机部署**（`python main.py serve`）
  需自行安装 Node ≥20，否则即便在后台打开开关，实测也会整轮跳过（不落库、
  不会误判音源失效），`/api/status` 的 `probe_capability` 会报告 `node-not-found`，
  前端「沙箱实测」按钮随之置灰；
- 不希望给测试歌曲发起任何取歌请求（流量/隐私顾虑）；
- 只关心链接是否还能下载到脚本本体。

probe 是**可选项**，关闭时 lxhub 仍然是一个纯静态收录工具（行为与老版本一致）。
