# Amber 进行中任务看板 (防冲突)

> 开始任何工作前，在此认领正在改动的文件/模块；完成后移到「最近完成」或清空认领。
> Claude ⇄ Codex 协同：动手前先读本文件，避免同时改同一文件。
> 历史交接详情见 `work.md`。
> 若发现目标文件/模块已被另一方认领，先暂停并沟通，不要并行修改同一区域。

---

## 🔴 正在进行 (IN PROGRESS)

| 执行者 | 任务 | 锁定文件/模块 | 开始时间 |
|--------|------|--------------|---------|
| (空闲) | — | — | — |

## 🟢 最近完成 (RECENTLY DONE)

- 2026-06-03 · Claude · **REQ-012 前端(去 API 设置界面 + 默认平台模型)完成**：`api/inference.ts::modelFromSettings()` 改为**默认返回空 `{}`(走服务端平台模型/硅基流动)**,仅当 `amber_use_custom_api==="1"` 且有 key 时才带自带 key(BYO 保留);`SettingsModal.tsx` 主界面移除「模型连接设置」,改为「智能模型已就绪」提示卡,BYO 收进**高级折叠区**(开关「启用自定义模型」+ 原 key/baseUrl/modelId 表单);`Chat.tsx` 未改(modelFromSettings 接口兼容)。验证:tsc 0、vite build 通过(386KB)。至此 REQ-012 前后端全部完成,待重建镜像上线。锁定文件已释放。

- 2026-06-03 · Claude · **REQ-012 后端(硅基流动平台模型 + 管理员实时定价)完成**：新增 `platform_config` 单例表(provider key/base_url/model_id + platform_enabled + cost_per_chat/distill/snapshot,key 永远掩码返回);`repositories/platform_repo.py`(get/update/serialize/as_resolver_dict,首次从 env 播种);`inference_service._resolve_llm` 改为**三级优先**:客户端带 key→用客户端(保留旧版自设 API);否则平台硅基流动(启用且有 key);否则 legacy global。推理三端点改用 DB 实时单价(`cfg.cost_per_*`)并把 platform 传入;distill 免费判定纳入平台 key。管理员新增 `GET/POST /api/admin/pricing`(改型号/base_url/key/单价/开关,空 key=不改)+ 看板「平台模型与定价」可视化编辑区。config/.env.example 加 `PLATFORM_API_KEY/BASE_URL/MODEL_ID`(默认硅基流动 + `Pro/deepseek-ai/DeepSeek-V3`)。main.py 启动播种。验证:compileall+import、`/api/admin/pricing` 注册、_resolve_llm 三级优先单测、TestClient(403 普通/200 管理员、改价、掩码 sk-t****7890、空 key 不清空、单价 99999→对话 402)全过。**纯后端,未碰前端**。待 Codex 接前端去设置界面。锁定文件已释放。
- 2026-06-02 · Claude · **后端上云部署配置(Docker+Postgres+Caddy)完成**：新增 `Amber/amber-engine/Dockerfile`(python:3.11-slim,无需编译器,带 /api/health HEALTHCHECK,CMD 按 `WEB_CONCURRENCY` 起 uvicorn)、`.dockerignore`;重写 `.env.example` 为当前商业化后端真实变量(ENV/SECRET_KEY/ADMIN_PHONES/DATABASE_URL/计费,删除已废弃的 relay/DEFAULT_API_KEY);新增 `deploy/docker-compose.yml`(db=postgres:16 + backend + caddy 三容器,变量插值+健康检查依赖,environment 注入 DATABASE_URL 指向 db)、`deploy/Caddyfile`(SITE_ADDRESS 有域名自动 HTTPS/无域名回落 :80,反代 backend:8000)、`docs/DEPLOY.md`(Ubuntu 22.04 一步步:装 Docker→swap→.env→compose up→验证→前端指向→运维备份)。验证:compose YAML 结构校验通过、相对路径 `../Amber/amber-engine` 解析到后端目录确认。**纯新增部署文件,未碰应用代码与前端**。锁定文件已释放。

