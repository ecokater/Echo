# Amber 协同工作日志 (Claude ⇄ Codex)

> 约定：每次完成工作追加一条记录。格式：日期 · 执行者 · 完成项 · 待办缺口 · 下一步 process。
> 代码/变量/commit 用英文，记录正文中文。分支：`refactor/architecture`。

---

## 项目现状速览（持续更新）

**架构**：本地优先数据层 + 云端推理代理 + 统一 React 前端（桌面 Electron / 移动 Capacitor）

```
Amber/amber-engine/          # FastAPI 后端（inference proxy 已实现；persona/chat/memory 云端 API 已标 legacy）
  routers/  services/  repositories/  schemas.py  state.py  deps.py  ws_manager.py
琥珀Amber数字生命UI/          # 新主前端（Vite + React，商业化 UI）★当前主力
  src/api/ src/stores/ src/pages/ src/components/SettingsModal.tsx
  electron-main.cjs  capacitor.config.ts  android/  ios/
Amber/main_ui/               # 旧 Next.js 前端（已退役，保留 electron.exe 复用）
launch.py                    # 一键启动：后端 + Vite + Electron(新前端)
docs/MULTIPLATFORM_PLAN.md   # 四端总规划
docs/MOBILE_BUILD.md         # 移动端出包指南
```

**本机环境**：Python 3.11 / Node22(便携 `%USERPROFILE%\node22`) / Android Studio + Android SDK
**启动**：`python launch.py`（或双击 `启动Amber.bat`）

**新架构决策（2026-06-02 用户确认）**：
- 主版本改为 **Local-first memory + cloud inference proxy**。
- persona、messages、persona_corpus、用户导入语料、长期记忆默认保存在用户本地设备。
- 服务端只接收临时上下文并调用模型，返回 reply / mood_delta / usage；默认不持久化聊天全文、人格记忆或导入语料。
- 服务端保留 auth、wallet、billing、usage_events、system_events、inference proxy；云端同步只做可选端到端加密备份。

---

## 后端 API 契约（供 Codex 对接）

base: `http://127.0.0.1:8000`（生产改云端域名）

| 模块 | 端点 |
|------|------|
| auth | `POST /api/auth/register|login|refresh`、`GET/DELETE /api/auth/me` |
| wallet | `GET /api/wallet/balance`、`GET /api/wallet/ledger` |
| billing | `GET /api/billing/skus`、`POST /api/billing/order`、`GET /api/billing/orders`、`POST /api/billing/callback/dev` |
| inference | ✅ `POST /api/inference/chat`、`/distill`、`/memory-summary`（无状态，鉴权+扣费+不落盘；已实现 by Claude 2026-06-02） |
| local-only | persona / chat / memory 数据已迁移到客户端本地 IndexedDB；旧云端 API 已从主 FastAPI app 取消挂载 |
| system | `GET /api/health`、`/api/system/status|config|reset|janitor-test-mode`、`GET /api/system/usage-events|events` |
| explore | ✅ `POST /api/explore/publish`、`GET /api/explore/list?q&sort=hot|new&limit&offset`、`GET /api/explore/mine`、`GET /api/explore/{id}`、`POST /api/explore/{id}/install`、`DELETE /api/explore/{id}`（云端仅存可分享人格卡，不存聊天/私有记忆；已实现 by Claude 2026-06-02） |
| admin | ✅ `GET /api/admin/overview|usage|ledger|orders|shares|system`、`POST /api/admin/shares/{id}/remove`、`GET/POST /api/admin/pricing`(平台模型+实时单价)、`GET /api/admin/dashboard`(HTML 看板)；守卫 `get_current_admin`（role==admin 或 `ADMIN_PHONES` 白名单自动提权）（已实现 by Claude 2026-06-02/03） |
| inference(平台) | ✅ 推理三端点支持平台模型回退：客户端带 key→用客户端(保留旧版自设 API)；不带→用 `platform_config`(硅基流动+DeepSeek)；单价取 DB 实时值（REQ-012 by Claude 2026-06-03） |

鉴权：`get_current_user`(强制) / `get_optional_user`(兼容旧客户端)。碎片：注册赠 100，对话扣 1，余额不足返回 **402**。

---

## 当前功能实现规划（2026-06-02 更新）

### 0. 协作状态

- Claude 正在做：后端上云部署配置（Docker + Postgres + Caddy），锁定部署相关文件；Codex 不碰该区域。
- Codex 当前可接：前端主体验、本地记忆 UI、Android 验证、`work.md`/`working.md` 规划维护。
- 主版本继续保持：不做 QQ bot；QQ bot 只保留在独立分支/低优先级分支，不进入当前主线。

### 1. 已可用能力

- 登录/注册、钱包、充值 SKU/订单、推理扣费、usage 审计已接入。
- Local-first 已落地：persona、messages、corpus 默认存在客户端本地 IndexedDB；服务端不保存聊天全文和私有记忆。
- Android debug 构建可用，默认连接 `http://10.0.2.2:8000`，APK 产物为 `琥珀Amber数字生命UI/android/app/build/outputs/apk/debug/app-debug.apk`。
- 移动端主界面、“我的”页、按钮/弹窗动效已完成基础可用版本。
- 后端探索分享 API、后端管理 Dashboard MVP 已完成。

### 2. 近期优先级队列

| 优先级 | 需求 | 当前状态 | 下一步实现 |
|--------|------|----------|------------|
| P0 | REQ-001 主流程验收 | 基础 smoke 通过，仍缺真实人工闭环 | 用真实/测试模型配置走通：登录 → 创建分身 → 聊天 → 刷新后本地数据仍在；Android 同步验收 |
| P1 | REQ-002 本地记忆管理 | 未实现 UI | 在聊天页/记忆 Tab 增加本地 corpus 列表、搜索、置顶、删除；只读写 IndexedDB |
| P1 | REQ-003 自动整理记忆和情绪 | 未实现本地 Janitor | 前端定时/手动触发 `/api/inference/memory-summary`，结果写回本地 corpus；加入情绪退火，不上传全文持久化 |
| P1 | REQ-007 我的 | 移动端 MVP 完成 | 补客服真实入口、订单详情/筛选/退款状态、桌面账户中心 |
| P1 | REQ-008 动效 | 核心路径完成 | 继续覆盖充值页、创建分身页、页面级进入/返回动画，按真机手感微调 |
| P2 | REQ-010 后端管理系统 | 后端 MVP 完成，部署配置进行中 | 等 Claude 部署配置完成后，验证云端访问、管理员 token、Dashboard 数据；后续补趋势图/筛选/封禁/退款 |
| P3 | REQ-009 探索 | 后端 API + client 完成，前端待做 | 做探索 Tab 列表/详情/安装，以及分身设置里的“分享到探索”入口 |
| P3 | REQ-011 聊天记录导入 | 未实现 | 先做本地文件导入方案设计，再接微信/QQ 导入工具；数据只进本地 corpus |

### 3. 推荐下一步 process

1. 若目标是尽快可用：先做 **REQ-001 主流程人工验收 + 修复**，确保 Android/Web 都能从创建到聊天跑通。
2. 若目标是提升核心产品力：做 **REQ-002 本地记忆管理 UI**，这是 Local-first 架构最关键的用户可见能力。
3. 若目标是让分身更像“数字生命”：接 **REQ-003 本地 Janitor**，让记忆结晶和情绪退火自动运行。
4. Claude 部署配置完成后：Codex/Claude 再一起做云端部署验证和管理后台访问验证，避免部署文件冲突。

---

## 日志

### 2026-06-03 · Claude · REQ-012 前端：去 API 设置界面 + 默认平台模型（P0 收尾）
**完成**
- 用户要求 Claude 一并做前端(原计划留 Codex)。看板无冲突,认领后实现。
- `api/inference.ts::modelFromSettings()`:默认返回空 `{}` → 服务端走平台模型(硅基流动/DeepSeek);仅当 `localStorage.amber_use_custom_api==="1"` 且有 apiKey 时返回自带 key(BYO)。返回类型标注 `InferenceModel`。
- `components/SettingsModal.tsx`:主界面移除「模型连接设置」表单;改为「智能模型已就绪」提示卡(无需配置);新增「高级 · 使用自己的模型 API」可折叠区(framer-motion 高度动画),内含「启用自定义模型」开关 + 原 preset/apiKey/baseUrl/modelId 表单;保存时写 `amber_use_custom_api` 标志 + 头像 + (启用时)api 配置。保留「我的头像」。
- `Chat.tsx`/`CreatePersona.tsx` 未改:`modelFromSettings()` 签名兼容,自动获得「默认平台」行为。

**验证**
- `npx tsc --noEmit -p tsconfig.app.json` 退出 0;`vite build` 通过(386KB JS)。

**下一步 / 上线清单**
- 重建后端镜像并部署(`docker compose up -d --build`);后台「平台模型与定价」填硅基流动 key + 准确 DeepSeek 型号 ID(待用户确认,默认 `Pro/deepseek-ai/DeepSeek-V3`)。
- 前端重新打包,`VITE_API_BASE_URL` 指向服务器,验证不带 key 也能正常对话(走平台)。
- 服务器拉代码通道:GitHub 被墙,需 Gitee 镜像或 scp(用户暂选"先不上服务器")。

