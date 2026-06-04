# Echo 商业化重构任务计划书

> 基线决策（已确认）：**自建 FastAPI 全栈** · **Vite SPA 重建（参照设计稿）** · **国内市场优先**
> UI 基线：`回声Echo数字生命UI/`（Lovable 设计稿，Vite + React18 + shadcn + Supabase 范式）
> 后端基线：`Echo/echo-engine/`（已重构 routers/services/repositories）
> 文档版本：v1.0

---

## 0. 产品形态（源自设计稿）

| 区域 | 桌面（三栏 Bento） | 移动（沉浸式） |
|------|-------------------|---------------|
| 左栏 280px | 导航 + 历史对话 + 实验室入口 + **碎片收集** + 设置 | 侧滑抽屉（复用左栏） |
| 中栏 flex-1 | 主聊天：TopNav(**碎片余额徽章**/明暗/控制台) + 气泡(normal/**主动查岗**/**情绪共鸣**) + 输入区(+号: 图片/记忆截断/唤起记忆节点/情绪快照) | 全屏聊天 + 底部4标签(对话/探索/记忆/我的) |
| 右栏 320px | **数字生命控制台**：情绪状态机(亲密度/活跃度/好奇心) + 参数微调(回应温度/主动性/记忆深度) + 记忆代谢图谱(预留) | 收进控制台页 |

**设计语言**：Glassmorphism 2.0（`.glass`/`.glass-strong` backdrop-blur 24-40px）+ OKLCH 回声色系（H45）+ `--fragment` 商业化专属辉光色 + 明暗双主题 + framer-motion 弹性动画。

**核心商业化**：记忆碎片（Memory Fragment）——静默式变现，余额角标 + 耗尽柔和引导弹窗，绝不打断沉浸感。

---

## 1. 总体架构

```
┌────────────────── 云服务器 (Docker Compose) ──────────────────┐
│  Caddy (反代 + 自动 HTTPS/WSS)                                 │
│    ├─ FastAPI (gunicorn+uvicorn workers)                      │
│    │    routers/  services/  repositories/                   │
│    │    + auth(JWT)  + wallet(碎片)  + billing(支付)          │
│    │    + Echo 引擎: chat/RAG/janitor/情绪机                │
│    ├─ PostgreSQL (用户/碎片/订单/persona/message/corpus)     │
│    ├─ Redis (会话/限流/分布式锁-碎片原子扣减)                 │
│    └─ MinIO/OSS (头像/语料/图片)                              │
└───────────────────────────┬───────────────────────────────────┘
                            │ HTTPS REST + WSS
        ┌───────────────────┼────────────────────┐
   ┌────▼─────┐       ┌──────▼──────┐      ┌──────▼──────┐
   │ Web/桌面  │       │  Android    │      │    iOS      │
   │ Vite SPA  │       │ Capacitor   │      │ Capacitor   │
   │ +Electron │       │ 微信/支付宝  │      │ Apple IAP   │
   │ 微信Native│       │ +国内渠道    │      │ (强制)      │
   └───────────┘       └─────────────┘      └─────────────┘
```

---

## 2. 数据模型（PostgreSQL）

### 2.1 新增表

```sql
users(id, phone/email, password_hash, nickname, avatar_url, created_at, status)
fragment_account(user_id PK, balance BIGINT, total_recharged, total_consumed, updated_at)
fragment_ledger(id, user_id, delta BIGINT, type, ref_id, balance_after, created_at)
   -- type: recharge|consume_chat|consume_distill|consume_snapshot|refund|gift
orders(id, user_id, sku, amount_cny, fragments, channel, status, out_trade_no UNIQUE,
       platform_txn_id, created_at, paid_at)
   -- channel: wechat|alipay|apple_iap|google_play ; status: pending|paid|failed|refunded
sku_catalog(sku, title, fragments, price_cny, apple_product_id, active)
```

### 2.2 现有表改造

- `personas` / `messages` / `persona_corpus` 三表全部加 `user_id` 外键 + 复合索引 `(user_id, ...)`
- `repositories/*` 所有查询追加 `user_id` 过滤（多租户隔离）
- **情绪模型演进**：保留底层 `happiness/anger/anxiety`（驱动 prompt），新增关系维度 `intimacy/activity/curiosity`（对应设计稿控制台展示）；参数微调 `response_temp/proactivity/memory_depth` 存为 persona 配置字段

---

## 3. 记忆碎片经济模型

| 环节 | 设计 |
|------|------|
| **消费点** | 普通对话 N 碎片/条；唤起记忆节点、情绪快照、人格蒸馏(重操作) 阶梯计费；规则存 `sku_catalog`/配置表，可热调 |
| **原子扣减** | `UPDATE fragment_account SET balance=balance-:cost WHERE user_id=:u AND balance>=:cost RETURNING balance` + Redis 分布式锁防并发超扣；扣减与 `fragment_ledger` 写入同事务 |
| **耗尽引导** | 余额 < 阈值触发 `FragmentModal`（设计稿已实现 UI），后端 `/api/wallet/balance` 实时返回 |
| **充值** | 下单 → 拉起支付 → 异步回调验签 → 幂等入账（`out_trade_no` 唯一约束防重复发放）|
| **对账** | 每日定时拉取支付平台账单与 `orders` 比对；`fragment_ledger` 全流水可审计 |