- 2026-06-02 · Claude · **后端上云部署配置(Docker+Postgres+Caddy)完成**：新增 `Amber/amber-engine/Dockerfile`(python:3.11-slim,无需编译器,带 /api/health HEALTHCHECK,CMD 按 `WEB_CONCURRENCY` 起 uvicorn)、`.dockerignore`;重写 `.env.example` 为当前商业化后端真实变量(ENV/SECRET_KEY/ADMIN_PHONES/DATABASE_URL/计费,删除已废弃的 relay/DEFAULT_API_KEY);新增 `deploy/docker-compose.yml`(db=postgres:16 + backend + caddy 三容器,变量插值+健康检查依赖,environment 注入 DATABASE_URL 指向 db)、`deploy/Caddyfile`(SITE_ADDRESS 有域名自动 HTTPS/无域名回落 :80,反代 backend:8000)、`docs/DEPLOY.md`(Ubuntu 22.04 一步步:装 Docker→swap→.env→compose up→验证→前端指向→运维备份)。验证:compose YAML 结构校验通过、相对路径 `../Amber/amber-engine` 解析到后端目录确认。**纯新增部署文件,未碰应用代码与前端**。锁定文件已释放。
- 2026-06-02 · Codex · **当前功能实现规划已更新到 work.md**：补充协作状态、已可用能力、P0/P1/P2/P3 近期优先级队列与推荐下一步 process；明确 Claude 当前锁定后端上云部署配置，Codex 不触碰部署文件；QQ bot 继续保持独立分支/主线最低优先级。锁定文件已释放。

- 2026-06-02 · Codex · **REQ-008 按钮/窗口动效完成**：移动端底部 tab、我的子页面、侧边抽屉、加号菜单、碎片弹窗、模型设置弹窗、桌面控制台均加入 spring 滑入/淡入动效；全局按钮加入触摸按压反馈；tsc/build/android:build 通过，APK 已安装到 emulator-5554。剩余：充值页/创建分身页独立路由动效可后续继续覆盖，真实设备手感可继续微调。锁定文件已释放。