### 2026-06-03 · Claude · REQ-012 后端：硅基流动平台模型 + 管理员实时定价（P0）
**完成**
- 认领 REQ-012 后端部分（前端「去 API 设置界面」留 Codex,已在 working.md 标可领）。
- `database.py::PlatformConfig` 单例表(id=1):`provider_base_url/model_id/api_key`、`platform_enabled`、`cost_per_chat/distill/snapshot`、`updated_at`。新表 create_all 自动建。
- `repositories/platform_repo.py`:`get_config`(缺失则从 config/env 播种)、`update_config`(只更非 None;空 api_key 视为不改,防误清)、`serialize`(api_key 永远掩码 `sk-xxxx****xxxx`)、`as_resolver_dict`(内部含真 key 供推理用)。
- `services/inference_service._resolve_llm(model, platform)` 三级优先:① 客户端带 key → 用客户端全套(**保留旧版用户自设 API**);② 否则平台(enabled 且有 key,默认硅基流动 `https://api.siliconflow.cn/v1` + `Pro/deepseek-ai/DeepSeek-V3`);③ 否则 legacy global。run_chat/distill/memory_summary 增加 `platform` 形参。
- `routers/inference.py`:三端点取 `platform_repo.get_config(db)`,**单价改用 DB 实时值** `cfg.cost_per_*`(管理员改价即时生效),并把 platform 传入 service;distill 免费判定纳入平台 key;移除对 `config.COST_PER_*` 的依赖。
- `routers/admin.py`:`GET /api/admin/pricing`(掩码) + `POST /api/admin/pricing`(改型号/base_url/key/单价/开关);看板新增「平台模型与定价」可视化编辑区(开关+表单+保存,空 key 占位“留空=不修改”)。
- `config.py`/`.env.example`:加 `PLATFORM_API_KEY`、`PLATFORM_BASE_URL`(默认硅基流动)、`PLATFORM_MODEL_ID`(默认 `Pro/deepseek-ai/DeepSeek-V3`)。`main.py` 启动播种单例。

**验证**
- compileall + import OK;`/api/admin/pricing` 已注册。
- 单测 `_resolve_llm`:BYO key 优先、平台回退、平台禁用→无 key,三种全对。
- TestClient(临时 sqlite + ADMIN_PHONES):普通用户读定价 403 / 管理员 200(默认值正确);改价 chat=3+设 key→掩码 `sk-t****7890`+key_set;**空 key 提交不清空已有 key**;**单价 99999 → 对话 402**(证明扣费走 DB 实时单价)。

**待办缺口 / 下一步**
- **前端(Codex)**:去掉 `SettingsModal` 的 API 设置界面;`api/inference.ts` 不再带 model 配置(发空 `model:{}`),让服务端走平台模型。旧版自设 API 想保留的话,可保留一个隐藏/高级入口。
- **模型 ID 待用户确认**:需求写的是“deepseekV4pro”,我默认 `Pro/deepseek-ai/DeepSeek-V3`(硅基流动 Pro 档),实际型号请在后台「平台模型与定价」里改成硅基流动目录中的准确 ID。
- **上线**:需重新构建后端镜像(`docker compose up -d --build`),并在后台或 `PLATFORM_API_KEY` 填硅基流动 key 才能真正用平台模型。

### 2026-06-02 · Claude · 后端上云部署配置（Docker + Postgres + Caddy）完成
**完成**
- 承接「服务器选型/操作系统」讨论，落地 Ubuntu 22.04 + Docker 部署链路；纯新增部署文件，不动应用代码与前端。
- `Amber/amber-engine/Dockerfile`：python:3.11-slim；依赖(psycopg2-binary/bcrypt/psutil)均有 manylinux wheel 故无需编译器；装 curl 仅供 HEALTHCHECK(`/api/health`)；先拷 requirements 利用层缓存；`CMD uvicorn main:app --workers ${WEB_CONCURRENCY:-1}`(默认单进程保证 Janitor 只跑一份)；声明 `/app/data` 卷作 SQLite 兜底。
- `Amber/amber-engine/.dockerignore`：排除 .env/data/*.db/__pycache__ 等，防泄漏本地状态、减小镜像。
- 重写 `Amber/amber-engine/.env.example`：改为当前商业化后端真实变量(ENV、SECRET_KEY、ACCESS/REFRESH 过期、ADMIN_PHONES、DATABASE_URL[含 Postgres 示例]、SIGNUP_GIFT/COST_PER_* 计费)，删除已废弃的 DEFAULT_API_KEY/relay 残留。
- `deploy/docker-compose.yml`：db=postgres:16-alpine(pg_isready 健康检查 + pgdata 卷) + backend(build ../Amber/amber-engine、env_file 后端 .env、environment 注入 `DATABASE_URL=postgresql+psycopg2://…@db:5432/…` 覆盖空值、depends_on db healthy) + caddy(80/443、Caddyfile 只读挂载 + caddy_data/config 卷)。变量插值带默认值(POSTGRES_*/SITE_ADDRESS/WEB_CONCURRENCY)。
- `deploy/Caddyfile`：`{$SITE_ADDRESS}` 有域名→自动 Let's Encrypt HTTPS、无域名回落 :80；`reverse_proxy backend:8000`(自动透传 WS 升级头) + gzip/zstd + 基础安全头。
- `docs/DEPLOY.md`：面向非专家的一步步指南(装 Docker→挂 2G swap→拉代码→cp .env 改 SECRET_KEY/ADMIN_PHONES→可选 deploy/.env 设库密码/域名→compose up→curl /api/health 验证→管理后台→前端 VITE_API_BASE_URL 指向→logs/restart/pg_dump 运维→ICP/HTTPS/WEB_CONCURRENCY 注意事项)。

**验证**
- `python -c yaml.safe_load` 校验 compose 结构：services={db,backend,caddy}、volumes={pgdata,caddy_data,caddy_config}、build.context 与 ports 断言通过。
- 文件系统核实相对路径：从 `deploy/` 解析 `../Amber/amber-engine/{Dockerfile,main.py,requirements.txt,.env.example}` 全部命中。
- 本机未装 Docker，未执行 `docker compose build/up`(无法在 Windows 验证镜像构建)；Dockerfile/compose 经人工审阅 + 路径/语法校验。

**待办缺口**
- 需在装有 Docker 的环境(或目标服务器)实际 `docker compose up -d --build` 跑一次冒烟：确认镜像构建、Postgres 连通、create_all 建表、/api/health 通过 Caddy 可达。
- Postgres 上 startup 的 `ALTER TABLE … ADD COLUMN BOOLEAN DEFAULT 0` 是 SQLite 语法；新库走 create_all 不会触发(SELECT 成功即跳过)，但若从旧 SQLite 迁移到 PG 需另写迁移。
- 可选：加 GitHub Actions 在 CI 构建镜像并推到 registry，避免在 2G 小机器上 build。

**下一步 process**
- 等用户在服务器跑通部署冒烟后，按需补 CI/镜像仓库、或回到前端 P1(REQ-002 本地记忆管理 / REQ-003 本地 Janitor / REQ-009 探索前端 Tab)。

### 2026-06-02 · Codex · 更新当前功能实现规划
**完成**
- 在 `work.md` 顶部补充“当前功能实现规划（2026-06-02 更新）”，整理当前协作状态、已可用能力、P0/P1/P2/P3 近期优先级队列与下一步 process。
- 明确 Claude 当前占用后端上云部署配置，Codex 本轮只更新规划文档，不触碰部署文件。
- 明确 QQ bot 继续不进入主版本，保持独立分支/最低优先级。

**待办缺口**
- 规划本身不改功能；后续仍需按队列逐项实现和验收。
- Claude 的 Docker/Postgres/Caddy 部署配置完成后，需要把部署结果补回本规划和部署文档。

**下一步 process**
- 建议优先接 REQ-001 主流程人工验收或 REQ-002 本地记忆管理 UI；若用户更想先做可展示功能，可接 REQ-009 探索前端。

### 2026-06-02 · Claude · REQ-010 后端可视化管理系统（MVP）完成
**完成**
- 用户选定 REQ-010(P2，与 Codex 的 Chat.tsx 零冲突，纯后端)。
- 鉴权：`database.py::User.role`(user|admin) + `deps.py::get_current_admin`。开通方式：环境变量 `ADMIN_PHONES="13900000099,..."`，命中手机号的账号首次访问管理 API 自动 `role=admin` 落库；无需手动 promote 端点。
- 聚合层 `repositories/admin_repo.py`：`overview`(用户数/活跃/24h 新增、累计充值/消耗/在外余额/24h 消耗/累计退款、付费订单数+营收、usage 按状态分组+24h 调用、分享公开/下架/累计安装)、`list_usage|ledger|orders|shares` + 序列化。全部基于商业/审计表，不触本地优先聊天内容。
- 路由 `routers/admin.py`：`GET /overview|usage|ledger|orders|shares|system`、`POST /shares/{id}/remove`(审核下架，复用 `explore_repo.unpublish`)、`GET /dashboard`(自包含 HTML 看板：顶部填管理员 token→localStorage 持久化→fetch 带 Bearer→概览卡+负载卡+四张表格+一键下架；纯原生 JS 零依赖)。
- `/system` 服务器负载：psutil 可选导入(try/except)，有则报 CPU/内存/磁盘，无则仅 uptime+janitor 指标；`requirements.txt` 已加 psutil。
- `main.py`：挂载 admin.router + 启动迁移 `users.role`。

**验证**
- `python -m compileall` + `import main` OK；8 条 `/api/admin/*` 路由全注册。
- TestClient 端到端(临时 sqlite + `ADMIN_PHONES`)：无 token→401、普通用户→403、管理员→200；overview 聚合准确(2 用户×100 注册赠送=200)；普通用户发布分享→管理员 `/shares/{id}/remove`→该分享 `GET /api/explore/{id}` 变 404；`/system`、`/dashboard`(text/html)、`/ledger|usage|orders` 全 200。

**待办缺口**
- 图表趋势(当前数字卡+表格，无折线/柱状趋势)、时间区间筛选、用户封禁/手动退款操作、管理员独立登录页(当前复用主登录 token)。
- 部署文档：上云时 `ADMIN_PHONES`、psutil 安装、看板路径需写进 `docs/BACKEND_ADMIN_PLAN.md`(后续)。

