# Amber 后端上云部署指南

面向 **Ubuntu Server 22.04 LTS + Docker** 的一键部署。后端是无状态推理代理 +
auth/wallet/billing/explore/admin；聊天/人格/记忆仍存在用户本地，**服务器不保存
聊天全文**。

部署后会有三个容器：`db`(PostgreSQL) + `backend`(FastAPI) + `caddy`(反代/HTTPS)。

---

## 0. 你需要准备

- 一台云服务器（2核2G 起步即可，配 Postgres 建议 2核4G，详见 README 讨论）。
- 系统选 **Ubuntu Server 22.04 LTS（64位）**。
- （强烈建议）一个域名，把它的 A 记录解析到服务器公网 IP —— 有域名才能自动 HTTPS，
  移动端正式版必须 HTTPS（否则被 Mixed Content 拦截）。
- 服务器安全组/防火墙放行 **80、443** 端口。

---

## 1. 安装 Docker（服务器上执行一次）

```bash
curl -fsSL https://get.docker.com | sh
sudo systemctl enable --now docker
docker --version && docker compose version   # 验证
```

## 2. 挂 2G swap（2G 内存机器强烈建议，防 OOM）

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 3. 拉代码到服务器

```bash
git clone <你的仓库地址> amber && cd amber
# 或本地用 scp/rsync 把项目传上去
```

## 4. 配置后端 .env

```bash
cp Amber/amber-engine/.env.example Amber/amber-engine/.env
nano Amber/amber-engine/.env
```

至少改这两项：

- `SECRET_KEY`：生成随机串 `python3 -c "import secrets;print(secrets.token_urlsafe(48))"`
- `ADMIN_PHONES`：填你的管理员手机号（该账号首次访问管理后台自动提权）

`DATABASE_URL` **留空**——compose 会自动注入指向 Postgres 容器的连接串。

## 5.（可选）配置数据库密码与域名

在 `deploy/` 目录建一个 `.env` 覆盖默认值：

```bash
cd deploy
cat > .env <<'EOF'
POSTGRES_PASSWORD=换成你的强密码
SITE_ADDRESS=amber.example.com   # 有域名填域名→自动 HTTPS；没有就删掉这行(回落 :80 纯HTTP)
EOF
```

## 6. 启动

```bash
# 在 deploy/ 目录
docker compose up -d --build
docker compose ps          # 三个容器应为 healthy/running
docker compose logs -f backend   # 看后端启动日志，Ctrl+C 退出查看
```

## 7. 验证

```bash
# 有域名：
curl https://amber.example.com/api/health
# 无域名先用 IP（纯HTTP）：
curl http://<服务器IP>/api/health
# 期望返回 {"status":"ok",...}
```

管理后台：浏览器打开 `https://你的域名/api/admin/dashboard`，用 `ADMIN_PHONES` 里那个
账号登录拿到 access token（可从 App 或 `/api/auth/login` 接口拿），粘进页面顶部输入框
→保存令牌，即可看到运营数据与分享审核。

## 8. 让前端连上线上后端

前端打包时把 API 地址指向你的域名（见 `docs/MOBILE_BUILD.md`）：

```bash
# 桌面/Web 或移动端打包前设置环境变量
VITE_API_BASE_URL=https://amber.example.com
```

---

## 常用运维

```bash
cd deploy
docker compose logs -f backend         # 实时日志
docker compose restart backend         # 重启后端
docker compose pull && docker compose up -d --build   # 更新代码后重新部署
docker compose down                    # 停止（数据卷保留）

# 备份 / 恢复 Postgres
docker compose exec db pg_dump -U amber amber > backup_$(date +%F).sql
cat backup_xxxx.sql | docker compose exec -T db psql -U amber amber
```

---

## 注意事项

- **别在 2G 服务器上 build 镜像以外的东西**；`docker compose build` 本身可控，但避免同时
  跑其它吃内存的任务。镜像也可在本地/CI 构建后 `docker save`/`load` 传上去。
- **HTTPS 与备案**：用境外/香港服务器 + 域名可直接 HTTPS，开发期可免 ICP 备案；若服务器
  在中国大陆且绑域名对外提供服务，需完成 ICP 备案后才能 80/443 正常访问。
- **WEB_CONCURRENCY 保持 1**：本服务是 I/O 密集型代理，单进程异步足够；设 >1 会让后台
  Janitor 在每个进程各跑一份。要扛更大并发就加机器（后端无状态，水平扩展即可），并把
  Janitor/定时任务拆成独立单实例进程。
- **数据库选择**：内测/极小流量可在 `.env` 里不接 Postgres（留空走容器内 SQLite，但需给
  backend 挂 `data` 卷持久化）；正式环境用本方案的 Postgres。
