```
version: "3"
services:
  lxhub:
    image: ghcr.io/deerwan/lxhub:latest
    # 如需本地构建（不走 ghcr），把上面一行换成：build: .
    container_name: lxhub
    ports:
      - "8787:8787"          # 宿主机端口:容器端口；外部用前者访问
    volumes:
      - ./data:/app/data     # 持久化 SQLite，容器重启不丢数据
    environment:
      # 以下覆盖 config.json，确保容器监听所有网卡、端口一致
      - LXH_HOST=0.0.0.0
      - LXH_PORT=8787
      # GITHUB_TOKEN 三种填法任选其一（都不需要 .env 文件）：
      #   1) 本行直接写：   - GITHUB_TOKEN=ghp_xxx
      #   2) 命令行传入：   docker run -e GITHUB_TOKEN=ghp_xxx ...   （推荐，token 不落盘）
      #   3) 云平台（Railway/Render）控制台的环境变量里填
      # 留空则爬取额度受限；也可部署后在网页后台填写。
      - GITHUB_TOKEN=${GITHUB_TOKEN:-}
      # 设置后启用网页后台（建议）：docker 部署时在此填账户名/密码，即可网页配置/触发爬取
      - LXH_ADMIN_USER=admin          # 后台账户名（默认 admin，可改）
      - LXH_ADMIN_PASS=你的后台密码    # 后台密码（务必设置，否则后台不启用）
    restart: unless-stopped