**下一步 process**
- 等 Codex 释放 `Chat.tsx` 后：补 REQ-009 探索前端 Tab(列表/详情/安装 + 分身设置页「分享到探索」)、REQ-008 按钮动效(framer-motion 已装)。
- 或继续后端：REQ-010 增强(趋势图/封禁/退款) 与上云收尾(Docker+Postgres+Caddy)。

### 2026-06-02 · Claude · REQ-009 探索功能后端（云端分享）完成
**完成**
- 认领时 REQ-009 为 P1；执行中发现 Codex 已锁定 `Chat.tsx`（REQ-007 我的页），遂避开前端、改做零冲突的探索**后端**。
- 数据表 `database.py::SharedPersona`（`shared_personas`）：仅存可分享人格卡（name/gender/relationship_desc/impression/avatar/core_memory/traits/catchphrases/tags + install_count/like_count/status/owner 快照），**绝不存聊天全文与私有记忆 corpus**（贴合 Local-first 隐私约束）。新表由 `create_all` 自动建，无需迁移脚本。
- `repositories/explore_repo.py`：publish / get / get_owned / list_public（q 模糊搜索 + hot/new 排序 + 分页）/ list_mine / increment_install / unpublish（软下架 status=removed）/ serialize_card|detail。
- `routers/explore.py`：`POST /publish`(需登录) · `GET /list`(可选登录) · `GET /mine`(需登录) · `GET /{id}` · `POST /{id}/install`(安装数+1 返回完整模板供本地导入) · `DELETE /{id}`(仅 owner 软下架)。`main.py` 已挂载。
- `schemas.py`：SharePublishRequest / SharedPersonaCard / SharedPersonaDetail。
- 前端 `src/api/explore.ts`：typed client + `detailToLocalPersona`（云端模板 → 本地 `personaStore.create` 入参，traits/catchphrases JSON 字符串解析为数组，情绪轴归基线）。

**验证**
- `python -m compileall` + `import main` OK；6 条 `/api/explore/*` 路由全部注册。
- 内存库全链路：publish → `list_public(q)` 命中 → install 自增 → 序列化 card/detail 通过 Pydantic 校验 → unpublish 后 get() 为 None、公开列表清零。
- 前端 `npx tsc --noEmit -p tsconfig.app.json` 全绿。

**待办缺口**
- 探索 Tab 前端 UI（列表/详情/安装按钮）—— 入口在 `Chat.tsx`，被 Codex 锁定，待解锁后做。
- 分身设置/详情页「分享到探索」按钮（调 `exploreApi.publish`）。
- like/举报、分页加载更多、安装去重（同一分享重复 install 仅计一次可后续加）。

**下一步 process**
- 用户已将 REQ-009 下调为 P3，并新增 REQ-010（后端可视化管理系统 P2）。建议下一步做 REQ-010 后端（与 Codex 的 Chat.tsx 无冲突，且可直接复用 explore 审核 + usage_events/ledger 聚合），或等 Chat.tsx 解锁后补 explore/我的页前端。已向用户确认方向。

### 2026-06-02 · Codex · REQ-001 端到端主流程 smoke 与 Android debug API 修复
**完成**
- 按 `用户需求.md` 的 P0 `REQ-001` 认领并执行主流程验证。
- 前端 legacy API 搜索无匹配：`/api/personas`、`/api/chat`、`/api/system/memory`、`/ws/` 未出现在 `src/`。
- 前端验证通过：`npx.cmd tsc --noEmit -p tsconfig.app.json`、`npm.cmd run build`。
- 后端验证通过：`python -m compileall Amber\amber-engine`、`python -c "import main; print('main import ok')"`。
- 后端 API smoke 通过：临时 SQLite 文件库下注册、余额 100、`/api/inference/distill` 无 key 免费返回、`/api/inference/chat` 无 key 返回 400 且退款、usage events 写入成功、legacy endpoints 不在 OpenAPI。
- 服务 smoke 通过：临时后端和 Vite dev server 均可启动并响应；已清理临时 18000/18080 进程。
- Android debug 重新构建、安装并启动成功；截图确认登录页正常显示。
- 修复 Android debug 包 API 地址：`scripts/android-build.mjs` 在 debug 模式默认注入 `VITE_API_BASE_URL=http://10.0.2.2:8000`，release/bundle 若仍为 `api.your-domain.com` 占位域名会阻止构建。
- 更新 `docs/MOBILE_BUILD.md`，说明 Android Emulator 本机测试需电脑后端 `python main.py`，debug 包默认使用 `10.0.2.2:8000`。

**待办缺口**
- Android 通过 `adb input` 自动填表不稳定，未能完成“创建分身→真实聊天→刷新持久化”的完整人工走查。
- 真实聊天仍需要用户配置有效 LLM key 或服务端 global key；无 key 路径仅验证了退款和错误提示链路。
- Web/Electron 的浏览器级自动点击走查未完成，因为当前项目未安装 Playwright；可后续添加专用 smoke test。

**验证**
- `npx.cmd tsc --noEmit -p tsconfig.app.json` 通过。
- `npm.cmd run build` 通过。
- `python -m compileall Amber\amber-engine` 通过。
- `python -c "import main; print('main import ok')"` 通过。
- `npm.cmd run android:build` 通过，产物 `android/app/build/outputs/apk/debug/app-debug.apk`。
- Android 安装启动通过：`com.amber.app/.MainActivity` 前台运行，登录页截图正常。
- 构建产物确认包含 `http://10.0.2.2:8000`，不再使用 `api.your-domain.com` 作为 debug API。

**下一步 process**
1. 用户手动或后续 Playwright/Appium 走查：注册/登录 → 创建分身 → 对话 → 刷新确认 IndexedDB 持久化。
2. 配置真实 LLM key 后验证 `/api/inference/chat` 成功回复、扣费、usage event。
3. 若要自动化 Web 主流程，新增 Playwright smoke test；若要自动化 Android 主流程，新增 Appium 或 Espresso 测试。

### 2026-06-02 · Claude · REQ-005/006 头像系统（数字生命头像 + 用户头像）
**完成**
- `src/lib/avatar.ts`（新）：`pickAvatar()` 打开文件选择 → canvas 居中裁剪为方图 + 压缩到 256px JPEG base64（避免撑爆 IndexedDB/localStorage）；`colorFromName()` 名字派生稳定色作无图兜底
- `CreatePersona.tsx`：头部 Sparkles 占位改为可点击头像按钮，选图存 `LocalPersona.avatar`
- `Chat.tsx`：新增 `PersonaAvatar` 组件（有图显示图，无图显示名字色块+首字）；左侧分身列表项重构为左圆形头像+右名字/印象；右侧控制台情绪头部用真实头像
- `SettingsModal.tsx`：顶部新增「我的头像」区（REQ-006），存 `localStorage amber_user_avatar`，保存时持久化
- 全部头像本地存储，不上传服务端

**验证**
- ✅ `npx tsc --noEmit -p tsconfig.app.json` 全绿
- ✅ `npx vite build` 通过（dist 255KB JS）

**待办缺口**
- IdentityDetail（分身详情/编辑页，若存在）的头像编辑未接入；当前编辑分身改头像需重建
- 用户头像目前只在设置弹窗设置，主界面暂未显示用户头像（聊天气泡仍用 Sparkles）

**下一步 process**
1. REQ-001 端到端走查（需用户侧真实 LLM key）
2. REQ-002 本地记忆管理 UI / REQ-003 本地 Janitor（情绪退火+定时结晶）

### 2026-06-02 · Codex · 用户需求模板与任务必读规则
**完成**
- 新增 `用户需求.md` 模板，作为产品需求唯一入口，覆盖需求总览、详情模板、前端功能、后端/API、本地数据、隐私合规、验收标准、验证命令与完成记录。
- 在模板中加入当前建议需求池：端到端主流程走查、本地记忆管理 UI、本地 Janitor、用户消耗与审计 UI。
- 更新 `AGENTS.md`：每次开始具体工作前必须先读 `用户需求.md`，再读 `working.md` 并认领任务；需求状态或范围变化时必须同步更新 `用户需求.md`。
- 2026-06-02 追加：按用户要求将 `用户需求.md` 压缩为简版，每个需求只需填写 6 项：优先级、想要什么、操作位置、使用方式、数据保存位置、完成标准；技术拆分留给 Codex/Claude 实现时补。

**待办缺口**
- `用户需求.md` 里的具体需求内容还需要用户继续填写业务细节、优先级和验收口径。
- 现有 `work.md` 历史任务尚未逐条反填到 `用户需求.md`，当前只放了建议需求池。

**验证**
- 已确认 `用户需求.md` 写入模板内容。
- 已确认 `AGENTS.md` 包含任务前读取 `用户需求.md` 的规则。

**下一步 process**
1. 用户先在 `用户需求.md` 中补充或修改需求，尤其是 P0/P1 的验收标准。
2. Codex/Claude 后续每次开工先按 `用户需求.md` 的需求编号认领任务。
3. 完成任务后同步更新 `用户需求.md`、`work.md`、`working.md` 三处状态。

### 2026-06-02 · Codex · 移除后端 legacy persona/chat/memory API 挂载
**完成**
- 根据 Claude 已完成的前端 Local-first 迁移，主 FastAPI app 不再导入/挂载 `routers/personas.py`、`routers/chat.py`、`routers/memory.py`。
- `/api/personas`、`/api/chat/{persona_id}`、`/api/system/memory/*` 已从 OpenAPI 消失，服务端主 API 面不再暴露云端 persona/chat/memory 持久化入口。
- 删除未被引用的旧前端 client：`src/api/chat.ts` 与 `src/api/persona.ts`，避免后续误调用已下线的 legacy endpoints / WebSocket。
- 保留旧 router 文件和 legacy 数据表/迁移代码，作为后续导出、迁移或清理的缓冲；本轮只收紧公网 API 面，避免误删内部仍复用的服务代码。

