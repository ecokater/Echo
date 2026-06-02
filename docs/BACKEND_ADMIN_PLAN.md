# Backend Admin And Multi-User Service Plan

## 目标

把 Amber 从本地单用户实验系统推进到可服务多用户的后端平台，并提供可视化管理后台。优先解决账号、权限、系统设置、运营管理、可观测性和云端部署。QQ bot / relay 支持已移入 `qq-bot-support` 分支，不属于主版本规划。

## 总原则

- 管理后台优先内嵌到现有 Vite React 前端，路径使用 `/admin`，避免新增独立后台项目。
- 后端管理能力统一走 `/api/admin/*`，全部强制 admin 权限。
- 普通用户只能访问自己的 persona、message、memory、wallet、order。
- 所有系统级设置由后端保存和审计，前端只做展示与编辑。
- WebSocket/Chat 链路当前由 Claude 处理，Codex 后续实现应避开 `ws.py`、`ws_manager.py`、`services/chat_service.py`、`src/pages/Chat.tsx`、`src/api/chat.ts`，直到锁定释放。

## 优先级总览

| 优先级 | 模块 | 目标 | 说明 |
|--------|------|------|------|
| P0 | 多用户与权限底座 | 确保用户数据隔离、admin 权限、系统可控 | 必须先做 |
| P0 | 系统设置管理 | LLM、计费、注册、维护模式、Janitor 等配置可视化管理 | 管理后台第一阶段 |
| P1 | Admin Dashboard | 后端健康、用户、订单、用量、错误概览 | 可运营化 |
| P1 | 用户与账务管理 | 用户搜索、余额调整、订单查看、封禁/删除入口 | 多用户服务必需 |
| P2 | 可观测性与审计 | system events、错误日志、设置变更审计 | 便于排障 |
| P2 | 云端部署服务化 | Docker、Postgres、HTTPS、环境配置 | 对外服务必需 |
| P3 | 实时会话监控 | 在线用户、活跃会话、消息流状态 | 等 WebSocket 完成后接 |

## Phase 1: 多用户与权限底座 (P0)

### 后端能力

- 新增或确认 `User.role`：
  - `user`
  - `admin`
  - 后续可扩展 `operator`、`support`
- 新增依赖：
  - `require_admin`
  - `require_active_user`
- 所有 `/api/admin/*` 强制 `require_admin`。
- 普通用户端点继续强制 owner 校验：
  - personas 按 `user_id`
  - messages 经 persona 归属校验
  - memory/corpus 经 persona 归属校验
  - wallet/order 按 `user_id`

### 数据库与索引

- 确认并补齐索引：
  - `users.email`
  - `users.role`
  - `personas.user_id`
  - `messages.persona_id`
  - `persona_corpus.persona_id`
  - `orders.user_id`
  - `fragment_ledger.user_id`
- 老数据策略：
  - 开发库可不迁移，`user_id=NULL` 视为不可见或归档。
  - 生产库必须提供 owner 绑定脚本或人工归属流程。

### 验收标准

- 普通用户无法访问其它用户 persona/chat/memory/order。
- admin 能查看用户列表和基础统计，但不能泄露敏感 token/API key 明文。
- 无 token 访问受保护端点返回 401。
- 非 admin 访问 `/api/admin/*` 返回 403。

## Phase 2: 系统设置管理 (P0)

### 数据模型

新增 `system_settings` 表：

```text
id
key
value_json
scope: global | user | persona
owner_id
description
is_secret
updated_by
created_at
updated_at
```

### 首批设置项

- `llm.default_base_url`
- `llm.default_model`
- `llm.default_temperature`
- `llm.default_max_tokens`
- `billing.register_bonus_fragments`
- `billing.chat_cost_fragments`
- `auth.allow_registration`
- `system.maintenance_mode`
- `janitor.enabled`
- `janitor.interval_seconds`
- `janitor.test_mode`

### API

```text
GET /api/admin/settings
GET /api/admin/settings/{key}
PUT /api/admin/settings/{key}
POST /api/admin/settings/reset
GET /api/admin/system/status
POST /api/admin/system/maintenance
```

### 前端页面

```text
/admin/settings
```

页面分区：

- LLM 默认配置
- 注册与账号
- 碎片计费
- Janitor
- 系统维护

### 验收标准

- admin 可读写系统设置。
- 设置变更写入审计事件。
- secret 类型设置不在前端明文回显。
- 修改维护模式后普通用户端请求能得到明确提示。

## Phase 3: Admin Dashboard (P1)

### 页面

```text
/admin
/admin/users
/admin/personas
/admin/billing
/admin/health
```

### 指标

