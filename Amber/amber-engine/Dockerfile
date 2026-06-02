# Amber Engine — production image
# 无状态推理代理 + auth/wallet/billing/explore/admin。
# 依赖 psycopg2-binary / bcrypt / psutil 均有 manylinux wheel，无需编译器。
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# curl 仅用于容器 HEALTHCHECK
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# 先拷依赖清单，利用层缓存
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# 再拷源码
COPY . .

EXPOSE 8000

# SQLite 兜底数据目录（用 Postgres 时此目录闲置但无害）
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/api/health || exit 1

# shell 形式以便展开 WEB_CONCURRENCY（默认单进程，保证 Janitor 只跑一份）
CMD uvicorn main:app --host 0.0.0.0 --port 8000 --workers ${WEB_CONCURRENCY:-1}