**待办缺口**
- `services/janitor_service.py`、legacy DB 模型和旧 router 文件仍在仓库内，后续可在确认不需要云端迁移工具后再删除。
- `ws.py` 仍挂载，但前端已移除 WebSocket；可另开一轮评估是否一起移除。
- 需要端到端人工走查新前端：注册/登录 → 本地创建 persona → inference 对话 → 刷新后 IndexedDB 持久化。

**验证**
- `python -m compileall Amber\amber-engine` 通过。
- `python -c "import main; print('main import ok')"` 通过。
- OpenAPI 抽查：旧 `/api/personas`、`/api/chat/{persona_id}`、`/api/system/memory/{persona_id}` 均不存在；`/api/inference/chat` 与 `/api/system/usage-events` 仍存在。
- 前端 legacy 调用搜索无匹配：`/api/personas`、`/api/chat`、`/api/system/memory`、`/ws/` 均不再出现在 `src/`。
- `npx.cmd tsc --noEmit -p tsconfig.app.json` 通过。
- `npm.cmd run build` 通过。

**下一步 process**
1. 用 Vite dev server 做人工端到端走查：注册/登录 → 本地创建 persona → inference 对话 → 刷新后 IndexedDB 持久化。
2. 若走查稳定，移除或归档 legacy router 文件、Janitor 云端 persona/message/corpus 逻辑和相关 schema。
3. 评估 `ws.py` 是否随 Local-first 架构退役，或改造成非持久化通知通道。

### 2026-06-02 · Claude · 前端 Chat/CreatePersona 切到 Local-first（最后一公里）
**完成**
- `Chat.tsx`：persona 列表 `personaStore.list()`、历史 `messageStore.list()`、移除 WebSocket（Local-first 下对话同步走 inference proxy，服务端不持有本地 persona 无法推送）
- `Chat.tsx handleSend` 改本地闭环：本地写 user msg → `buildContext`(本地 RAG) → `inferenceApi.chat` → 本地写 assistant msg → mood_delta 应用到本地 persona → memory_candidates 写本地 corpus → 刷新余额；402 触发充值弹窗
- `Chat.tsx` 退出登录前 `clearAllLocal()` 清本地数据（防同设备多账号串数据）
- `CreatePersona.tsx`：改 `personaStore.create`（本地）+ 可选 `inferenceApi.distill` 精炼（无 key 用原始输入，best-effort 不阻塞）+ raw_corpus 分块 `corpusStore.bulkAdd` 本地 pin
- `types/skill.ts`：LocalPersona 加控制台可选字段（intimacy 等）
- 全部 persona/message/corpus 读写转本地 IndexedDB，**不再调用任何 legacy 云端 persona/chat/memory API**

**验证**
- ✅ `npx tsc --noEmit -p tsconfig.app.json` 全绿（分类器恢复后已补跑）

**待办缺口**
- 端到端 `npm run dev` 人工走查（注册→建分身→对话→刷新持久化）待用户侧确认
- 本地 Janitor（情绪退火/记忆代谢/定时结晶）未实现，仅有 RAG 检索 + 单次记忆候选写入
- 同设备多账号靠登出清库隔离，未做 user 前缀 scope

**下一步 process**
1. 补跑 tsc + `npm run dev` 端到端：注册→设置Key→创建分身(本地)→对话(本地写+inference)→刷新页面数据仍在(IndexedDB 持久化验证)
2. 本地 Janitor：前端定时器调 `/api/inference/memory-summary` 写本地 corpus + 本地情绪退火
3. 前端稳定后移除后端 legacy persona/chat/memory router

### 2026-06-02 · Codex · 后端 usage_events / system_events 落库审计
**完成**
- 新增 `usage_events` 与 `system_events` 数据表模型，只记录 endpoint、model、status、token/碎片、耗时、错误类型等元数据，不保存 prompt、聊天内容、记忆文本或请求体。
- 新增 `repositories/usage_repo.py`，封装 usage/system event 写入、用户级查询和序列化。
- `/api/inference/chat|distill|memory-summary` 已接入审计：成功、余额不足、配置错误、模型调用失败都会写 `usage_events`；失败场景写脱敏 `system_events`，并保留原有扣费失败/退款逻辑。
- 新增用户级查询接口：`GET /api/system/usage-events` 与 `GET /api/system/events`，均需 `get_current_user`，只返回当前用户自己的事件。
- 修复 `database.py` 中已过期的 `is_override_active` 刷库守卫，避免 QQ 字段移除后新库反复 `drop_all`。

**待办缺口**
- 尚未做 admin 全局审计视图；当前只提供用户级事件查询，避免普通用户看到全局系统信息。
- `janitor_service.add_system_log` 仍主要写内存 `state.system_stats["logs"]`，尚未统一落 `system_events`。
- 真实管理后台 UI 尚未接入这两个新 endpoint。

**验证**
- `python -m compileall Amber\amber-engine` 通过。
- `python -c "import main; print('main import ok')"` 通过。
- 使用 `sqlite:///:memory:` 写入并查询 `usage_events` / `system_events` 通过。
- OpenAPI 抽查确认 `/api/system/usage-events`、`/api/system/events` 已注册。

**下一步 process**
1. 前端后台/设置页接入 `GET /api/system/usage-events`，展示自己的推理消耗、退款和错误状态。
2. 后端补 admin 权限模型后，再开放管理员级全局审计视图和筛选。
3. 需要统一系统日志时，把 `janitor_service.add_system_log` 改为同时写 `system_events`，但保留内存最近日志用于实时状态面板。

### 2026-06-02 · Codex · 后端 legacy API 标记与 inference 挂载检查
**完成**
- 确认 `main.py` 已挂载 `inference.router`，`/api/inference/chat|distill|memory-summary` 保持主推理入口。
- 将旧云端持久化 API 标记为 legacy/deprecated：`routers/personas.py` → `legacy-personas`，`routers/chat.py` → `legacy-chat`，`routers/memory.py` → `legacy-memory`。
- 未改旧接口路径和业务逻辑，因此迁移期旧客户端仍可调用；仅 `/docs`/OpenAPI 会显示 deprecated。
- 同步更新本文件「后端 API 契约」：persona/chat/memory 已进入本地优先迁移期，云端 API 仅保留兼容。

**待办缺口**
- 前端主聊天流仍需从旧 `personas/chat/memory` API 迁移到本地 DB + `/api/inference/chat`。
- 前端迁移完成后，再移除旧云端 router、相关 DB 持久化路径和旧数据迁移策略。
- usage_events / system_events 已由后续 Codex 任务落库；剩余是 admin 全局审计视图与 UI 接入。

**验证**
- `python -m compileall Amber\amber-engine` 通过。
- `python -c "import main; print('main import ok')"` 通过。
- OpenAPI 抽查：`/api/personas`、`/api/chat/{persona_id}`、`/api/system/memory/*` 均为 `deprecated=True`；`/api/inference/*` 未标 deprecated。

**下一步 process**
1. 前端已完成 `Chat.tsx` / `CreatePersona.tsx` 迁移；下一步做人工端到端走查。
2. 后端已补 usage_events / system_events；下一步做 admin 全局审计视图与 UI 接入。
3. 后续删除旧云端 persona/chat/memory router 文件，保留必要的数据导出或迁移工具。

### 2026-06-02 · Claude · 前端本地数据层 + inference client（Local-first 客户端）
**完成**
- `src/types/skill.ts`：SkillRequest/Response 类型对齐后端 inference schemas；新增 Local 实体类型 `LocalPersona/LocalMessage/LocalCorpus`
- `src/api/inference.ts`：`inferenceApi.chat/distill/memorySummary` 对接已实现的 `/api/inference/*`；`modelFromSettings()` 从本地 LLM 设置组装 model 描述符
- `src/lib/localdb.ts`：IndexedDB(idb) 封装，`personaStore/messageStore/corpusStore` 全套 CRUD + 级联删除 + `clearAllLocal()`；四端通用（Web/Electron/Capacitor WebView 均内置 IndexedDB，无需 Capacitor SQLite）
- `src/lib/localRag.ts`：本地 RAG（字符重叠×权重×pin 加成，移植后端召回逻辑）+ `buildContext()` 组装 recent_messages + retrieved_memories
- 装 `idb@8`；tsc 全绿；**未碰 Chat.tsx**（避免与现有云端调用冲突，留待迁移轮）

**待办缺口**
- Chat.tsx/CreatePersona.tsx 仍调用旧云端 `listPersonas/getHistory/sendMessage`，尚未切到本地 DB + inference
- 本地数据按设备存储，未做用户维度 scope 隔离（同设备多账号；后续可加 user 前缀）
- 本地 Janitor（情绪退火/记忆代谢/结晶）未实现，仅有 RAG 检索

**下一步 process**
1. Chat.tsx：persona 列表/历史/对话改走 `personaStore`/`messageStore` + `inferenceApi.chat`，回复后本地写 message+mood+memory_candidates
2. CreatePersona.tsx：改 `personaStore.create` + `corpusStore.bulkAdd`(raw_corpus)，蒸馏走 `inferenceApi.distill`
3. 旧云端 persona/chat/memory router（Codex 已标 deprecated）在前端迁移后移除

### 2026-06-02 · Codex · Android 模拟器启动问题诊断
**完成**
- 开始前已在 `working.md` 认领 `琥珀Amber数字生命UI/android/` 与 Android SDK/AVD 本机环境诊断；收尾时已释放认领。
- 确认 Android SDK 存在：`%LOCALAPPDATA%\Android\Sdk`，`platform-tools`、`emulator`、`system-images` 均存在。
- 确认 AVD 已存在：`Pixel_10_Pro`，target 为 `android-37.0`。
- 定位到当前 shell 缺少 `adb`、`emulator`、`java` PATH；可用 JBR 在 `%USERPROFILE%\.jdks\jbr-17.0.14`。
- 使用临时 `JAVA_HOME`/`ANDROID_HOME` 环境变量验证 Gradle，`:app:assembleDebug` 通过，产物 `android/app/build/outputs/apk/debug/app-debug.apk` 已重新生成。
- `emulator -accel-check` 报 `Android Emulator hypervisor driver is not installed on this machine`；`Win32_Processor.VirtualizationFirmwareEnabled=False`，说明 BIOS/UEFI 虚拟化当前关闭。

