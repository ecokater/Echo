# Echo 四端兼容 + 上架 规划任务书

> 目标平台：Windows / macOS / Android / iOS
> 架构模式：云端服务器（FastAPI）+ 统一前端（React）
> 文档版本：v1.0 ｜ 基线分支：`refactor/architecture`

---

## 0. 一句话策略

**一套 React 前端代码，桌面用 Electron 壳、移动用 Capacitor 壳，共同连接同一套云端 FastAPI。** 后端从"本地单机单用户"升级为"云端多租户鉴权服务"。

---

## 1. 目标与非目标

### 目标
- 四端共享 ≥90% 前端代码（React 组件 / hooks / `lib/api.ts`）
- 后端单实例可服务多用户，数据按 `user_id` 隔离
- 满足 App Store / Google Play / Microsoft Store 上架合规
- 实时性靠 WebSocket（已具备），移动端禁止轮询

### 非目标（本期不做）
- 离线推理 / 端侧 LLM
- 移动端内嵌 Python
- 多区域容灾、水平扩容（单机起步，预留接口）

---

## 2. 架构总览

```
                      ┌───────────────────────────────────────┐
                      │          云服务器 (Docker)             │
                      │  ┌─────────────────────────────────┐   │
                      │  │ FastAPI (uvicorn + gunicorn)    │   │
                      │  │  routers/ services/ repositories│   │
                      │  │  JWT 鉴权 · 多租户 user_id 隔离 │   │
                      │  │  Janitor asyncio 常驻           │   │
                      │  └──────────┬──────────────────────┘   │
                      │   PostgreSQL│  Redis(会话/限流) 可选    │
                      │   对象存储  │  (头像/语料文件)          │
                      └─────────────┼──────────────────────────┘
                                    │ HTTPS REST + WSS
            ┌───────────────────────┼───────────────────────┐
            │                       │                       │
     ┌──────▼──────┐        ┌───────▼───────┐       ┌───────▼───────┐
     │  桌面端      │        │   Android     │       │     iOS       │
     │ Electron 壳  │        │ Capacitor 壳  │       │ Capacitor 壳  │
     │ (Win + Mac)  │        │  (WebView)    │       │  (WKWebView)  │
     └──────┬───────┘        └───────┬───────┘       └───────┬───────┘
            └────────────── 同一份 Next.js 静态产物 ──────────┘
```

---

## 3. 技术栈决策矩阵

| 维度 | 选型 | 理由 / 替代项 |
|------|------|--------------|
| 前端框架 | **Next.js 16 (`output: export`)** 保持 | 已有，静态产物可同时喂 Electron 与 Capacitor |
| 桌面壳 | **Electron 36** 保持 | 已有基础设施（`electron-main.js`/`electron-builder`）。替代 Tauri 需 Rust 重写，不划算 |
| 移动壳 | **Capacitor 6** | 复用 React 产物，原生能力（推送/安全存储）插件化。替代 RN/Flutter = 全量重写 |
| 后端 | **FastAPI** 保持 | 已重构为 routers/services/repositories |
| 数据库 | **PostgreSQL**（云端）| 多用户并发，SQLite 仅本地开发保留 |
| 鉴权 | **JWT (access + refresh)** | 无状态，四端通用。`fastapi-users` 或自实现 |
| 实时 | **WSS（已具备 useChat）** | 禁止移动端轮询（耗电） |
| 部署 | **Docker + docker-compose** | 单机起步；预留 K8s |
| 对象存储 | **S3 兼容（MinIO/阿里 OSS）** | 头像、语料文件脱离 DB |
| CI/CD | **GitHub Actions** | 多端构建矩阵 |

---

## 4. 工作包（Work Packages）

### WP-B 后端云化改造

