# Amber 协同工作日志（精简版）

> 目的：给 Codex / Claude 快速交接当前状态，减少 token 占用。久远逐条流水已压缩为摘要；需要旧细节时看 git 历史。
> 约定：每次完成具体工作后追加一条短记录；API 契约变化同步更新本文件。

---

## 当前架构

- 主线：Local-first memory + cloud inference proxy。
- 本地保存：persona、messages、corpus、聊天记录、私有记忆、导入语料。
- 服务端保存：auth、wallet、billing、usage/system audit、platform config、explore 分享卡、redeem codes。
- 服务端不保存聊天全文和私有记忆；推理接口只接收临时上下文。
- 主版本不做 QQ bot；QQ bot 保留为独立分支/低优先级方向。

## 目录速览

- `Amber/amber-engine/`：FastAPI 后端。
- `琥珀Amber数字生命UI/`：当前主前端，Vite + React + Capacitor/Electron。
- `Amber/main_ui/`：旧 Next.js/Electron 前端，基本退役。
- `docs/`：部署、移动端构建等文档。

## 当前协作状态

- Claude 正在前端批量任务：REQ-002/003/004/009 前端/011，见 `working.md` 锁定文件。
- Codex 当前没有代码锁；刚完成 REQ-015 前端兑换码入口。
- 不要碰 Claude 锁定的 `Chat.tsx`、`CreatePersona.tsx`、`src/components/*`、`src/lib/janitor.ts`、`src/lib/localdb.ts`、`src/api/explore.ts`，除非用户明确要求协调同一区域。

---

## API 契约

base dev: `http://127.0.0.1:8000`
server test: `http://129.204.151.118`

| 模块 | 端点 / 状态 |
|------|-------------|
| auth | `POST /api/auth/register|login|refresh`、`GET/DELETE /api/auth/me` |
| wallet | `GET /api/wallet/balance`、`GET /api/wallet/ledger` |
| billing | `GET /api/billing/skus`、`POST /api/billing/order`、`GET /api/billing/orders`、`POST /api/billing/callback/dev` |
| inference | `POST /api/inference/chat`、`/distill`、`/memory-summary`；无状态、鉴权+扣费+失败退款，不落盘聊天全文 |
| system | `GET /api/health`、`/api/system/status|config|reset|janitor-test-mode`、`GET /api/system/usage-events|events` |
| explore | `POST /api/explore/publish`、`GET /api/explore/list?q&sort=hot|new&limit&offset`、`GET /api/explore/mine`、`GET /api/explore/{id}`、`POST /api/explore/{id}/install`、`DELETE /api/explore/{id}`；云端只存可分享人格卡 |
| admin | `GET /api/admin/overview|usage|ledger|orders|shares|system`、`POST /api/admin/shares/{id}/remove`、`GET/POST /api/admin/pricing`、`GET /api/admin/dashboard` |
| redeem | `POST /api/redeem` 用户兑换；`POST /api/admin/redeem-codes/generate` 管理员生成；`GET /api/admin/redeem-codes` 管理员列表 |
| local-only | persona/chat/memory 主数据在前端 IndexedDB；旧云端 persona/chat/memory API 已从主 app 取消挂载 |

鉴权：
- 普通用户：JWT access token。
- 管理员：`User.role == admin`、`ADMIN_PHONES` 白名单自动提权，或固定 `ADMIN_STATIC_TOKEN`。
- 固定管理员令牌只允许 `get_current_admin`，不能访问普通用户接口。

碎片：
- 注册赠送 100。
- 对话/蒸馏/结晶价格走 `platform_config` 实时配置。
- 余额不足返回 402。
- 兑换码成功走钱包 `gift` 流水，`ref_id=redeem:<id>`。

---

## 需求状态摘要