**待办缺口**
- 模拟器无法正常启动不是当前 Android 工程代码问题，主要阻塞于本机硬件虚拟化/Hypervisor 环境。
- 需要进 BIOS/UEFI 启用 Intel VT-x/Virtualization Technology；回到 Windows 后用管理员权限安装 Android Emulator Hypervisor Driver，或启用 Windows Hypervisor Platform。
- 当前 PowerShell 环境变量未持久化；命令行使用 `adb`/`emulator`/Gradle 前需设置 `JAVA_HOME`、`ANDROID_HOME` 和 PATH。

**下一步 process**
1. 重启进入 BIOS/UEFI，启用 Intel Virtualization Technology/VT-x（可同时启用 VT-d），保存后进 Windows。
2. 管理员 PowerShell 执行 `%LOCALAPPDATA%\Android\Sdk\extras\google\Android_Emulator_Hypervisor_Driver\silent_install.bat`，或在“启用或关闭 Windows 功能”里启用 Windows Hypervisor Platform 后重启。
3. 终端设置 JDK/SDK PATH 后运行 `emulator -avd Pixel_10_Pro`；启动完成后在 `android/` 运行 `.\gradlew.bat installDebug`。

### 2026-06-02 · Claude · 后端 inference proxy 实现（Local-first 架构服务端）
**完成**
- `schemas.py` 追加无状态推理模型：`InferencePersona/Context/Message/Model`、`InferenceChatRequest`、`MoodDelta`、`Usage`、`InferenceChatResponse`、`Distill*`、`MemorySummary*`（对齐 Codex 定义的 SkillRequest/Response 形态）
- `services/inference_service.py`（新，**纯函数式，零 DB 依赖**）：`run_chat`/`run_distill`/`run_memory_summary`；prompt 组装用请求里的临时 persona+context，复用 chat_service 的 MOOD 解析与文本清洗；LLM key 优先请求自带、回退服务端 global
- `routers/inference.py`（新）：`/api/inference/chat|distill|memory-summary`，强制 `get_current_user`，`wallet.consume` 扣费（chat=COST_PER_CHAT / distill=COST_PER_DISTILL / snapshot=COST_PER_SNAPSHOT），**模型调用失败自动 `credit` 退款**；distill 无 key 时返回确定性默认值且免费
- `main.py`：include inference router（两行）
- **不持久化**：全程不创建/读取 persona/message/corpus，符合 Local-first 服务端无状态要求
- 验证：distill 无 key→默认值+cost0+余额不变；chat 无 key→400+退款余额仍100；无 token→401；DB 零新增

**待办缺口**
- usage_events 已由后续 Codex 任务落库；当前仍缺 admin 全局审计视图与后台 UI。
- 日志脱敏：已不打印请求体，但未做结构化脱敏中间件
- 旧 `chat/personas/memory` 云端 router 仍在（前端尚未迁移到本地数据层，暂不能删）

**下一步 process（交接前端/Codex）**
1. 前端定义 `SkillRequest/Response` TS 类型 + `src/api/inference.ts`
2. 前端本地数据层（IndexedDB/Capacitor SQLite）落地后，chat 流程改走 `/api/inference/chat`
3. 迁移完成后，旧云端 persona/chat/memory router 标 legacy 并移除

### 2026-06-02 · Codex · Skill 改造计划：Local runtime + Cloud inference adapter
**完成**
- 将用户确认的 skill 适配方案写入协作日志：skill 不再默认依赖服务端保存 persona/chat/memory。
- 明确新分层：`Local skill runtime` 负责本地记忆读写、RAG 检索、prompt 编排、结果保存；`Cloud inference adapter` 只负责模型调用、计费、限流、内容安全和结构化返回。
- 明确 skill 调用形态：客户端发送临时上下文包，服务端返回 `reply`、`mood_delta`、`memory_candidates`、`usage`，由客户端决定是否写入本地长期记忆。

**目标接口形态**
```json
{
  "skill": "chat_reply",
  "persona": {
    "id": "local-persona-id",
    "name": "Amber",
    "traits": ["..."],
    "core_memory": "...",
    "mood": {
      "happiness": 50,
      "anger": 0,
      "anxiety": 0
    }
  },
  "context": {
    "recent_messages": [],
    "retrieved_memories": []
  },
  "input": {
    "content": "..."
  },
  "model": {
    "provider": "openai",
    "model_id": "gpt-4o-mini"
  }
}
```

**目标响应形态**
```json
{
  "reply": "...",
  "mood_delta": {
    "happiness": 1,
    "anger": 0,
    "anxiety": -1
  },
  "memory_candidates": [
    "建议写入本地长期记忆的摘要"
  ],
  "usage": {
    "prompt_tokens": 1200,
    "completion_tokens": 80,
    "cost_fragments": 1
  }
}
```

**待办缺口**
- 现有 skill/chat 路径仍在后端读取/保存云端 persona、messages、persona_corpus。
- 本地 skill runtime 尚未实现：本地 RAG、本地 Janitor、本地记忆结晶、本地保存策略仍待设计。
- 云端 inference adapter 尚未实现：`/api/inference/chat`、`/api/inference/distill`、`/api/inference/memory-summary` 仍待新增。

**下一步 process**
1. 前端/客户端先定义 `SkillContext`、`SkillRequest`、`SkillResponse` TypeScript 类型。
2. 后端新增 inference schemas 和 router，保证请求体不落盘、日志脱敏。
3. 客户端实现本地上下文组装：读取本地 persona、最近消息、RAG memories，调用 `/api/inference/chat`。
4. 客户端收到响应后本地写入 assistant message、mood、可选 memory_candidates。
5. 后续把云端 `chat/personas/memory` API 标记为 legacy 并从主客户端调用链移除。

### 2026-06-02 · Codex · 用户确认 Local-first memory + cloud inference proxy 架构
**完成**
- 用户确认：主版本改为“本地保存 persona / chat / memory，客户端向服务端发送临时上下文，服务端调用模型并返回回复”的架构。
- `work.md` 项目现状已更新为 **Local-first memory + cloud inference proxy**。
- 后端 API 契约已标注：persona/chat/memory 目标迁移为客户端本地数据层；服务端新增计划中的 `/api/inference/*`。
- 明确服务端默认不持久化聊天全文、人格记忆、导入语料，仅保留 auth、wallet、billing、usage_events、system_events 与 inference proxy。

**待办缺口**
- 现有代码仍是云端 FastAPI 保存 personas/messages/persona_corpus 的实现，尚未迁移。
- 前端/Android 还没有本地 SQLite/IndexedDB 数据层。
- 服务端还没有 `/api/inference/chat`、`/api/inference/distill`、`/api/inference/memory-summary`。
- 隐私政策、日志脱敏、请求体不落盘策略尚未实现。

**下一步 process**
1. 设计本地数据层 schema：`local_personas`、`local_messages`、`local_corpus`、`local_settings`。
2. 为 Web/Electron 选 IndexedDB 或 SQLite；为 Android 选 Capacitor SQLite。
3. 后端新增 inference router：接收 `persona`、`recent_messages`、`retrieved_memories`、`input`、`model`，返回 `reply`、`mood_delta`、`usage`，不写入 messages/corpus。
4. 迁移前端 chat 流程：本地检索上下文 → POST `/api/inference/chat` → 本地保存 user/assistant message 与 mood。
5. 将现有云端 persona/chat/memory API 标为 legacy，逐步从主客户端移除。

### 2026-06-01 · Codex · QQ bot 支持拆分到独立分支，主版本移除
**完成**
- 开始前已在 `working.md` 认领任务，确认当前无 Claude 锁定文件。
- 创建保留分支 `qq-bot-support`，用于后续维护 QQ bot / relay 版本；未切换当前工作区，避免打断现有未提交改动。
- 主版本后端移除 QQ runtime：不再导入/初始化 `QQBotRelay`，不再挂载 `/api/relay`，删除 `routers/relay.py`、`services/relay_service.py`，移除 `qq-botpy` 依赖。
- 移除 Chat/JANITOR/System/Persona 中的 QQ relay 调用、主动 QQ 下发、僵尸 relay 扫描和 bot credential schema 字段。
- 新主前端 API 类型移除 `is_override_active` / `override_interval`。
- 文档主线移除 QQ bot 指南入口、QQ 快速开始、QQ relay 路线图；`Readme/QQBOT_GUIDE.md` 已从主版本删除。
- `work.md` 后端 API 契约已移除 `/api/relay/*`。

**待办缺口**
- `qq-bot-support` 当前是分支引用，指向本次移除前的 HEAD；由于仓库存在大量未提交协作改动，它不是一个包含所有当前工作区改动的提交快照。若需要可发布的 QQ bot 分支版本，需要后续在该分支上整理并提交。
- 旧 Next.js 退役 UI `Amber/main_ui/` 仍保留历史 relay 组件文本；当前主版本使用 `琥珀Amber数字生命UI/`，未处理退役 UI。
- 数据库中历史 bot/relay 列不会被自动 DROP，只是主版本代码不再读写。

**验证**
- `python -m compileall Amber\amber-engine` 通过。
- `python -c "import main; print('main import ok')"` 通过。
- `npm.cmd run build` 于 `琥珀Amber数字生命UI/` 通过。
- `rg` 检查活跃后端与新主前端源码中无 `qq_relay`、`QQBotRelay`、`botpy`、`/api/relay`、`last_relay`、`bot_app` 引用。

