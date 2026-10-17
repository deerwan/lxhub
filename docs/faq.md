# 常见问题

[← 返回 README](../README.md)

## 爬取结果很少？

大概率是 GitHub 搜索 API 被限流（日志出现 `[搜索] API 403`）。
按 [配置 GitHub Token](github-token.md) 配好 Token 后重跑，通常能从个位数涨到几十条。

若已配置 Token 仍然很少，检查日志中是否出现大量 `[爬取] xxx: 候选链接 0 个`——
说明文件树获取失败并降级到了 jsDelivr，排查见 [工作原理](how-it-works.md)。
也可适当调大 `max_repos_total` / `max_repos_per_keyword`，见 [配置](configuration.md)。

## 某条链接显示失效？

「可用性」只代表脚本文件当前可下载；脚本内部的第三方接口是否正常，本工具不检测。

## 想去掉某些仓库？

编辑 `config.json` 的 `seed_repos` / `keywords`，数据库可直接删除 `data/lxhub.db` 重建。

## 导入后搜不到歌？

默认的静态检查**不执行脚本**，只保证链接可下载、文本具备音源特征。
想知道"现在还能不能取到歌"，可开启可选的[沙箱实测](probe.md)——
固定测试歌曲逐平台走一遍真实取歌链路，把"实测可用 / 降级 / 失败"与
失败原因直接标在列表里；音源能否正常工作最终仍取决于其后端第三方接口的现状。

## 沙箱实测按钮/列都是"未实测"？

`probe.enabled` 默认是 `false`（避免误发起取歌流量）。开启方式（二选一）：
1. 后台页「配置管理 → 沙箱实测」打开「启用沙箱实测」并可顺带设置定时周期（推荐）；
2. 或直接在 `config.json` / `data/config.override.json` 加 `"probe": { "enabled": true }`。

前提确认本机装有 Node ≥ 20（`node -v`）。手动点「沙箱实测」按钮或
`python main.py probe --yes` 不受该开关限制。

## 静态模式下按钮是灰的？

正常现象。GitHub Pages 静态站没有后端，页面回退读取 `export.json`，
爬取 / 复检按钮会禁用，数据由 GitHub Actions 定时更新。