| 编号 | 任务 | 关键文件 | 工时 |
|------|------|---------|------|
| B-1 | SQLite → PostgreSQL，`config.py` 读 `DATABASE_URL` 环境变量，SQLAlchemy 连接池 | `config.py` `database.py` | 1d |
| B-2 | 三张表全部加 `user_id` 外键 + 索引；所有 `repositories/*` 查询追加 `user_id` 过滤 | `database.py` `repositories/` | 2d |
| B-3 | JWT 鉴权：注册/登录/刷新端点 + `get_current_user` 依赖，替换/叠加 `get_db` | 新增 `routers/auth.py` `deps.py` | 2d |
| B-4 | LLM API Key 服务端加密存储（替代当前每请求明文携带），按 user 维度 | `services/chat_service.py` `schemas.py` | 1.5d |
| B-5 | WebSocket 鉴权：握手时校验 JWT，`ws/{persona_id}` 校验 persona 归属 | `routers/ws.py` `ws_manager.py` | 1d |
| B-6 | 限流 + CORS 白名单（生产域名）；移除 `allow_origins=["*"]` | `main.py` | 0.5d |
| B-7 | 对象存储：头像/语料从 base64 入库改为上传 S3，DB 存 URL | `routers/personas.py` | 1.5d |

### WP-F 前端共享层改造

| 编号 | 任务 | 关键文件 | 工时 |
|------|------|---------|------|
| F-1 | `lib/api.ts` 的 `BASE`/`WS_BASE` 改为运行时环境注入（`window.__AMBER_API__` 或构建期 env），区分 dev/prod | `lib/api.ts` | 0.5d |
| F-2 | 接入 JWT：登录页 + token 存储（桌面 localStorage / 移动 Capacitor Preferences）+ 请求拦截器自动带 `Authorization` | 新增 `lib/auth.ts` `hooks/useAuth.ts` | 2d |
| F-3 | 401 自动刷新 token + 失败跳登录 | `lib/api.ts` | 1d |
| F-4 | 平台适配层 `lib/platform.ts`：判定 electron / capacitor / web，窗口控制按钮仅桌面渲染 | `app/page.tsx` `components/amber/window-controls.tsx` | 1d |
| F-5 | 响应式布局：移动端侧边栏抽屉化（当前 `w-72` 固定栏在手机上不可用） | `app/page.tsx` `persona-roster.tsx` | 2d |
| F-6 | 安全区适配（iOS 刘海/底部 home indicator）`env(safe-area-inset-*)` | `globals.css` | 0.5d |

### WP-D 桌面端（Windows + macOS）

| 编号 | 任务 | 工时 |
|------|------|------|
| D-1 | `electron-builder` 增加 mac target（dmg + zip），配置 `mac.category`、entitlements | 1d |
| D-2 | macOS 代码签名 + 公证（Apple Developer ID，`notarytool`） | 1.5d |
| D-3 | Windows 代码签名（EV/OV 证书，避免 SmartScreen 拦截） | 1d |
| D-4 | 移除内嵌 Python 后端逻辑（`electron-main.js` 不再 spawn `amber_core.exe`，改连云端） | 0.5d |
| D-5 | 自动更新（`electron-updater` + 静态托管 latest.yml） | 1d |

### WP-M 移动端（Android + iOS）

| 编号 | 任务 | 工时 |
|------|------|------|
| M-1 | `npm i @capacitor/core @capacitor/cli`，`npx cap init`，配置 `webDir: out` | 0.5d |
| M-2 | `npx cap add android` / `npx cap add ios`，首次构建跑通 WebView 加载现有产物 | 1d |
| M-3 | 系统推送通知：Capacitor Push + FCM(Android) / APNs(iOS)，后端加推送下发 | 3d |
| M-4 | 安全存储 JWT：`@capacitor/preferences` + Keychain/Keystore | 0.5d |
| M-5 | 深链 / 状态栏 / 启动屏 / 应用图标 多分辨率适配 | 1d |
| M-6 | iOS `WKWebView` 的 WSS 与混合内容策略（必须 HTTPS/WSS，无明文） | 0.5d |

### WP-I 基础设施 / DevOps

| 编号 | 任务 | 工时 |
|------|------|------|
| I-1 | `Dockerfile`（多阶段：PyInstaller 不再需要，直接 python:3.11-slim + uvicorn/gunicorn） | 0.5d |
| I-2 | `docker-compose.yml`：api + postgres + redis + minio + caddy(反代+自动 HTTPS) | 1d |
| I-3 | 云服务器部署（域名、DNS、证书、防火墙 8000 仅内网，对外 443） | 1d |
| I-4 | GitHub Actions：后端镜像构建推送；前端 `next build`；Electron 三平台打包；Capacitor 构建 | 2d |
| I-5 | 环境分离 dev/staging/prod，密钥用 GitHub Secrets / 云端 KMS | 1d |