| 需求 | 状态 | 下一步 |
|------|------|--------|
| REQ-001 主流程 | 基础 smoke、Android 启动、服务器 API 版 APK 已做；仍缺真实创建分身→聊天→刷新验收 | 配好平台模型 key 后做 Web/Android 完整闭环 |
| REQ-002 本地记忆管理 | ✅ Claude 前端完成(MemoryPanel:查看/搜索/置顶/删除/手动加) | 真机走查 |
| REQ-003 自动整理记忆和情绪 | ✅ Claude 完成(lib/janitor:情绪退火定时 + 记忆结晶节流自动/手动) | 真实 key 下验收自动结晶 |
| REQ-004 消耗与错误记录 | ✅ 已由 REQ-007 UsagePanel 覆盖(消费 usage-events) | 无 |
| REQ-005/006 头像 | 已完成 | 后续 UI polish |
| REQ-007 我的 | 移动端 MVP 已完成 | 补真实客服、订单详情/筛选/退款、桌面账户中心 |
| REQ-008 动效 | 核心路径完成 | 真机手感微调，补充值/创建页细节 |
| REQ-009 探索 | ✅ 前后端完成(ExplorePanel:浏览/搜索/获取/我的发布) | 真机走查 |
| REQ-010 管理后台 | 后端 MVP + dashboard + pricing + redeems 已完成部署 | 趋势图、筛选、封禁/退款后做 |
| REQ-011 聊天记录导入 | ✅ Claude 完成(lib/chatImport + ChatImportModal,创建页/「+」入口) | 真机走查不同导出格式 |
| REQ-012 硅基流动平台模型 | 前后端完成并部署；默认 `deepseek-ai/DeepSeek-V4-Pro` | 在后台或 `.env` 配 `PLATFORM_API_KEY` 后真实聊天验收 |
| REQ-013 固定管理员令牌 | 已部署 | 令牌泄露时轮换 |
| REQ-014 微信/支付宝支付 | 未做，P3 | 需要商户资质/回调域名/合规材料后再接 |
| REQ-015 兑换码 | 前后端完成，后台生成 + 用户兑换 + Android debug 已更新 | 登录后用后台生成的真实兑换码做一次人工验收 |
| REQ-016 改名 Echo | ✅ 全量(后端可见文本 + 前端品牌 + Android appId `com.echo.app`/包名/app_name)；保留内部存储键/库名/CSS类/类型名 | ✅ 后端已部署(线上标题=Echo Engine API)+ APK 已重建；CSS 设计注释等不可见文本未改 |
| REQ-017 多语言 | ✅ 全量页面+三覆盖层面板中英化（含钱包流水/用量/状态标签翻译、输入框占位符用分身名） | 仅余 PlusMenu 占位项/气泡小标签/日期格式等极少非关键串 |
| REQ-018 预设人格 | ✅ 5 个预设 + 创建页一键填充 | 可按需增减预设或加预设头像 |
| REQ-019 敏感词 | ✅ 前端拦发送/创建 + 后端扣费前校验，**线上闭环已验证**(400+零扣费) | 投放维护版词库或接内容安全 API 提升合规强度 |

---

## 近期关键记录

### 2026-06-04 · Claude · 后端部署(改名 + 敏感词 + distill 修复)上线

- 已部署:经本机 `scp`(部署密钥 `amber_deploy_ed25519`)上传 6 个改动文件到 `/home/ubuntu/Echo/Amber/amber-engine`(`main.py`、`routers/admin.py`、`routers/inference.py`、`services/inference_service.py`、`services/moderation_service.py`、`data/sensitive_words.txt`),`cd deploy && docker compose up -d --build backend`。
- 验证:`deploy-backend-1` Up(healthy)、`/api/health` 200、`/openapi.json` 标题=`Echo Engine API`、`inference/distill` 路由存在;moderation_service 成功 import(容器健康即证)。
- 含义:REQ-016 后端改名、REQ-019 敏感词后端扣费前校验、distill 误退款修复(`_loads_json_loose`)三项**线上生效**。
- 线上验证补充:`GET /api/admin/pricing` 确认 `api_key_set=True`、模型 `deepseek-ai/DeepSeek-V4-Pro`、单价 1/20/5 —— **平台 key 已配,真实出字可用**。REQ-019 真机闭环:注册临时号→发「赌博」敏感内容→`HTTP 400 内容包含敏感词，已拦截`→余额 100 未变(扣费前拦截零扣费)→删号清理,**线上生效已证**。
- 还差什么:前端新 APK/Web/Electron 各端重建分发;Android release/HTTPS 上架前置;REQ-014 真实支付(P3 外部阻塞)。
- 备注:`scp`/`ssh` 部署须用户在权限侧放行(agent 不自授);本批由用户授权后执行。

### 2026-06-04 · Claude · REQ-017 收尾(三覆盖层面板) + 占位符 + 弃用 amber.app

- **三大覆盖层面板 i18n**:`MemoryPanel`/`ExplorePanel`/`ChatImportModal` 全量走 `t()`(含 confirm/flash/toast/空态/按钮),i18n 字典扩到 ~190 键(新增 mem.*/exp.*/imp.* + common.loading/pick_persona)。REQ-017 视为完成(仅余 PlusMenu 占位项/气泡小标签/日期格式等非关键串)。
- **聊天输入框占位符**:`chat.input` 改为带 `{name}`,渲染 `和{active.name}说点什么…`(EN: `Say something to {name}…`)。
- **弃用旧包**:`adb uninstall com.amber.app` 成功,设备仅剩 `com.echo.app`;新 debug APK(指向服务器)重建并安装,启动验证占位符显示「和girl friend说点什么」。
- 验证:`tsc` + `vite build`(android:build 内含)通过;APK 启动截图通过。