- 用户总数
- 今日新增用户
- 活跃用户数
- persona 总数
- message 总数
- memory/corpus 总数
- 今日聊天次数
- 今日碎片消耗
- 订单总数、成功订单、失败订单
- 后端健康状态：
  - API
  - database
  - janitor
  - billing
  - websocket

### API

```text
GET /api/admin/overview
GET /api/admin/health
GET /api/admin/metrics/daily
```

### 验收标准

- Dashboard 首屏能回答“系统现在是否健康、今天有多少用户和消耗”。
- 所有聚合查询有分页或时间范围限制，避免全表扫描拖垮服务。

## Phase 4: 用户与账务管理 (P1)

### 用户管理

```text
GET /api/admin/users
GET /api/admin/users/{id}
PATCH /api/admin/users/{id}
POST /api/admin/users/{id}/disable
POST /api/admin/users/{id}/enable
DELETE /api/admin/users/{id}
```

页面能力：

- 搜索用户
- 查看注册时间、最近活跃、persona 数、消息数、余额
- 禁用/启用账号
- 账号删除入口

### 账务管理

```text
GET /api/admin/orders
GET /api/admin/wallet/ledger
POST /api/admin/users/{id}/wallet/adjust
```

页面能力：

- 订单列表
- 订单状态筛选
- 用户碎片流水
- admin 手动加/扣碎片
- 调整原因必填并写审计

### 验收标准

- admin 能定位用户问题和账务问题。
- 所有余额调整必须有审计记录。
- 普通用户无法调用任何 admin 账务接口。

## Phase 5: 可观测性与审计 (P2)

### 数据模型

新增 `system_events` 表：

```text
id
level: info | warn | error
module
event_type
user_id
actor_user_id
resource_type
resource_id
message
metadata_json
created_at
```

### 事件范围

- auth register/login/logout/fail
- chat success/fail
- billing order_created/order_paid/order_failed
- wallet adjusted/charged/refunded
- janitor run/fail
- admin setting_changed/user_disabled/wallet_adjusted

### 页面

```text
/admin/logs
```

筛选条件：

- level
- module
- event_type
- user_id
- time range

### 验收标准

- 出错时能从 admin logs 查到错误模块和上下文。
- admin 操作全部可追踪。

## Phase 6: 云端部署服务化 (P2)

### 后端

- Dockerfile
- docker-compose
- Postgres
- Alembic 或明确的 startup migration 策略
- Caddy/Nginx HTTPS
- 环境变量管理：
  - database URL
  - JWT secret
  - default LLM config
  - billing secrets

### 前端

生产环境：

```text
VITE_API_BASE_URL=https://api.example.com
VITE_WS_BASE_URL=wss://api.example.com
```

### 验收标准

- 新用户可通过公网注册、登录、创建 persona、聊天、扣费。
- HTTPS 可用。
- 数据持久化在 Postgres。
- 服务重启不丢用户数据。

## Phase 7: 实时会话监控 (P3)

依赖 Claude 当前 WebSocket 工作完成后再接。

### 页面

```text
/admin/sessions
```

能力：

- 在线用户数
- 活跃 persona 数
- WebSocket 连接数
- 最近消息速率
- 失败消息列表

### 验收标准

- admin 能看到实时系统活跃度。
- 不展示完整私密聊天内容，默认只展示 metadata 和错误状态。

## 推荐实施顺序

1. P0-A: `role/admin` 权限与 `/api/admin/*` 基础保护。
2. P0-B: `system_settings` 表、settings service、settings admin API。
3. P0-C: `/admin/settings` 前端页面。
4. P1-A: `/api/admin/overview` 与 `/admin` dashboard。
5. P1-B: `/admin/users`、用户详情、禁用/启用。
6. P1-C: `/admin/billing`、订单与碎片调整。
7. P2-A: `system_events` 与 `/admin/logs`。
8. P2-B: Docker + Postgres + HTTPS 上云。
9. P3: WebSocket 完成后接实时会话监控。
10. 如需 QQ bot / relay 支持，切换到 `qq-bot-support` 分支维护，不并入主版本。

## 当前协作注意事项

- Claude 当前锁定 WebSocket/Chat 链路，Codex 不应修改这些文件。
- Codex 可优先认领：
  - `Amber/amber-engine/routers/admin.py`
  - `Amber/amber-engine/services/settings_service.py`
  - `Amber/amber-engine/repositories/settings_repo.py`
  - `Amber/amber-engine/schemas.py`
  - `琥珀Amber数字生命UI/src/pages/Admin*.tsx`
  - `琥珀Amber数字生命UI/src/api/admin.ts`
- 每次开始前必须更新 `working.md`，完成后更新 `work.md`。