- 2026-06-02 · Codex · **REQ-007 “我的”移动端页面完成**：新增后端 `GET /api/billing/orders` 当前用户订单接口；新增前端 `api/system.ts` 与 `billing.listOrders()`；移动端底部“我的”tab 已实现用户信息、充值入口、Token 消耗历史、我的订单、帮助客服、关于 Amber、最近钱包流水；子页面切换自动回顶部；tsc/build/backend compile/import/OpenAPI 抽查/android:build 通过并安装截图验证。剩余：客服接真实服务、订单详情/筛选/退款、桌面账户中心。锁定文件已释放。
- 2026-06-02 · Claude · **REQ-010 后端可视化管理系统完成**：`database.py` User 加 `role`(user|admin)；`deps.py` 加 `get_current_admin`(role==admin,或 `ADMIN_PHONES` 环境变量白名单首次命中自动提权)；`repositories/admin_repo.py`(overview 全局聚合 + usage/ledger/orders/shares 列表+序列化)；`routers/admin.py` 暴露 `GET /api/admin/overview|usage|ledger|orders|shares|system`、`POST /api/admin/shares/{id}/remove`(审核下架)、`GET /api/admin/dashboard`(**自包含 HTML 可视化看板**,粘贴管理员 token 即用);main.py 挂载 + users.role 迁移;requirements 加可选 psutil(服务器负载 best-effort)。验证：compileall+import OK、8 路由全注册、TestClient 端到端通过(401 无 token / 403 普通用户 / 200 管理员;overview 聚合准确;普通用户发布分享→管理员下架→变 404;dashboard 返回 HTML)。**纯后端,未碰任何前端文件**。锁定文件已释放。
- 2026-06-02 · Claude · **REQ-009 探索后端云端分享完成**：新增 `shared_personas` 表(仅存可分享人格卡：traits/core_memory/avatar 等，**绝不存聊天全文/私有记忆**)；`repositories/explore_repo.py`(publish/list 搜索+热度排序/install 自增/unpublish 软下架/序列化 card/detail)；`routers/explore.py` 暴露 `POST /api/explore/publish`、`GET /list?q&sort&limit&offset`、`GET /mine`、`GET /{id}`、`POST /{id}/install`、`DELETE /{id}`;main.py 挂载;前端新增 `src/api/explore.ts`(typed client + `detailToLocalPersona` 导入本地)。验证：compileall+main import OK、6 条 explore 路由全注册、内存库 publish→搜索命中→install 自增→序列化→下架移除全链路通过、前端 tsc 全绿。**未碰 Codex 锁定的 Chat.tsx**。待办:Explore Tab 前端 UI(需等 Chat.tsx 解锁)、发布入口接入分身设置页。锁定文件已释放。
- 2026-06-02 · Codex · **主题偏好跨页面保持修复**：新增 `src/lib/theme.ts`，用 `amber_theme` 持久化明暗主题；`Chat.tsx` 明暗切换写入偏好；`CreatePersona.tsx`、`Recharge.tsx`、`Login.tsx` 移除强制 `dark`，改为读取偏好；tsc/build/android:build 通过并重新安装；Android 实测浅色下点击“蒸馏”进入创建页仍保持浅色。剩余：创建分身完整流程与返回聊天页主题保持验收。锁定文件已释放。
- 2026-06-02 · Codex · **Android 手机端主界面适配修复**：定位 `Chat.tsx` mobile 状态未绑定屏幕宽度，导致 Android 一直渲染桌面三栏；新增 `matchMedia("(max-width: 767px)")` 检测，主容器改 `100dvh`，移动端容器 `w-full overflow-hidden`；tsc/build/android:build 通过并重新安装；截图确认单列聊天布局和左侧抽屉正常。剩余：创建分身页、充值页、设置弹窗移动端细节走查。锁定文件已释放。
- 2026-06-02 · Codex · **Android Mixed Content 登录阻断最终修复**：抓到 WebView 明确报错 `https://localhost` 请求 `http://10.0.2.2:8000` 被 Mixed Content 阻断；将 `capacitor.config.ts` 的 `server.androidScheme` 改为 `http`；重新构建安装后日志确认加载 `http://localhost`；自动 smoke 使用 `13900000099 / 123456` 成功进入主界面并显示碎片余额 `100`。剩余：Android 创建分身→聊天→刷新持久化完整验收。锁定文件已释放。
- 2026-06-02 · Codex · **Android 模拟器登录/注册失败修复**：确认后端健康、debug API 指向 `http://10.0.2.2:8000`；为 `AndroidManifest.xml` 显式加入 `android:usesCleartextTraffic="true"`；`npm.cmd run android:build` 成功并重新安装启动；后端注册 smoke 返回 200。剩余：ADB 坐标填表未稳定完成，需用户手动登录/注册验收；若仍失败继续抓 `adb logcat`。锁定文件已释放。
- 2026-06-02 · Codex · **REQ-001 端到端主流程 smoke 与 Android debug API 修复**：前端 tsc/build、后端 compile/import、后端 API smoke、服务启动 smoke 均通过；Android debug 包重构建/安装/启动成功；修复 `scripts/android-build.mjs`，debug 默认 API 指向 `http://10.0.2.2:8000`，release 阻止占位域名；更新 `docs/MOBILE_BUILD.md`。剩余：需人工/浏览器自动化完成创建分身→真实聊天→刷新持久化验收。锁定文件已释放。
- 2026-06-02 · Claude · **REQ-005/006 头像系统完成**：新增 `lib/avatar.ts`(选图+canvas 居中裁剪压缩 256px base64)；CreatePersona 头像上传存 LocalPersona.avatar；Chat 分身列表+控制台圆形头像(无图按名字生成色块+首字 `PersonaAvatar`)；SettingsModal 加「我的头像」存 localStorage。tsc + build 通过。锁定文件已释放。