**下一步 process**
1. 若需要真正维护 QQ bot 版本：切到 `qq-bot-support` 分支，恢复/整理当前需要的协作改动并提交。
2. 主版本继续推进 backend admin、多用户服务化和发布链路，不再规划 QQ bot/relay。
3. 若要彻底清理退役 Next.js UI，可单独认领 `Amber/main_ui/` 的历史 relay 组件清理任务。

### 2026-06-01 · Claude · P1 WebSocket 实时推送接入 (WP-F)
**完成**
- `routers/ws.py`：握手鉴权——`?token=` 校验 access token + `get_persona(owner_id)` 归属校验，非法 `close(4401)`（握手层返回 403）
- 前端 `src/pages/Chat.tsx`：选中分身时 `openChatSocket` 开连，`onmessage` 收 `{type:"message"}` 去重追加（覆盖 janitor 主动越界消息）、`{type:"mood"}` 实时刷新右侧情绪控制台；25s ping 保活；切换分身/卸载时清理
- 后端 `chat_service` 早已 broadcast message+mood，本次打通前端消费
- 验证：own persona+有效 token→OPEN；无 token→403（dev reload 模式下连续多连接测试有时序竞态，生产 `reload=False` 规避）

**待办缺口**
- 对话主路径仍用 REST `sendMessage`（AI 回复经 REST 返回 + WS 推送双通道，已去重）；可后续改纯 WS 触发
- `useChat` hook（早期写的）未在 Chat.tsx 使用，Chat.tsx 自带 WS 逻辑；可后续收敛到 hook

**下一步 process**
1. 后端上云（剩余 P0）：Docker + Postgres + Caddy
2. QQ 中继 / 记忆管理 UI 移植（后端就绪）

### 2026-06-01 · Codex · Android debug APK 构建成功
**完成**
- 开始前已在 `working.md` 认领 Android APK 构建任务，未触碰 Claude 当前锁定的 WebSocket/Chat 文件。
- 定位到 Android Studio JBR：`C:\software\Android studio\jbr`；Android SDK：`%LOCALAPPDATA%\Android\Sdk`。
- 更新 `scripts/android-build.mjs`，支持自动识别本机 Android Studio JBR 路径，并修复 Windows 下 `.cmd/.bat` spawn 调用问题。
- `npm.cmd run android:check` 通过。
- `npm.cmd run android:build` 完成：Vite production build 成功、`npx cap sync android` 成功、Gradle `assembleDebug` 成功。
- 生成 debug APK：`琥珀Amber数字生命UI/android/app/build/outputs/apk/debug/app-debug.apk`，大小 3,860,250 bytes，生成时间 2026-06-01 14:15:39。

**待办缺口**
- 当前 APK 是 debug 包，未签名 release 包，不能直接上架。
- 因项目路径包含中文，已在 `android/gradle.properties` 加 `android.overridePathCheck=true` 绕过 Android Gradle Plugin 路径检查；长期建议迁移到纯 ASCII 路径构建。
- Gradle wrapper 官方源下载不稳定，已将 `distributionUrl` 临时切到腾讯 Gradle 镜像。

**下一步 process**
1. 手机测试 debug APK：安装 `android/app/build/outputs/apk/debug/app-debug.apk`。
2. 若要 release APK/AAB：配置 Android keystore 后执行 `npm.cmd run android:build:release` 或 `npm.cmd run android:bundle`。
3. 上架前将生产 `.env.production` API 地址改成公网 HTTPS/WSS，并重新 build/sync。

### 2026-06-01 · Codex · Android Studio 安装后构建验证
**完成**
- 开始前已在 `working.md` 认领 Android 构建验证任务，未触碰 Claude 当前锁定的 WebSocket/Chat 文件。
- 检测到 Android SDK 默认目录存在：`%LOCALAPPDATA%\Android\Sdk`，且包含 `build-tools`、`platform-tools`、`platforms` 等目录。
- 增强 `scripts/android-build.mjs`：自动识别默认 Android SDK，并尝试识别常见 Android Studio JBR 路径。
- 更新 `docs/MOBILE_BUILD.md`：补充 Windows 下 `JAVA_HOME`、`PATH`、`ANDROID_HOME` 的配置示例。
- 验证 `node --check scripts/android-build.mjs` 通过。

**待办缺口**
- 当前终端仍无法执行 `java -version`，也未在常见 Android Studio 路径或用户目录搜索到 `jbr/bin/java.exe`。
- `npm.cmd run android:check` 仍失败于 `Java/JDK is not available`。
- 沙盒内执行 `npm.cmd run build` 仍因 Windows 沙盒权限失败：esbuild 读取 `vite.config.ts` 时报 `Cannot read directory "../../../../..": Access is denied`；沙盒外构建授权自动审核超时，未能代跑。

**下一步 process**
1. 用户确认 Android Studio 实际安装目录，找到其中的 `jbr` 目录；或单独安装 JDK 17。
2. 在 PowerShell 设置：
   `JAVA_HOME=<Android Studio jbr 或 JDK17 根目录>`，
   `PATH=$env:JAVA_HOME\bin;$env:PATH`，
   `ANDROID_HOME=$env:LOCALAPPDATA\Android\Sdk`。
3. 用户本机在 `琥珀Amber数字生命UI/` 执行 `npm.cmd run android:check`。
4. 检查通过后执行 `npm.cmd run android:build` 生成 debug APK。

### 2026-06-01 · Codex · Android 端构建脚本实现
**完成**
- 开始前已在 `working.md` 认领 Android 构建任务，未触碰 Claude 当前锁定的 WebSocket/Chat 文件。
- 新增 `琥珀Amber数字生命UI/scripts/android-build.mjs`，封装 Android 构建流程：环境检查 → `npm run build` → `npx cap sync android` → Gradle wrapper 构建。
- 新增 npm scripts：`android:check`、`android:sync`、`android:open`、`android:build`、`android:build:debug`、`android:build:release`、`android:bundle`。
- 更新 `docs/MOBILE_BUILD.md`，写入一键构建命令、APK/AAB 输出路径、JDK/Android SDK 环境要求。
- 验证 `node --check scripts/android-build.mjs` 通过；`npm.cmd run android:check` 能进入环境校验流程。

**待办缺口**
- 当前机器缺少可用 Java/JDK，`npm.cmd run android:check` 输出 `Java/JDK is not available`，因此无法在本机实际产出 APK/AAB。
- 需要安装 Android Studio 或 JDK 17，并配置 `ANDROID_HOME` 或 `ANDROID_SDK_ROOT` 后，再运行完整构建。
- 未执行完整 `npm run android:build`，因为会在 JDK 检查阶段失败。

**下一步 process**
1. 安装 Android Studio，确保 `java -version` 可用。
2. 设置 Android SDK 环境变量，例如 Windows 默认 `%LOCALAPPDATA%\Android\Sdk`。
3. 在 `琥珀Amber数字生命UI/` 执行 `npm.cmd run android:check`。
4. 环境检查通过后执行 `npm.cmd run android:build`，产物应在 `android/app/build/outputs/apk/debug/app-debug.apk`。

### 2026-06-01 · Codex · 写入后端可视化与多用户服务规划文档
**完成**
- 新增 `docs/BACKEND_ADMIN_PLAN.md`，系统整理后端可视化、管理设置、多用户服务化计划。
- 按用户要求将 QQ 机器人、QQ relay、中继配置、主动越界等外部触达能力降到最低优先级 P4。
- 明确 P0-P3 优先做 admin 权限、系统设置、dashboard、用户/账务管理、审计日志、云端部署和实时会话监控。
- 文档标注当前 Claude 正在锁定 WebSocket/Chat 链路，Codex 后续实现应避开相关文件。

**待办缺口**
- 规划已落文档，尚未开始实现。
- 需要用户确认是否按文档推荐顺序先做 P0-A/P0-B：`admin` 权限与 `system_settings`。

**下一步 process**
1. 用户确认后，Codex 认领不冲突文件并实现 `require_admin`、`system_settings` 表、settings service/repo/API。
2. 再实现 `/admin/settings` 前端页面。
3. QQ 机器人与中继 UI 保持 P4，等核心平台稳定后再启动。

### 2026-06-01 · Codex · 后端可视化与多用户服务 plan
**完成**
- 根据当前项目状态制定后端可视化、管理设置、多用户服务化的阶段计划。
- 计划避开 Claude 当前锁定的 WebSocket/Chat 文件；将实时聊天接入列为 Claude 完成后的衔接项。
- 明确优先级：先做管理后台基础与系统设置，再做租户/用户运营视图、可观测性、部署与权限加固。

**待办缺口**
- 尚未开始代码实现。
- 需要用户确认管理后台目标形态：内嵌在现有 Vite 前端，还是单独 `/admin` 应用。
- 需要 Claude 释放 WebSocket/Chat 文件后再对接聊天实时监控与消息流可视化。

**下一步 process**
1. 用户确认 plan 优先级与管理后台形态。
2. Codex 认领不冲突文件，先实现 `admin` 权限模型、系统设置表/API、管理后台页面骨架。
3. Claude 完成 WebSocket 后，再接入实时会话监控与在线状态可视化。

### 2026-06-01 · Codex · 修复 Vite Windows 预览启动脚本
**完成**
- 开始前已读取并认领 `working.md`，避开 Claude 当前锁定的 WebSocket/Chat 相关文件。
- 修改 `琥珀Amber数字生命UI/package.json` scripts：将 Unix-only 的 `VITE_ENABLE_ROUTE_MESSAGING=true ...` 改为 Windows 可执行的纯 Vite 命令。
- `dev` 改为 `vite`；`build:dev` 改为 `vite build --mode development --sourcemap`；`build:map` 改为 `vite build --mode route-map --sourcemap`，保留 route messaging 在非 production mode 下默认开启的现有逻辑。
- 验证 `npm.cmd run dev -- --help` 与 `npm.cmd run build:dev -- --help` 均可正常进入 Vite CLI，不再出现 `'VITE_ENABLE_ROUTE_MESSAGING' 不是内部或外部命令`。

