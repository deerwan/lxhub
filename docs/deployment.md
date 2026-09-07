# 部署方式

[← 返回 README](../README.md)

## 方式 A：本机 / 自己的服务器（推荐起步）

```bash
docker compose up -d --build     # 数据持久化在 ./data，端口 8787
# 或不用 Docker：.venv/bin/python main.py serve --host 0.0.0.0
```

记得先配置 Token，见 [配置 GitHub Token](github-token.md)。Docker Compose 会读取宿主机的 `.env`。

## 方式 B：GitHub Actions 定时爬取 + 静态托管（零服务器）

仓库已带 `.github/workflows/scheduled-crawl.yml`：每天定时执行爬取，
生成 `export.json` 提交回仓库，并把「静态版页面 + export.json」发布到 GitHub Pages。

启用步骤：把项目推到自己的 GitHub 仓库 → Settings → Pages → Source 选 **GitHub Actions** →
手动 Run 一次 `scheduled-crawl` 工作流验证。

纯静态模式下页面自动回退读取 `export.json`（爬取/复检按钮会禁用），两种模式共用同一份前端。

> 注意：GitHub Actions 的 `GITHUB_TOKEN` 已自动解除搜索配额问题；
> 若从国内 VPS 部署且 GitHub 访问不稳定，方式 B 更省心。

## 注意事项

- 根目录的 `export.json` 由 CI 生成并提交，用于静态站，**不要**加进 `.gitignore`，
  否则 workflow 的 `git add export.json` 会失败。
- `data/` 目录是运行时数据，已被忽略；挂载到容器时需保证可写。