### 2026-06-04 · Claude · 钱包流水翻译 + REQ-017 深层迁移 + 新 APK

- **钱包流水翻译(用户明确诉求)**:`entry.type` 原样显示 `consume_chat/refund_distill/...`,现经 `ledgerLabel(t,type)` 翻译为「对话消耗/蒸馏退款/记忆结晶/赠送福利」等(中英);同理用量 `usageLabel`、状态 `statusLabel` 也 i18n 化(`status.*` 未知值回退原 token)。
- **REQ-017 深层迁移**:i18n 字典扩到 ~120 键;`Chat.tsx` 全量(顶栏/侧栏/控制台/底部 tab/FragmentModal/我的总览 + 兑换码/用量/订单/帮助/关于面板)、`Recharge.tsx`(渠道/方式/toast/文案)、`CreatePersona.tsx`(标题/字段/性格/导入/按钮/校验)、`App.tsx` 启动页 全部走 `t()`。`usageLabel/statusLabel/ledgerLabel/errorMessage` 改为接收 `t`。
- **新 APK**:`com.echo.app` debug(指向 `http://129.204.151.118`)`assembleDebug` 成功(Java 因包名重编译);安装到 `emulator-5554`,`com.echo.app/.MainActivity` 启动,登录页显示「回声 Echo」+「唤醒你的数字生命」(i18n 生效)。
- 验证:`tsc --noEmit` + `vite build`(419KB) + APK 启动截图通过。
- 还差什么:覆盖层组件 `MemoryPanel`/`ExplorePanel`/`ChatImportModal` 与 PlusMenu/气泡小标签仍中文待迁移;**后端(改名+敏感词+distill 修复)仍需经 SSH 通道重新部署**;旧 `com.amber.app` 与新 `com.echo.app` 是两个独立包(本地数据不共享)。

### 2026-06-03 · Claude · REQ-016/017/018/019 新批次

- **REQ-016 全量改名**:后端用户可见文本(FastAPI 标题 `Echo Engine API`、启动日志、管理后台 `<title>/<h1>`)→ 回声/Echo;前端品牌(Login/Chat/Recharge「琥珀 Amber」→「回声 Echo」、默认陪伴名「琥珀」→「回声」);Android `capacitor.config.ts` appId `com.amber.app`→`com.echo.app` + appName、`build.gradle` namespace/applicationId、`strings.xml` app_name/包名/url_scheme、`MainActivity.java` 迁至 `com/echo/app`(旧 `com/amber` 已删)。**保留**:`amber_*` localStorage 键、IndexedDB `amber-local` 库名、CSS `bubble-amber-rim`、`AmberUser/AmberDB` 类型名、`role:"amber"` 消息类型字面量(改则丢用户本地数据或大范围联动)。
- **REQ-017 i18n MVP**:新增 `lib/i18n.ts`(zh/en 字典 + `useI18n`/`translate`,缺失键回退中文)、`stores/locale.ts`(zustand,持久化 `echo_locale`);`SettingsModal` 内加「中文/English」切换;覆盖 Login 全量 + Settings + 品牌/底部导航键。剩余:Chat 深层文案/Recharge/Create 渐进迁移。
- **REQ-018 预设人格**:新增 `lib/presets.ts`(5 个预设含阈值+核心记忆);`CreatePersona` 顶部「从预设开始」chips 一键填充。
- **REQ-019 敏感词**:前端 `lib/moderation.ts`(NFKC+分隔规避+中英 SEED) 拦 聊天发送/创建分身;后端 `services/moderation_service.py` 在 `routers/inference.py` chat/distill **扣费前** `_enforce_moderation`,命中记 `status=blocked`(0 扣费)+ HTTP 400;词库可经 `data/sensitive_words.txt`/`SENSITIVE_WORDS_EXTRA` 热扩展。
- 验证:后端 `compileall` + `main import`(title=Echo Engine API)+ 审核 6 类单测 PASS;前端 `tsc --noEmit` + `vite build`(419KB)通过。
- 还差什么:**后端(改名+moderation+distill 修复)需重新部署服务器**;Android 需重建 APK(appId 变了是全新安装,不与旧 `com.amber.app` 升级覆盖);REQ-017 深层文案渐进迁移。