**待办缺口**
- 完整 `npm.cmd run build:dev` 在当前沙盒内失败：Vite/esbuild 读取配置时报 `Cannot read directory "../../../../..": Access is denied`，属于 Windows 权限/沙盒访问问题；沙盒外重试授权自动审核超时，未完成完整构建验证。
- 尚未实际长驻启动 dev server；用户可在本机 PowerShell 运行 `npm.cmd run dev` 预览。

**下一步 process**
1. 用户本机在 `琥珀Amber数字生命UI/` 执行 `npm.cmd run dev`，打开 Vite 输出的地址；当前 `vite.config.ts` 配置端口为 `8080`。
2. 若仍遇到权限问题，用普通 PowerShell/CMD 在项目目录直接运行，或确认 OneDrive/安全软件未拦截 Vite/esbuild 读取配置。
3. Claude 当前锁定 `src/pages/Chat.tsx`、`src/api/chat.ts` 等 WebSocket 相关文件；Codex 后续继续避开这些文件，除非用户明确要求接管。

### 2026-06-01 · Claude · P0 多租户隔离 (WP-B-2)
**完成**
- `persona_repo`：`list_personas(owner_id)` / `get_persona(id, owner_id)` 加 user_id 过滤
- `routers/personas`：全端点强制 `get_current_user`，创建绑 `user_id=user.id`，增删改查/redistill/commit/clear-history 经 `_owned()` 校验归属（非属主返回 404）
- `routers/memory`：强制鉴权 + `_assert_corpus_owner`（corpus→persona→user 链校验）
- `routers/chat`：**融合** Codex 的 `get_optional_user`+碎片扣减，新增 user 存在时 persona 归属校验（避免破坏其兼容设计）
- 验证：A创建分身→B列表为空、B访问A的chat/删除A分身均 404、无token访问 personas 401。全绿。

**待办缺口**
- 老数据 `user_id=NULL` 的分身对所有用户不可见（开发库无价值，未迁移归属）
- `wallet/billing` 已是 user 维度（Codex 实现），无需改
- chat 仍用 `get_optional_user`（保留无 token pass-through）；如需彻底强制可后续改 `get_current_user`

**下一步 process**
1. 后端上云（P0 剩余）：Docker + Postgres + Caddy HTTPS
2. WebSocket 实时推送接入前端 useChat（后端 ws_manager 就绪）

### 2026-06-01 · Codex · `working.md` 防冲突认领规则
**完成**
- 确认 `working.md` 作为 Claude Code 与 Codex 的实时进行中任务看板。
- 本次工作开始前已在 `working.md` 认领协作文件，锁定 `AGENTS.md`、`working.md`、`work.md`。
- 将“开始任何具体工作前先读并认领 `working.md`，完成后释放或移到最近完成”的规则同步写入 `AGENTS.md`。
- 在 `working.md` 顶部补充冲突处理约定：发现目标文件/模块已被另一方认领时先暂停沟通。

**待办缺口**
- Claude Code 需要在其会话中同样执行“开始前认领、完成后释放”的流程。
- 目前 `working.md` 仍显示 Claude 正在处理 P0 多租户隔离；Codex 后续应避开其锁定的后端文件。

**下一步 process**
1. 每次 Codex 开始新任务：先读 `working.md`，检查冲突，再新增 IN PROGRESS 认领行。
2. 完成任务后：更新 `work.md` 交接日志，并把 `working.md` 的认领移到 RECENTLY DONE 或清空。
3. 若用户要求处理已被 Claude 锁定的文件，先向用户确认是否需要接管或等待 Claude 完成。

### 2026-06-01 · Codex · 协作日志规则确认
**完成**
- 确认 `work.md` 作为 Claude Code 与 Codex 的共享交接日志。
- 将“每次完成具体工作后必须记录完成项、待办缺口、下一步 process”的约定同步写入 `AGENTS.md`。
- 确认后续 Codex 收尾时会同时更新 `work.md`，方便 Claude Code 接续。

**待办缺口**
- Claude Code 也需要继续遵守同一日志格式；如它另起会话，应先读 `work.md` 和 `AGENTS.md`。
- 当前未处理 Vite Windows 启动脚本兼容问题，只完成协作流程约定。

**下一步 process**
1. 修复 `琥珀Amber数字生命UI/package.json` 中 Windows 不兼容的 env 写法，推荐改用 `cross-env` 或 Windows/CMD 兼容脚本。
2. 启动 Vite 预览新主前端，确认 `http://localhost:5173/` 可访问。
3. 若 UI 预览需要真实数据，再启动 `Amber/amber-engine` 后端并检查 API 连通。

### 2026-06-01 · Claude · 移动端工程化 (WP-M)
**完成**
- Capacitor 6.2.1 接入（core/cli/android/ios）
- 路由 `BrowserRouter → HashRouter`（WebView file:// 兼容）；`vite.config` 设 `base:'./'`
- `capacitor.config.ts`（appId=com.amber.app, webDir=dist）；`.env.production` API 地址模板
- `vite build` 通过（243KB JS / 1647 模块）→ `android/`、`ios/` 原生工程生成 + `cap sync`
- `docs/MOBILE_BUILD.md`：出包流程 / 真机热重载 / 签名 / IAP 合规

**待办缺口**
- 本机无 JDK/AndroidSDK/Xcode，**未产出 APK/IPA**（纯环境依赖）
- 移动端 API 必须连云端 → 阻塞于后端未上云
- iOS 的 `pod install`/Xcode 构建需 macOS

**下一步 process**
1. 后端上云（WP-B/WP-I）：Dockerfile + docker-compose(postgres/caddy) + 云部署，拿到 HTTPS 域名
2. 多租户隔离（WP-B-2）：personas/messages 按 `user_id` 过滤（当前**全局可见，是 bug**）
3. 出包：装 Android Studio → `cap open android` 出 APK
4. 推送插件 `@capacitor/push-notifications`（主动越界消息下发）

### 2026-06-01 · Claude · 桌面端切换 (WP-P)
**完成**：新前端 `electron-main.cjs`（加载 Vite :5173 / dist）；package.json `main` 字段；`launch.py` 改拉新前端，复用 main_ui 的 electron.exe（避免重下二进制触发 Defender 删 chrome_elf）。

### 2026-06-01 · Claude · 新前端商业化 (WP-F)
**完成**：API 层（client 含 JWT 拦截器+401刷新 / auth/wallet/chat/persona/billing）；zustand auth store；登录注册页；Chat 主界面接真实 persona/message/wallet+对话；充值页（dev 渠道闭环）；创建分身页；LLM 设置弹窗。TypeScript 全绿。
**缺口**：QQ 中继配置 UI、记忆管理 UI 未移植（后端就绪）；对话用 REST，WebSocket 实时推送未接（后端 ws_manager 已就绪）。

### 2026-06-02 · Codex · Android APK 安装到模拟器
**完成**
- 检测到模拟器 `emulator-5554` 在线。
- 使用 `adb install -r` 安装 `琥珀Amber数字生命UI/android/app/build/outputs/apk/debug/app-debug.apk`，结果为 `Success`。
- 确认安装包名为 `com.amber.app`。

**待办缺口**
- 无安装阻塞；如需验证运行时功能，下一步应启动 App 并确认后端/API 地址是否可达。

**下一步 process**
1. 需要手动启动时可执行 `adb -s emulator-5554 shell monkey -p com.amber.app 1`。
2. 若 App 打开后白屏或接口失败，优先检查移动端 API base URL 与后端云端/本机网络可达性。

### 2026-05-31 · Claude · 后端商业化 (M0+M1)
**完成**：单体 main.py 拆 routers/services/repositories；User/JWT 多租户表 + FragmentAccount/Ledger（原子扣减+流水）+ Order/SkuCatalog；支付 dev 渠道闭环 + 幂等 + 微信/支付宝/Apple 骨架；chat 接碎片扣减(402)。全链路验证通过。
**已修**：personas 500 回归（补 6 个 persona 列的 startup migration）。

---

## 全局待办缺口（汇总，按优先级）

| 优先级 | 项 | 归属 |
|--------|----|----|
| ~~P0~~ ✅ | ~~多租户隔离：personas/chat/memory 按 user_id 过滤~~（2026-06-01 完成） | 后端 |
| P0 | 后端上云：Docker + Postgres + Caddy HTTPS | DevOps |
| ~~P1~~ ✅ | ~~WebSocket 实时推送接入新前端~~（2026-06-01 完成，含 WS 鉴权） | 前端 |
| P1 | 真实支付验签（微信/支付宝/Apple IAP） | 后端，需商户号 |
| P2 | QQ 中继 / 记忆管理 UI 移植到新前端 | 前端 |
| P2 | 桌面 prod 打包（electron-builder 签名）+ 移动出包 | 打包 |
| P3 | 合规：隐私政策 / 账号删除入口 / 算法备案 | 合规 |

---

## Codex 协作提示
- 改后端契约 → 同步更新本文件「后端 API 契约」表
- 前端 API 调用集中在 `src/api/`，改 base 只动 `client.ts`
- 本机无移动构建工具链，APK/IPA 出包请在具备环境的机器执行
- 未提交改动较多，提交到 `refactor/architecture`，commit message 英文

### 2026-06-02 · Codex · Android 模拟器登录/注册失败修复
**完成**
- 复查 `用户需求.md` 与 `working.md` 后认领 Android 登录/注册失败诊断。
- 确认电脑后端 `http://127.0.0.1:8000/api/health` 正常，后端监听 `0.0.0.0:8000`。
- 确认 Android debug 构建资源中的 API base 为 `http://10.0.2.2:8000`，未残留旧 `127.0.0.1`。
- 修复 `琥珀Amber数字生命UI/android/app/src/main/AndroidManifest.xml`：显式加入 `android:usesCleartextTraffic="true"`，允许 debug 包访问本机 HTTP 后端。
- 重新执行 `npm.cmd run android:build`，构建成功；重新 `adb install -r` 安装到模拟器并启动 App。
- 后端直连注册 smoke 通过：`POST /api/auth/register` 返回 200。

