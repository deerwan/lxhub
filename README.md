# LX Source Hub · lx 音源链接聚合（自部署）

从 GitHub 等公开渠道**发现并整理**洛雪音乐（lx-music）自定义音源脚本的发布链接，
定期检查链接可达性，并在一个 Web 页面中展示，方便复制导入。

## 定位与边界（重要）

本项目**只做三件事**：

1. 发现公开仓库/页面中发布的音源脚本直链（`.js`）；
2. 记录元数据（名称、版本、作者等，全部来自脚本头部注释的静态解析）；
3. 定期检查链接是否仍可下载、脚本文本是否具备 lx 音源特征（`globalThis.lx` 等静态特征）。

本项目**不做**：不存储/解析/提供任何音乐内容；不执行音源脚本；不请求任何音乐接口，
**不验证**音源能否获取平台付费歌曲。音源脚本本身的内容、合法性与使用风险由使用者自行承担。

## 文档

| 文档 | 内容 |
|---|---|
| [快速开始](docs/getting-started.md) | 安装、首次爬取、启动服务、命令行 |
| [配置 GitHub Token](docs/github-token.md) | **建议优先看**——不配置会严重限制收录量 |
| [配置说明](docs/configuration.md) | `config.json` 全部字段与环境变量 |
| [脚本类型](docs/script-types.md) | 音源 / 配套脚本 / 存疑 的判定依据 |
| [加速前缀](docs/mirror-prefix.md) | 复制链接时自动拼接镜像前缀 |
| [部署方式](docs/deployment.md) | Docker Compose / GitHub Pages 静态托管 |
| [工作原理](docs/how-it-works.md) | 发现 → 收集 → 判定 的完整流程 |
| [API](docs/api.md) | 接口列表 |
| [常见问题](docs/faq.md) | 收录少、链接失效、静态模式等问题 |