### 2026-06-03 · Claude · 修复 distill 误退款(JSONDecodeError)

- 现象:钱包出现 `consume_distill -20` 紧跟 `refund_distill +20`。审计 `GET /api/admin/usage` 坐实:该 distill 事件 `status=provider_error`、`error_code=JSONDecodeError`、latency 15s。
- 根因:`inference_service.run_distill` 用 `response_format=json_object` 但对返回值做了**无保护的 `json.loads`**;DeepSeek-V4-Pro(reasoning 取向)返回内容可能带 ```json 围栏/思维链/多余文字,解析即崩 → 通用 except 触发失败退款 + 502。chat 不解析 JSON 故照常成功(平台 key 其实已通)。
- 已修:新增 `_loads_json_loose()`(剥代码围栏 → 直接 loads → 失败则正则抽取最外层 `{...}` → 仍失败返回 `{}`),`run_distill` 改用它并对 `core_memory` 缺省优雅降级;解析失败不再抛异常/退款,退化为确定性默认值。
- 验证:`py_compile` OK;单测覆盖 纯/围栏/前缀/思维链/垃圾/空 六类输入全部符合预期。
- 还差什么:**需重新部署后端**到服务器才生效(本地已改未部署)。另记一个次要 bug:审计 `provider/model_id` 记的是客户端占位 `openai/gpt-4o-mini` 而非实际平台 `DeepSeek-V4-Pro`(`_model_meta` 读 `req.model` 未读解析结果),后台用量/定价统计会失真,待后续修。

### 2026-06-03 · Claude · 前端整批功能上线(server-API debug APK)

- 已完成:`琥珀Amber数字生命UI` 以 `VITE_API_BASE_URL=http://129.204.151.118`、`VITE_WS_BASE_URL=ws://129.204.151.118` 重建 debug APK(vite build + cap sync + gradle assembleDebug 全绿,JS 412.93KB),含 REQ-002/003/009/011(Claude)+ REQ-015(Codex)全部前端。
- 已部署:`adb install -r` 到 `emulator-5554`,`com.amber.app/.MainActivity` 启动正常无崩溃;bundle 已编入服务器 URL(1 处 API_BASE_URL),`/api/health` 200;首屏底部导航四 tab(对话/探索/记忆/我的)齐全。
- 还差什么:聊天真实出字仍卡在服务器未配 `PLATFORM_API_KEY`;正式上架需 HTTPS 公网域名(debug 走 cleartext),release 被 `.env.production` 占位域名拦截。
- 下一步 process:服务器配真实平台 key 后,在该 APK 上走 创建分身→聊天→刷新 + 探索发布/获取 + 记忆整理 + 兑换码 闭环验收。

### 2026-06-03 · Codex · REQ-015 前端“我的-激活兑换码”

- 已完成：新增 `琥珀Amber数字生命UI/src/api/redeem.ts`，封装 `POST /api/redeem`。
- 已完成：`Chat.tsx` 的“我的”页新增“激活兑换码”入口和子面板；输入兑换码后提交，成功显示获得碎片和余额，刷新余额/钱包流水；失败显示后端错误。
- 验证：`npx.cmd tsc --noEmit -p tsconfig.app.json` 通过；`npm.cmd run build` 通过；设置 `VITE_API_BASE_URL=http://129.204.151.118` 后 `npm.cmd run android:build` 通过；APK 已安装并启动到 `emulator-5554`。
- 还差什么：未用真实登录账号和后台生成的真实兑换码做人工兑换验收。
- 下一步 process：管理员后台生成一个 100-1000 碎片兑换码，用户在 Android/Web “我的-激活兑换码”输入，确认余额和最近钱包流水刷新。

### 2026-06-03 · Claude · 剩余需求整批前端 REQ-002/003/009/011（004 已被 007 覆盖）

- 已完成：`MemoryPanel`(本地记忆查看/搜索/置顶钢印/删除/手动加)、`ExplorePanel`(广场浏览/搜索/热门·最新/一键获取安装到本地/我的发布·下架)、`ChatImportModal` + `lib/chatImport.ts`(微信/QQ txt 容错解析+500字分块,本地)、`lib/janitor.ts`(情绪退火:5min+启动按空闲退火至基线、聊天时跳过;记忆结晶:满 24 条后台节流自动调 memory-summary 写本地 corpus + 记忆库手动「整理」)。
- 接入 `Chat.tsx`:移动端 memory/explore tab、桌面 LeftNav「探索/记忆库」浮层、「+」导入聊天记录、定时退火、对话后 `maybeAutoOrganize`;`CreatePersona.tsx` 加「导入微信/QQ记录」。
- 验证：tsc 0 + vite build 通过(409KB JS)。仅改前端,未碰后端与 Codex 的 redeem 文件。
- 还差：真机/真实平台 key 下走查(自动结晶计费、不同导出格式)。Codex 的 REQ-015 前端「我的-激活兑换码」现可接(Chat.tsx 锁已释放)。