**待办缺口**
- ADB 坐标输入在当前模拟器上未能稳定聚焦登录框，未完成自动化 UI 登录验收；需要用户手动在模拟器输入账号验证。
- 若手动仍失败，下一步应抓取点击后的 `adb logcat` 和后端请求日志，重点看是否有 Axios network error、401/409 或 WebView cleartext/CORS 报错。

**下一步 process**
1. 保持后端运行：`cd Amber/amber-engine && python main.py`。
2. 在模拟器手动注册或登录，建议用新手机号样式如 `13900000002`，密码 `123456`。
3. 若仍显示“操作失败请重试”，立即执行 `adb logcat -d -t 500` 并检查 `Chromium`/`Capacitor`/`10.0.2.2` 相关日志，同时确认电脑端 `http://127.0.0.1:8000/api/health` 仍正常。

### 2026-06-02 · Codex · Android Mixed Content 登录阻断最终修复
**完成**
- 用户手动重试仍失败后，重新抓取 `adb logcat`，确认明确错误：页面从 `https://localhost/#/login` 加载，但请求 `http://10.0.2.2:8000/api/auth/login|register`，被 Android WebView 作为 Mixed Content 阻断。
- 修复 `琥珀Amber数字生命UI/capacitor.config.ts`：将 `server.androidScheme` 从 `https` 改为 `http`，让 debug 包页面加载为 `http://localhost`，避免访问本机 HTTP 后端时被混合内容策略拦截。
- 重新执行 `npm.cmd run android:build`，构建成功；重新 `adb install -r` 安装并启动模拟器 App。
- 启动日志确认：`Capacitor: Loading app at http://localhost`，不再是 `https://localhost`。
- 自动坐标 smoke 使用测试账号 `13900000099 / 123456` 成功进入 Android 主界面，截图确认显示主界面与碎片余额 `100`。

**待办缺口**
- 当前修复面向 debug/本机后端测试。release 上架版本仍应使用 HTTPS 云端 API，避免生产环境明文传输。
- Android 端完整主流程仍剩创建分身、发送聊天、刷新持久化的人工/自动化验收。

**下一步 process**
1. 用户可直接在模拟器继续创建第一个分身并测试聊天。
2. 若要做上架包，必须配置 `VITE_API_BASE_URL=https://真实域名` 并重新构建 release/AAB。
3. 下一轮建议继续补 REQ-001 Android 主流程验收：创建分身 → 发送消息 → 本地持久化刷新检查。

### 2026-06-02 · Codex · Android 手机端主界面适配修复
**完成**
- 用户反馈手机端 UI 适配严重问题后，重新读取 `用户需求.md` 与 `working.md` 并认领移动端 UI 修复。
- 定位根因：`Chat.tsx` 虽然已有 mobile 分支，但 `mobile` 状态没有绑定屏幕宽度，Android 一直渲染桌面三栏布局，导致横向裁切。
- 修复 `琥珀Amber数字生命UI/src/pages/Chat.tsx`：新增 `matchMedia("(max-width: 767px)")` 响应式检测，让手机端进入单列移动布局。
- 将主容器高度改为 `h-[100dvh]`，并为移动端根容器增加 `w-full overflow-hidden`，降低状态栏/键盘/视口高度导致的裁切风险。
- 验证 `npx.cmd tsc --noEmit -p tsconfig.app.json` 通过。
- 验证 `npm.cmd run build` 通过。
- 验证 `npm.cmd run android:build` 通过，并重新安装 APK 到模拟器。
- Android 截图确认：主界面已变为单列聊天布局，不再出现右侧控制台横向裁切；左上菜单抽屉可打开，创建分身入口可见。

**待办缺口**
- 当前只修复聊天主界面最严重的移动端横向溢出；创建分身页、充值页、设置弹窗还需要单独做移动端细节走查。
- 底部 `探索/记忆/我的` tab 目前主要是视觉导航，后续需要接入真正的移动端功能页面或面板。

**下一步 process**
1. 继续 Android 端 REQ-001：从当前手机布局进入“蒸馏”创建分身，验证创建页是否适配。
2. 创建分身后验证聊天发送、回复、刷新持久化。
3. 再补一轮移动端 UI polish：设置弹窗、充值页、创建页、底部 tab 功能化。

### 2026-06-02 · Codex · 主题偏好跨页面保持修复
**完成**
- 用户反馈点击“蒸馏分身”后界面自动变回深色，重新读取 `用户需求.md` 与 `working.md` 并认领主题修复。
- 定位根因：`CreatePersona.tsx`、`Recharge.tsx`、`Login.tsx` 进入页面时都硬编码 `document.documentElement.classList.add("dark")`；`Chat.tsx` 的主题状态也是页面内私有状态，未持久化。
- 新增 `琥珀Amber数字生命UI/src/lib/theme.ts`，统一提供 `useThemePreference`、`useApplySavedTheme`，通过 `localStorage` 的 `amber_theme` 保存/读取主题偏好。
- 更新 `Chat.tsx`：明暗切换会写入主题偏好。
- 更新 `CreatePersona.tsx`、`Recharge.tsx`、`Login.tsx`：移除强制深色，改为应用已保存主题。
- 验证 `npx.cmd tsc --noEmit -p tsconfig.app.json` 通过。
- 验证 `npm.cmd run build` 通过。
- 验证 `npm.cmd run android:build` 通过并重新安装 APK。
- Android 实测：主界面切到浅色后打开左侧菜单点击“蒸馏”，创建页保持浅色，不再自动跳回深色。

**待办缺口**
- 当前修复的是主题状态一致性；创建页本身的移动端细节仍需继续走查。

**下一步 process**
1. 继续 Android 创建分身完整流程测试：填写表单 → 固化并唤醒 → 返回聊天页。
2. 验证返回聊天页后主题仍保持用户选择。

### 2026-06-02 · Codex · REQ-007 “我的”移动端页面
**完成**
- 开始前读取 `用户需求.md` 和 `working.md`，认领 REQ-007 “我的”。
- 后端新增 `GET /api/billing/orders`：需登录，只返回当前用户自己的订单，支持 `limit=1..100`，返回订单号、sku、金额、碎片数、渠道、状态、创建/支付时间。
- 同步更新本文件「后端 API 契约」billing 行，加入 `/api/billing/orders`。
- 前端新增 `src/api/system.ts`：`getUsageEvents()` 对接 `/api/system/usage-events`，用于 Token/推理消耗历史。
- 前端扩展 `src/api/billing.ts`：新增 `BillingOrder` 类型和 `listOrders()`。
- `Chat.tsx` 移动端底部“我的”tab 从占位变成实际账户页：
  - 用户信息卡：昵称/手机号/头像、本地分身数、碎片余额、已完成订单数。
  - 充值活动入口：跳转现有 `/recharge`，可继续使用 dev 即时到账闭环。
  - Token 消耗历史：展示最近推理调用、消耗、退款、状态、耗时、错误码。
  - 我的订单：展示充值订单、支付状态、订单号、支付渠道、创建/支付时间。
  - 帮助与客服：提供常见问题、后端连通和本地优先隐私说明。
  - 关于 Amber：展示版本/架构/隐私保存方式。
  - 最近钱包流水：展示最近赠送、充值、扣费等 ledger。
- 修复“我的”子页面切换时继承滚动位置的问题：切换面板自动滚动到顶部。
- Android debug APK 已重新构建并安装到模拟器；截图验证“我的”页和订单入口可用。

**验证**
- `npx.cmd tsc --noEmit -p tsconfig.app.json` 通过。
- `npm.cmd run build` 通过。
- `python -m compileall Amber\amber-engine` 通过。
- `python -c "import main; print('main import ok')"` 通过。
- OpenAPI 抽查 `/api/billing/orders` 已注册，当前运行服务访问该端点返回 401（无效 token），说明路由生效且需要鉴权。
- `npm.cmd run android:build` 通过，`adb install -r` 成功。

**待办缺口**
- “帮助与客服”目前是内置帮助说明，正式上线前还需要接在线客服/工单/邮箱等真实服务入口。
- “我的订单”已用后端真实订单表；但还没有时间筛选、订单详情页、退款入口。
- “我的”已优先完成移动端；桌面端如需同款账户中心，可后续单独补。

**下一步 process**
1. 继续 REQ-008：给“我的”子页面、抽屉、设置等交互加 iOS 风格滑入/过渡动画。
2. 或继续 REQ-001：用 Android 完整跑创建分身 → 聊天 → 刷新持久化。

---

## 2026-06-02 · Codex · REQ-008 按钮/窗口动效

- 已完成：在 Vite/Capacitor UI 中加入 iOS 风格 spring 动效；覆盖移动端底部 tab 切换、我的子页面滑入/返回、侧边抽屉滑出、加号菜单弹出、碎片不足弹窗、模型设置弹窗、桌面右侧控制台展开/收起；全局按钮加入触摸按压反馈。
- API 契约：无变化，本次只改前端交互表现。
- 验证：`npx.cmd tsc --noEmit -p tsconfig.app.json` 通过；`npm.cmd run build` 通过；`npm.cmd run android:build` 通过；`adb install -r android/app/build/outputs/apk/debug/app-debug.apk` 已安装到 `emulator-5554`；启动截图确认 App 非空正常进入登录页。
- 还差什么：充值页、创建分身页等非聊天主界面的独立页面还可继续补同样的进入/返回过渡；动画速度需要真机手感测试后微调。
- 下一步 process：优先按用户反馈微调手机端动效覆盖面；若继续做功能，建议转入 REQ-009 探索前端 UI 或 REQ-002 本地记忆管理 UI。