- 2026-06-02 · Codex · 用户需求模板与任务必读规则完成：新增 `用户需求.md` 需求填写模板（前端/后端/API/本地数据/隐私/验收/验证/完成记录）；更新 `AGENTS.md`，要求每次开始具体工作前先读 `用户需求.md`，需求状态变化时同步更新。锁定文件已释放。
- 2026-06-02 · Codex · 验证前端 Local-first 构建与 legacy API 清理：删除未引用的旧 `src/api/chat.ts`、`src/api/persona.ts`；`src/` 中无 `/api/personas`、`/api/chat`、`/api/system/memory`、`/ws/` 残留；`npx.cmd tsc --noEmit -p tsconfig.app.json` 与 `npm.cmd run build` 通过；后端 OpenAPI 旧端点消失、新 inference/system 端点保留。锁定文件已释放。
- 2026-06-02 · Codex · 移除后端 legacy persona/chat/memory API 挂载：`main.py` 不再导入/挂载 `routers/personas.py`、`routers/chat.py`、`routers/memory.py`；OpenAPI 中旧 `/api/personas`、`/api/chat/{persona_id}`、`/api/system/memory/*` 已消失，`/api/inference/chat` 与 `/api/system/usage-events` 保持存在。验证：compileall、main import、OpenAPI 抽查通过。锁定文件已释放。
- 2026-06-02 · Claude · **Chat/CreatePersona 切到 Local-first**：persona/历史/对话全改本地 IndexedDB + `inferenceApi`（本地写user→RAG组装→inference→本地写assistant+mood+memory_candidates）；CreatePersona 本地 create + 可选 distill + raw_corpus 本地分块；移除 WebSocket；登出清本地。tsc 全绿。锁定文件已释放。