---

## 4. 后端工作包 WP-B（FastAPI）

| 编号 | 任务 | 关键文件 | 工时 |
|------|------|---------|------|
| B-0 | **前置**：完成 `main.py` 精简——接入 routers/services/repositories，挂载 ws router（当前仍是旧单体） | `main.py` | 0.5d |
| B-1 | SQLite→PostgreSQL，`DATABASE_URL` 环境变量，连接池 | `config.py` `database.py` | 1d |
| B-2 | 三表加 `user_id` + repositories 全量加租户过滤 | `database.py` `repositories/` | 2d |
| B-3 | 用户系统 + JWT(access/refresh) + 手机号/密码登录注册 | 新增 `routers/auth.py` `services/auth_service.py` | 2.5d |
| B-4 | WebSocket 握手鉴权 + persona 归属校验 | `routers/ws.py` `ws_manager.py` | 1d |
| B-5 | **碎片钱包**：账户/流水/余额查询/原子扣减服务 + Redis 锁 | 新增 `routers/wallet.py` `services/wallet_service.py` | 3d |
| B-6 | 对话/蒸馏/快照接入碎片扣减（消费前置校验，余额不足返回 402） | `services/chat_service.py` `routers/personas.py` | 2d |
| B-7 | **支付**：微信支付(Native扫码+APP) + 支付宝；下单/回调验签/幂等入账/订单状态机 | 新增 `routers/billing.py` `services/payment/{wechat,alipay}.py` | 4d |
| B-8 | Apple IAP 服务端校验（iOS 端收据验证 + 入账，复用 orders） | `services/payment/apple_iap.py` | 2d |
| B-9 | LLM Key 服务端加密托管（按 user，替代明文每请求携带） | `services/chat_service.py` `schemas.py` | 1.5d |
| B-10 | 对账定时任务 + 管理端流水查询 | `services/janitor_service.py`(扩展) | 1.5d |

### 关键 API 新增
```
POST /api/auth/register | /login | /refresh | /logout
GET  /api/wallet/balance
GET  /api/wallet/ledger
GET  /api/billing/skus
POST /api/billing/order            # 创建订单，返回支付参数
POST /api/billing/callback/wechat  # 异步回调(验签)
POST /api/billing/callback/alipay
POST /api/billing/verify/apple     # iOS 收据校验
```

---

## 5. 前端工作包 WP-F（Vite SPA 重建）

以 `回声Echo数字生命UI/` 为基座，移植现有业务组件，对接 FastAPI。

| 编号 | 任务 | 来源/目标 | 工时 |
|------|------|----------|------|
| F-0 | 设计稿项目纳入仓库，建立 `pages/` 路由骨架（chat/explore/memory/me/auth/recharge） | `App.tsx` 拆分 | 1d |
| F-1 | API 层：`src/api/` 按 demo.ts 范式，axios 实例 + JWT 拦截器 + 401 刷新；指向 FastAPI | 新增 `src/api/*.ts` | 2d |
| F-2 | 状态层：zustand store（auth/wallet/persona/chat）+ react-query 数据获取 | `src/stores/` | 2d |
| F-3 | 实时层：WebSocket hook（移植现有 `useChat` 逻辑，带 JWT 握手） | `src/hooks/useChat.ts` | 1d |
| F-4 | 三栏 Bento + 移动双形态（设计稿已具雏形，补全交互） | `App.tsx`→`pages/chat` | 2d |
| F-5 | **碎片系统**：余额徽章(已设计) + 耗尽弹窗(已设计) + 充值页(SKU列表/支付拉起/结果轮询) | 新增 `pages/recharge` | 3d |
| F-6 | **业务组件移植**：人格蒸馏向导、记忆管理、身份详情（从 `main_ui/components/amber/` 迁移并套新设计 token） | `main_ui` → 设计稿 | 4d |
| F-7 | 登录/注册页 + 鉴权路由守卫 | 新增 `pages/auth` | 1.5d |
| F-8 | 数字生命控制台：情绪状态机 + 参数微调（对接新情绪/配置 API） | `pages/chat` Console | 2d |
| F-9 | 明暗主题持久化 + i18n（保留中/英/日） | `src/lib/` | 1d |

---

## 6. 四端打包 WP-P