### 2026-06-03 · Codex · 协作日志精简

- 已完成：把 `work.md` 从长流水压缩为当前架构、API 契约、需求状态、近期关键记录。
- 已完成：把 `working.md` 压缩为当前锁 + 最近关键完成项。
- 还差什么：无。
- 下一步 process：后续每次只追加短记录；超过几天的流水继续压缩到摘要。

### 2026-06-03 · Codex · REQ-015 兑换码后端/API/后台工具

- 已完成：新增 `redeem_codes` 表、`repositories/redeem_repo.py`、`routers/redeem.py`。
- 已完成：用户 `POST /api/redeem`；管理员 `POST /api/admin/redeem-codes/generate`、`GET /api/admin/redeem-codes`。
- 已完成：后台 dashboard 增加 `Redeem Codes` 生成工具、批量结果和最近列表。
- 已部署：服务器 backend 已重建；`/api/health` 200；OpenAPI 新路由存在；管理员兑换码接口 200。
- 验证：本地 compile/import/TestClient 通过，生成→兑换→重复兑换 409。
- 还差什么：前端“我的-激活兑换码”入口待 Claude 释放前端锁后接入。
- 下一步 process：前端接 `POST /api/redeem`，成功后刷新余额/流水，再重建 Android APK 验收。

### 2026-06-03 · Codex · Android 模拟器更新到服务器 API

- 已完成：debug APK 用 `VITE_API_BASE_URL=http://129.204.151.118`、`VITE_WS_BASE_URL=ws://129.204.151.118` 重建并安装到 `emulator-5554`。
- 验证：App 启动进入登录页。
- 还差什么：登录后真实聊天验收；正式上架需要 HTTPS release。

### 2026-06-03 · Codex · 固定管理员令牌

- 已完成：新增 `ADMIN_STATIC_TOKEN`，仅管理守卫接受；普通用户接口不接受。
- 已部署：服务器 `.env` 和 `/home/ubuntu/admin-static-token.txt` 已写入固定 token，本机私密副本在 `%USERPROFILE%\.ssh\amber_admin_static_token.txt`。
- 验证：admin overview/pricing 200，wallet with static token 401。
- 注意：不要把 token 写入日志、截图或仓库；泄露则重新生成并重启 backend。

### 2026-06-03 · Codex/Claude · REQ-012 平台模型与部署

- 已完成：硅基流动作为默认平台模型，默认模型 `deepseek-ai/DeepSeek-V4-Pro`。
- 已完成：后台 `GET/POST /api/admin/pricing` 可实时调整 provider base_url/model/key/碎片单价/启用状态。
- 已完成：前端默认发空 `model:{}` 走平台模型，自带 key 收到高级设置。
- 已部署：服务器 backend 已重建，dashboard 包含平台定价面板。
- 还差什么：服务器需要在后台或 `.env` 配置真实 `PLATFORM_API_KEY` 后做聊天验收。

### 2026-06-02 · 架构里程碑摘要

- Local-first 改造完成：前端 IndexedDB 保存 persona/messages/corpus；后端旧 persona/chat/memory 云端 API 从主 app 取消挂载。
- 后端 inference proxy 完成：chat/distill/memory-summary 无状态推理，扣费、退款、usage audit。
- 后端 explore 分享 API 完成：只存可分享人格卡，不存聊天全文/私有记忆。
- 后端 admin dashboard MVP 完成：overview/usage/ledger/orders/shares/system/share remove。
- 移动端基础修复完成：Android cleartext/mixed content、主界面单列适配、主题偏好、我的页、核心动效。
- 部署配置完成：Docker + Postgres + Caddy，服务器 SSH/SFTP 可用。

---

## 常用验证

后端：

```powershell
python -m compileall Amber\amber-engine
python -c "import sys; sys.path.insert(0, r'Amber\\amber-engine'); import main; print('main import ok')"
```

Vite UI：

```powershell
cd 琥珀Amber数字生命UI
npm.cmd run build
npx.cmd tsc --noEmit -p tsconfig.app.json
```

Android：

```powershell
cd 琥珀Amber数字生命UI
npm.cmd run android:build
```
