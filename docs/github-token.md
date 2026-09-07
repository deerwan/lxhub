# 配置 GitHub Token

[← 返回 README](../README.md)

## 为什么需要

发现阶段要调用 GitHub 搜索 API，配额差别很大：

| | 未配置 Token | 配置 Token 后 |
|---|---|---|
| 搜索 API | 10 次/分钟（按 IP 计） | 30 次/分钟 |
| 核心 API | 60 次/小时（按 IP 计） | 5000 次/小时 |

未配置时极易触发限流，日志里出现 `[搜索] API 403`，本次爬取会直接跳过后续关键词，
只能靠搜索页 HTML 兜底和种子仓库，能发现的仓库数量大幅减少——这也是"爬出来只有几条"的主因。

> **Token 也用于列文件树**（GitHub trees API，计入核心 API 配额）。
> 未配置时核心 API 只有 60 次/小时，扫几十个仓库就耗尽并降级到 jsDelivr，
> 而 jsDelivr 对没有 release 的仓库列不出文件——实测会漏掉大量音源仓库。
> 只有「下载脚本文件」走 `raw.githubusercontent.com`，不消耗 API 配额。

## 创建 Token

1. 登录 GitHub，右上角头像 → **Settings**
2. 左侧最下方 → **Developer settings**
3. **Personal access tokens** → **Tokens (classic)** → **Generate new token (classic)**
4. 按如下填写：
   - **Note**：随意，例如 `lxhub`
   - **Expiration**：建议 **90 days**（到期前 GitHub 会发邮件提醒）
   - **Select scopes**：**一个都不要勾**
5. 拉到页面底部点 **Generate token**
6. **立刻复制**生成的 `ghp_` 开头字符串——**关掉页面后就再也看不到了**，只能重新生成

> **关于权限**：本项目只读取**公开**仓库、只搜索**公开**仓库，不需要任何 scope。
> 经典 Token 不勾选 scope 时默认具备公开仓库只读权限，这已是最小权限，多勾无益。
> 若你更习惯 Fine-grained token，勾选 **Public Repositories (read-only)** 即可。

## 配置方式

优先级：**进程环境变量 > `.env` 文件 > `config.json`**。

### 方式 A：`.env` 文件（推荐）

仓库已提供模板，复制后填入真实值：

```bash
cp .env.example .env
# 编辑 .env：GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

`.env` 已被 `.gitignore` 忽略：既能持久生效（每次启动自动读取，不用重复 export），
又不会进版本库。仓库里只提交不含真实值的 `.env.example`。

### 方式 B：临时环境变量

仅当前终端生效，适合临时验证：

```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
.venv/bin/python main.py serve
```

### 方式 C：写进 config.json

```json
{ "github_token": "ghp_xxxxxxxxxxxxxxxxxxxx" }
```

> ⚠️ **不推荐**：`config.json` **没有**被 `.gitignore` 忽略（Docker 构建需要 `COPY` 它）。
> 一旦把 Token 填进去，`git add .` 就会把它提交并推送到远程，等于公开泄露。
> 若确实要填，提交前务必确认该字段为空。**请优先用方式 A。**

### 方式 D：Docker Compose

`docker-compose.yml` 会读取宿主机的 `.env` 或环境变量：

```bash
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx docker compose up -d --build
```

### 方式 E：GitHub Actions

无需任何配置。`.github/workflows/scheduled-crawl.yml` 直接使用仓库自动注入的
`secrets.GITHUB_TOKEN`，配额问题自动解除。

## 验证是否生效

```bash
.venv/bin/python main.py crawl 2>&1 | head -30
```

| 现象 | 含义 |
|---|---|
| `[搜索] API 命中 N 个仓库`（N 通常 20+） | Token 生效 |
| `[搜索] API 403`（未配置 GITHUB_TOKEN，配额受限） | 未生效，请求仍是匿名的 |
| 直接跳到 `[搜索] HTML 兜底命中` | 搜索 API 失败，正在降级 |

## Token 泄露了怎么办

Token 等同于密码，拿到它的人可以操作你有权限的仓库。

1. GitHub → **Settings** → **Developer settings** → **Personal access tokens**
2. 找到对应 Token → **Delete**（或 **Regenerate**）
3. 如果已经 `git push` 过，**删文件没有用**——必须**先吊销 Token**
4. 已推送到公开仓库的内容应视为**已泄露**，不要抱侥幸心理
