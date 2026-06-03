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
- Codex 当前没有代码锁；刚完成 REQ-015 后端/后台兑换码与日志精简。
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
| REQ-015 兑换码 | 后端/API/后台已完成并部署；前端入口待接 | 等 Claude 释放前端锁后做“我的-激活兑换码” |

---

## 近期关键记录

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