| 编号 | 任务 | 工时 |
|------|------|------|
| P-1 | Web 部署（Vite build → 静态托管 / Caddy） | 0.5d |
| P-2 | 桌面 Electron 包装 Vite 产物（复用现有 electron-builder，Win+Mac target） | 2d |
| P-3 | Capacitor 初始化 + Android/iOS 工程，WebView 加载 Vite 产物 | 2d |
| P-4 | 系统推送通知：个推/极光(国内) + APNs(iOS) | 3d |
| P-5 | **充值渠道按端隔离**：Web/桌面/Android=微信支付宝；iOS=Apple IAP（编译期/运行期开关） | 2d |
| P-6 | 安全存储 JWT（Capacitor Preferences + Keychain/Keystore）、安全区适配 | 1d |

---

## 7. 合规工作包 WP-C（国内优先，强阻塞，尽早启动）

| 编号 | 任务 | 周期 |
|------|------|------|
| C-1 | 主体资质（公司/个体）、域名 ICP 备案、公安备案 | 2-4 周 |
| C-2 | **算法备案**（生成式 AI 服务，网信办，LLM 生成内容强制） | 数周-数月，最高阻塞 |
| C-3 | 支付资质：微信支付/支付宝商户号申请（需营业执照） | 1-2 周 |
| C-4 | App 上架：华为/小米/OPPO/vivo/应用宝 多渠道（各自审核） | 1-2 周/渠道 |
| C-5 | **iOS App Store**：Apple 开发者账号 + IAP 内购商品配置 + 隐私清单 + 审核 | 1-3 周 |
| C-6 | 隐私政策/用户协议/虚拟商品说明/未成年人保护/账号注销入口 | 1d |

---

## 8. 里程碑

| 阶段 | 内容 | 工作包 | 周期 |
|------|------|--------|------|
| **M0 后端地基** | main.py 接入 + Postgres + 用户/JWT + 多租户 | B-0~B-4 | ~1.5 周 |
| **M1 碎片+支付** | 钱包原子扣减 + 微信/支付宝下单回调 + 对账 | B-5~B-7,B-10 | ~2 周 |
| **M2 前端骨架** | Vite 路由 + API/状态/实时层 + 登录 + 三栏布局 | F-0~F-4,F-7 | ~2 周 |
| **M3 商业闭环** | 充值页 + 碎片消费 + 控制台 + 业务组件移植 | F-5~F-6,F-8,B-8,B-9 | ~2.5 周 |
| **M4 多端发布** | Electron + Capacitor + 渠道隔离支付 + 推送 | P-1~P-6 | ~2.5 周 |
| **M5 合规上架** | 备案/算法备案/支付资质/各商店审核（**并行尽早启动**） | C-1~C-7 | 与全程并行，关键路径 |

**纯工程量约 11-13 周；合规（尤其算法备案）是不可控的关键路径，须 M0 即启动。**

---

## 9. 风险登记册

| 风险 | 等级 | 缓解 |
|------|------|------|
| 算法备案周期长/不通过 | **极高** | M0 即提交；备案前以"内测"形式；内容安全过滤(敏感词/审核API) |
| iOS 强制 IAP 抽成30% + 不可用微信支付 | 高 | 充值渠道按端隔离；iOS 价格策略单独定 |
| 碎片并发超扣/重复发放 | 高 | DB 条件更新 + Redis 锁 + `out_trade_no` 唯一约束 + 流水审计 |
| 业务组件从 Next.js 迁 Vite 的隐性耦合 | 中 | F-6 预留缓冲；先迁核心(蒸馏/聊天)，记忆次之 |
| LLM 成本归属（平台垫付 vs 用户自带 Key） | 中 | 初期用户自带 Key（B-9 加密托管）；碎片只计平台增值功能 |

---

## 10. 立即可启动的第一步（1-2 天验证关键假设）

1. **B-0 + B-1**：精简 `main.py` 接入已建模块，本机 Docker 起 FastAPI + PostgreSQL，确认现有 routers 在 PG 下跑通（验证"自建全栈"地基）
2. **F-0 + F-1**：设计稿 Vite 项目 `npm i` 跑起来，建 `src/api/auth.ts` 指向 FastAPI，打通注册/登录（验证"Vite 重建 + 前后端分离"）
3. **C-1/C-2 启动**：并行提交 ICP 备案与算法备案材料（关键路径，越早越好）

这三步验证后，三大决策（自建后端、Vite 重建、国内合规）的核心假设全部锁定，再全量投入工作包。

---

## 附：关键技术约束备忘

- **充值渠道按端编译隔离**：iOS 包内不得出现任何第三方支付入口或外链充值引导（Apple 3.1.1 条款），否则拒审
- **碎片消费幂等**：每笔消费/充值必须可追溯到 `fragment_ledger`，禁止直接改 `balance` 而不记流水
- **多租户铁律**：所有 `repositories` 查询必须带 `user_id`，杜绝越权读取他人 persona/聊天
- **设计 token 复用**：直接沿用设计稿 `index.css` 的 OKLCH 变量与 `.glass`/`.fragment-glow` 工具类，勿重造
