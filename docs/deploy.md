# 部署说明

本项目是 FastAPI + SQLite 的自部署应用，内置后台定时爬取/复检任务。以下提供三种部署方式。

## 0. 准备工作（必看）

- **密钥**：复制 `.env.example` 为 `.env`，填入 `GITHUB_TOKEN`。`.env` 已被 `.gitignore` 忽略，不会进版本库。

  ```bash
  cp .env.example .env
  # 编辑 .env，填入你的 token
  ```

- **数据持久化**：SQLite 数据库在 `data/lxhub.db`，部署时务必挂载/持久化该目录，否则重启丢数据。
- **GitHub Token**：用于提高 API 配额、访问私有种子仓库。留空也能跑，但额度低、易限流。

## 1. Docker / docker-compose（自托管 VPS、云服务器）

前置：已安装 Docker 与 docker compose。

```bash
cp .env.example .env        # 填入 GITHUB_TOKEN
docker compose up -d --build
```

- 访问 `http://<服务器IP>:8787`
- 容器已设 `LXH_HOST=0.0.0.0`，对外可访问；端口 `8787`（可用 `LXH_PORT` 改）。
- `./data` 已挂载持久化。
- 后台定时爬取默认开启（启动后按 `crawl_interval_hours` / `check_interval_hours` 自动跑）。
  首次建议点页面「爬取」按钮，或进容器执行 `python main.py crawl` 立即填充数据。
- 生产建议：用 Nginx / Caddy 反代并加 HTTPS，勿裸奔公网。

## 2. Railway（连接 GitHub 私人仓库，自动部署）

Railway 支持从私有仓库拉取代码并基于 `Dockerfile` 自动部署。

1. New Project → Deploy from GitHub repo → 选择本私有仓库（首次需授权）。
2. 环境变量（Variables）中添加：
   - `GITHUB_TOKEN` = 你的 token
   - `PORT` 由 Railway 自动注入，本项目已支持读取（无需手填；若手填以平台为准）
3. 持久化：Railway 容器重启可能清空文件系统，需在 Railway 设置中添加 Volume，挂载路径 `/app/data`（与 `LXH_DB` 默认一致）。
4. 部署完成后 Railway 分配 `*.railway.app` 公网域名，任何人可访问。

> 说明：`Dockerfile` 的启动命令只固定 `--host 0.0.0.0`，端口交给环境变量 `PORT` / `LXH_PORT`，
> 因此 Railway 注入的 `PORT` 会自动生效，无需改代码。

## 3. 只读静态展示（GitHub Pages，可选）

若只想展示列表、不需要下载 / 导出 / 后台爬取：

```bash
python main.py export --out export.json   # 生成数据快照
```

启用仓库的 GitHub Pages（私有仓库的页面仅协作者可见），将 `index.html` 与 `export.json` 作为静态站点托管。

限制：下载按钮、导出 ZIP、爬取等依赖后端的功能均不可用；页面为生成时的快照、不会自动更新。

## 4. 注意事项

- **切勿把真实 `GITHUB_TOKEN` 提交进仓库**（即便是私有仓库）。只用 `.env` 或平台 Secrets。
  特别注意：`config.json` 目前被 git 跟踪，如果在其 `github_token` 字段填了真实 token 并提交，会泄露到仓库历史（协作者可见、撤销困难）。请始终保持 `config.json` 里的 token 为空，真实 token 只放 `.env` 或部署平台的 Secrets / 环境变量（`config.py` 已支持 `GITHUB_TOKEN` 环境变量覆盖，优先级最高）。
- 后台爬取持续消耗 GitHub API 配额；有效 token 可显著提升上限。
- 公网暴露务必加 HTTPS 反代；token 仅存服务端，不暴露给前端。
- 数据库文件 `data/lxhub.db` 需持久化卷，否则容器 / 实例重启数据归零。

## 5. 发版与镜像部署（GitHub Actions）

仓库已带两个工作流：

- `.github/workflows/scheduled-crawl.yml`：每日 UTC 01:00 自动爬取并生成 `export.json`、发布 GitHub Pages 静态站。爬取使用的是 Actions 自动注入的 `GITHUB_TOKEN`（短期、仅本仓库 scope），**不需要你提供 PAT**。
- `.github/workflows/release.yml`：打 `v*` tag 后自动构建多架构（amd64/arm64）Docker 镜像、推送到 GitHub Container Registry (`ghcr.io/deerwan/lxhub`)，并创建 GitHub Release（自动生成变更说明）。

发版流程：

```bash
git tag v1.0.0
git push origin v1.0.0      # 触发 release.yml：构建镜像 + 发布 Release
```

镜像默认私有（与仓库可见性一致）。拉取 / 部署：

```bash
docker pull ghcr.io/deerwan/lxhub:latest
# 或在 docker-compose 里把 image 直接换成 ghcr.io/deerwan/lxhub:latest
```

> 推送镜像使用的是 Actions 自带的 `GITHUB_TOKEN`（已在本工作流授予 `packages: write`），无需你配置任何 secret，天然短期、scope 受限。
>
> 若你希望镜像对外公开，需在 GitHub 的 Packages 设置里把该镜像设为 Public（或把仓库本身设为 Public）。

## 6. 网页后台管理（拉镜像即用的配置方式）

不想改 `config.json`、也不想准备 `.env`？直接用网页后台：部署后打开网页 → 点「后台」（未登录会跳到 `/login`，如 `https://你的域名/login`）→ 输入账户名与密码登录 → 自动进入 `/admin` 后台（在线填写 GitHub Token / 关键词 / 种子仓库 / 爬取参数，并一键触发爬取、复检）。所有修改即时生效、持久化到数据卷（`data/config.override.json`），重启不丢。直接访问 `/admin` 而未登录会被重定向到 `/login`。

启用后台需要**账户名 + 密码**两个环境变量（缺密码则后台不启用），账户名默认 `admin`、可改：

```bash
# docker run 传入
docker run -e GITHUB_TOKEN=ghp_xxx \
  -e LXH_ADMIN_USER=admin -e LXH_ADMIN_PASS=你的后台密码 \
  -p 8787:8787 -v lxdata:/app/data ghcr.io/deerwan/lxhub:latest

# 或 docker-compose.yml 的 environment 里加两行：
#   - LXH_ADMIN_USER=admin          # 后台账户名（默认 admin，可改）
#   - LXH_ADMIN_PASS=你的后台密码    # 后台密码（务必设置，否则后台不启用）
```

**本地 / 非容器部署**：不必每次 `export`，直接写进项目根目录的 `.env` 即可，
效果与上面完全等价（进程环境变量优先级更高，不会被 `.env` 覆盖）：

```bash
# .env（该文件已被 .gitignore 忽略）
GITHUB_TOKEN=ghp_xxx
LXH_ADMIN_USER=admin
LXH_ADMIN_PASS=你的后台密码
```

行为说明：
- **未设置 `LXH_ADMIN_PASS`**：网页后台接口返回 403，但 `/api/crawl`、`/api/check` 等保持公开（兼容「不设密码也能跑」的极简部署）。
- **已设置**：后台所有写操作（含触发爬取/复检）都需要先登录（`账户名 + 密码`）拿 Bearer token，账户名或密码任一不符均返回 401。
- 登录会话有效期 8 小时，存于浏览器 localStorage。
- `github_token` 也可在后台填写，但会明文存入数据卷的 `config.override.json`；若在意，仍建议用 `GITHUB_TOKEN` 环境变量注入、后台留空。
