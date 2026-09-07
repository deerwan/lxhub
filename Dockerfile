FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

COPY lxhub ./lxhub
COPY main.py config.json ./

ENV LXH_DB=/app/data/lxhub.db
VOLUME ["/app/data"]
EXPOSE 8787

HEALTHCHECK --interval=60s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:8787/healthz || exit 1

# 端口交给环境变量（LXH_PORT / PORT，默认 8787），便于 Railway 等平台注入 PORT
CMD ["python", "main.py", "serve", "--host", "0.0.0.0"]