- 2026-06-02 · Codex · 后端 usage_events / system_events 落库审计完成：新增 `usage_events`/`system_events` 模型与 `repositories/usage_repo.py`；`/api/inference/*` 成功/失败/退款/余额不足均写脱敏 usage 元数据；新增 `GET /api/system/usage-events|events` 用户级查询；修复旧 `is_override_active` 刷库守卫。验证：compileall、main import、内存库写查、OpenAPI 抽查通过。锁定文件已释放。
- 2026-06-02 · Codex · Android debug APK 已安装到模拟器 `emulator-5554`；包名 `com.amber.app`；安装产物 `琥珀Amber数字生命UI/android/app/build/outputs/apk/debug/app-debug.apk`。锁定文件已释放。
- 2026-06-02 · Codex · 后端 legacy API 标记与 inference 挂载检查完成：确认 `main.py` 已挂载 `/api/inference/*`；旧云端 `personas/chat/memory` router 已在 OpenAPI 标记 `deprecated=True`，tags 改为 `legacy-personas|legacy-chat|legacy-memory`。验证：compileall、main import、OpenAPI 抽查通过。锁定文件已释放。
- 2026-06-02 · Claude · **前端本地数据层 + inference client 完成**：`types/skill.ts`(SkillRequest/Response+Local 实体)、`api/inference.ts`(对接 /api/inference/*)、`lib/localdb.ts`(IndexedDB CRUD：personas/messages/corpus，四端通用)、`lib/localRag.ts`(本地字符重叠 RAG + 上下文组装)。tsc 全绿。**未碰 Chat.tsx**。锁定文件已释放。
- 2026-06-02 00:55 · Codex · Android 模拟器启动问题诊断：APK/Gradle 正常，阻塞于 BIOS 虚拟化关闭 + Emulator hypervisor driver 未启用；详见 `work.md`
- 2026-06-02 · Claude · **后端 inference proxy 完成**：`/api/inference/chat|distill|memory-summary` 无状态推理（不读写 persona/message/corpus）；鉴权+wallet 扣费（chat 1/distill 20/snapshot 5）+ 失败自动退款；schemas 加 SkillRequest/Response。验证：distill 无 key 免费返默认、chat 无 key→400 退款、无 token→401、全程零落盘。锁定文件已释放。
- 2026-06-02 00:33 · Codex · Skill 改造计划写入 `work.md`：Local skill runtime + Cloud inference adapter
- 2026-06-02 00:24 · Codex · 用户确认 Local-first memory + cloud inference proxy；已更新 `work.md` 架构与 API 计划
- 2026-06-01 21:16 · Codex · 创建 `qq-bot-support` 分支；主版本移除 QQ bot/relay runtime、依赖、API 契约和主线文档入口
- 2026-06-01 · Claude · **P1 WebSocket 实时推送接入完成**：ws.py 加 token+persona 归属鉴权（无效→403）；Chat.tsx 选中分身时开 socket，推送 message 去重追加 + mood 实时刷新控制台。验证：own+token→OPEN、no-token→403。锁定文件已释放。

- 2026-06-01 13:55 · Codex · Android debug APK 构建成功；产物 `琥珀Amber数字生命UI/android/app/build/outputs/apk/debug/app-debug.apk`
- 2026-06-01 13:44 · Codex · Android Studio 安装后继续验证；SDK 已存在，仍阻塞于 JDK/JBR 不可见
- 2026-06-01 13:37 · Codex · 实现 Android 端构建脚本与文档；阻塞于本机缺少 Java/JDK，未产出 APK
- 2026-06-01 13:30 · Codex · 写入 `docs/BACKEND_ADMIN_PLAN.md`；QQ 机器人/relay 已降为 P4 最低优先级
- 2026-06-01 13:20 · Codex · 制定后端可视化、管理设置、多用户服务 plan；已写入 `work.md`
- 2026-06-01 13:03 · Codex · 修复 Vite 新主前端 Windows 预览启动脚本；`npm.cmd run dev -- --help` 已验证进入 Vite CLI
- 2026-06-01 · Claude · **P0 多租户隔离完成**：persona_repo 加 owner 过滤；personas/memory 强制 `get_current_user` + 归属校验；chat 融合 Codex 碎片扣减并加 user 存在时归属校验。验证：A创建B不可见、B访问A分身 404、无token 401。锁定文件已释放。
- 2026-06-01 12:27 · Codex · 建立开始工作前的 `working.md` 防冲突规则；已更新 `AGENTS.md` 与 `work.md`
- (本轮开始前) WP-F/WP-P/WP-M 见 work.md 日志

## ⚪ 空闲可认领 (FREE TO CLAIM)

> 按 Local-first + inference proxy 新架构刷新（旧的 WebSocket/QQ 中继任务已随架构调整作废）

**前端本地数据层（新架构核心，最高优先）**
- ✅ TS 类型 `types/skill.ts` + `api/inference.ts` client（Claude 2026-06-02）
- ✅ 本地存储 `lib/localdb.ts`（IndexedDB，四端通用，含 personas/messages/corpus）（Claude 2026-06-02）
- ✅ 本地 RAG `lib/localRag.ts` + 上下文组装（Claude 2026-06-02）
- ✅ Chat.tsx 流程改造：persona/历史/对话改走 localdb + `inferenceApi.chat`（Claude 2026-06-02）
- ✅ CreatePersona.tsx 改造：走 `personaStore.create` + `inferenceApi.distill`（Claude 2026-06-02）
- ⬜ 本地记忆结晶（定时调 `/api/inference/memory-summary` 写本地 corpus）+ 本地 Janitor（情绪退火）
- ⬜ Android 大容量可选升级 Capacitor SQLite（当前 IndexedDB 已够用）

**后端收尾**
- ✅ 旧 `personas/chat/memory` 云端 router 已从主 FastAPI app 取消挂载（Codex 2026-06-02）
- 后端上云（Docker + Postgres + Caddy，服务端仅存 auth/wallet/billing/usage）

**其它**
- 管理后台审计 UI：接入 `GET /api/system/usage-events|events`
- 记忆管理 UI（基于本地数据层）