### WP-C 合规与上架

| 编号 | 任务 | 工时/周期 |
|------|------|----------|
| C-1 | 隐私政策 + 用户协议（聊天数据、LLM 第三方传输声明、未成年人保护） | 1d |
| C-2 | 账号删除入口（App Store 强制要求账号可删除） | 1d |
| C-3 | App Store：开发者账号($99/yr)、App 隐私清单(PrivacyInfo)、内容分级、审核 | 1-3 周 |
| C-4 | Google Play：开发者账号($25)、数据安全表单、目标 API 等级、审核 | 3-7 天 |
| C-5 | Microsoft Store：MSIX 打包或外链分发 | 3-5 天 |
| C-6 | **国内合规（如面向中国）**：App 备案、ICP、算法备案（含 LLM 生成内容） | 数周，强阻塞 |

---

## 5. 里程碑时间线

| 阶段 | 内容 | 工作包 | 周期 |
|------|------|--------|------|
| **M0 后端云化** | Postgres + JWT + 多租户 + Docker 部署，云端可登录调通 | B-1~B-6, I-1~I-3 | ~2 周 |
| **M1 前端接入云端** | 登录态、API 切云、平台适配，桌面端连云跑通 | F-1~F-4, D-4 | ~1.5 周 |
| **M2 桌面发布** | Win+Mac 签名打包、自动更新、Microsoft Store | D-1~D-5, C-5 | ~1.5 周 |
| **M3 移动端 MVP** | Capacitor 双端跑通、响应式、安全存储 | M-1~M-2, M-4~M-6, F-5~F-6 | ~2 周 |
| **M4 移动端完整** | 推送通知、对象存储 | M-3, B-7 | ~2 周 |
| **M5 上架** | 隐私合规、账号删除、商店审核 | C-1~C-6, I-4~I-5 | ~3-6 周（审核不可控） |

**总工程量约 9-11 周（不含商店审核与国内备案等待）。**

---

## 6. 风险登记册

| 风险 | 等级 | 影响 | 缓解 |
|------|------|------|------|
| iOS 审核拒绝 LLM 生成内容（4.3/5.x 条款） | 高 | 上架阻塞 | 内容过滤、年龄分级、明确第三方 AI 声明 |
| 国内算法备案 / ICP 周期长 | 高 | 国内发布阻塞 | 提前启动；或先海外发布 |
| LLM Key 服务端托管的安全与成本归属 | 中 | 安全/计费 | 用户自带 Key 加密存储；或平台计费抽象层 |
| WebSocket 在移动端后台被系统挂起 | 中 | 实时消息丢失 | 推送通知兜底；前台重连补拉 |
| 单机 PostgreSQL 成为瓶颈 | 低 | 扩容 | 连接池调优；预留读写分离接口 |

---

## 7. 验收标准（每端）

- [ ] 同一账号在四端登录，persona/聊天/记忆数据一致
- [ ] 新消息经 WSS 实时到达，移动端无轮询
- [ ] 移动端冷启动 < 3s，WebView 首屏正常（参考桌面端已验证的布局 bug 修复）
- [ ] 桌面端通过签名，Win 无 SmartScreen 拦截、Mac 无 Gatekeeper 拦截
- [ ] 账号可在 App 内删除，数据级联清除
- [ ] 隐私政策可访问，第三方数据传输已声明

---

## 8. 立即可启动的第一步

最小风险验证路径（1-2 天内出结论）：
1. **WP-I I-1/I-2**：写 `Dockerfile` + `docker-compose`，本机 docker 起 FastAPI + Postgres，确认现有 routers 在 Postgres 下跑通
2. **WP-M M-1/M-2**：`npx cap init` + `cap add android`，把现有 `out/` 产物塞进 WebView，确认 UI 在手机模拟器能渲染（验证前端复用假设）

这两步验证后，整体路径的两个最大假设（后端可容器化、前端可 WebView 复用）即被证实，再投入后续工作包。
```
