# API

[← 返回 README](../README.md)

| 端点 | 说明 |
|---|---|
| `GET /api/sources` | 全量列表（不含脚本文本） |
| `GET /api/sources/{id}` | 详情（含脚本头预览） |
| `GET /api/status` | 统计 + 最近任务 |
| `GET /api/progress` | 当前任务进度（阶段、计数、实时日志，每秒轮询） |
| `POST /api/crawl` / `POST /api/check` | 触发爬取 / 复检 |
| `POST /api/cancel` | 取消当前任务（协作式停止） |
| `GET /export.json` | 导出 |

## 说明

- `/api/sources` 会一并返回 `mirror_prefixes`，供前端渲染「加速前缀」开关；
- 列表接口**不含**脚本文本，仅在 `/api/sources/{id}` 详情中返回前 6000 字符预览；
- 任务进行中时，`/api/crawl` 和 `/api/check` 会返回 `409`；
- `/export.json` 供静态模式（GitHub Pages）读取，结构与上述列表一致。
