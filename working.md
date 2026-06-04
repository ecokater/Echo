# Amber 进行中任务看板（防冲突 · 精简版）

> 开始任何具体工作前：先读 `用户需求.md`，再读本文件，并在「正在进行」认领文件/模块。
> 完成后：释放锁，并在 `work.md` 追加短记录。
> 久远完成流水已移入 `work.md` 摘要，避免协作上下文过重。

---

## 🔴 正在进行 (IN PROGRESS)

| 执行者 | 任务 | 锁定文件/模块 | 开始时间 |
|--------|------|--------------|---------|
| (空闲) | — | — | — |

## 🟢 最近完成 (RECENTLY DONE)

- 2026-06-04 · Claude · **后端改名+敏感词+distill修复 已部署线上**:scp 6 文件到 `/home/ubuntu/Echo/Amber/amber-engine` + `docker compose up -d --build backend`;验证 backend healthy、`/api/health` 200、`/openapi.json` 标题=`Echo Engine API`、`inference/distill` 路由存在。REQ-016 后端/REQ-019 后端/distill 修复线上生效。待确认服务器是否配 `PLATFORM_API_KEY`。

- 2026-06-04 · Claude · **REQ-017 收尾 + 占位符 + 弃用 amber.app**:三大覆盖层面板(MemoryPanel/ExplorePanel/ChatImportModal)全量 i18n;聊天输入框占位符改为「和{分身名}说点什么…」;`adb uninstall com.amber.app`,设备仅剩 `com.echo.app`,新 APK 重建安装验证(占位符显示「和girl friend说点什么」)。tsc+build+启动验证通过。未锁文件。

- 2026-06-04 · Claude · **钱包流水类型翻译 + REQ-017 深层 i18n + 新 appId APK**:`ledgerLabel/usageLabel/statusLabel` 中英翻译(consume_chat→对话消耗 等);i18n 覆盖 Chat 全量 + Recharge + CreatePersona + App;重建 `com.echo.app` debug APK 安装到 `emulator-5554`,登录页显示「回声 Echo」本地化文案。tsc+build+启动验证通过。剩:Memory/Explore/ChatImport 覆盖层渐进迁移;后端待经 SSH 重部署。未锁文件(已释放)。

- 2026-06-03 · Claude · **REQ-016/017/018/019 新批次完成(tsc+build+后端编译全绿)**:**REQ-016 全量改名**(后端可见文本 + 前端品牌「琥珀 Amber→回声 Echo」+ Android appId `com.amber.app→com.echo.app`/包名/app_name,MainActivity 迁 `com/echo/app`;保留 `amber_*` 存储键/`amber-local` 库名/`bubble-amber-rim`/TS 类型名=工程红线);**REQ-017 i18n MVP**(新 `lib/i18n.ts`+`stores/locale.ts`,设置内中/英切换,覆盖 Login+Settings+品牌/导航,Chat 深层文案待渐进迁移);**REQ-018 预设人格**(新 `lib/presets.ts` 5 个 + 创建页一键填充);**REQ-019 敏感词**(新前端 `lib/moderation.ts` 拦发送/创建 + 后端 `services/moderation_service.py` 扣费前二次校验命中即拒,词库可热扩展)。另**修复 distill 误退款**(`run_distill` 容错 JSON 解析 `_loads_json_loose`)。**后端改动(moderation/distill 修复/改名)需重新部署服务器才生效。** 锁已释放。
- 2026-06-03 · Claude · **前端整批功能已上线到 server-API debug APK**:`VITE_API_BASE_URL=http://129.204.151.118` 重建 debug APK(含 REQ-002/003/009/011 + Codex REQ-015),安装到 `emulator-5554` 启动正常,底部四 tab(对话/探索/记忆/我的)齐全,bundle 编入服务器 URL,health 200。剩余:配平台 key 后真机闭环验收;release 需 HTTPS。未锁文件。

- 2026-06-03 · Codex · **REQ-015 前端“我的-激活兑换码”完成**：新增 `src/api/redeem.ts`；“我的”页新增激活兑换码入口和子面板；成功后刷新余额/钱包流水，失败显示后端错误。验证 tsc、vite build、服务器 API 版 android:build 通过；APK 已安装启动到 `emulator-5554`。剩余：用真实后台兑换码做人工验收。锁定文件已释放。

- 2026-06-03 · Claude · **剩余需求整批前端完成 REQ-002/003/009/011（004 经核实已由 007 覆盖）**：新增 `MemoryPanel`(记忆查看/搜索/置顶/删除/手动加)、`ExplorePanel`(广场浏览/搜索/获取安装/我的发布)、`ChatImportModal`(微信/QQ txt 导入)、`lib/janitor.ts`(情绪退火定时 + 记忆结晶节流自动/手动)、`lib/chatImport.ts`(容错解析+分块);`Chat.tsx` 接移动端 memory/explore tab + 桌面 LeftNav 浮层入口 + 「+」导入 + 定时退火 + 对话后自动结晶;`CreatePersona.tsx` 加导入按钮。验证 tsc 0 + vite build 通过(409KB)。**未碰后端/Codex 的 redeem 文件**。锁定文件已释放。备注:Codex 的 REQ-015「我的-激活兑换码」前端入口现可接(Chat.tsx 锁已释放)。

- 2026-06-03 · Codex · **协作日志精简完成**：`work.md` 已压缩为当前架构、API 契约、需求状态、近期关键记录；`working.md` 已压缩为当前锁和最近关键完成项。锁定文件已释放。
- 2026-06-03 · Codex · **REQ-015 兑换码后端/API/后台工具已完成并部署**：新增 `redeem_codes`、`POST /api/redeem`、`POST /api/admin/redeem-codes/generate`、`GET /api/admin/redeem-codes`；后台 dashboard 有 `Redeem Codes`；服务器 backend 已重建，health 200。剩余：前端“我的-激活兑换码”待 Claude 释放前端锁。
- 2026-06-03 · Codex · **Android 模拟器已更新到服务器 API 版本**：debug APK 指向 `http://129.204.151.118`，已安装到 `emulator-5554` 并进入登录页。剩余：登录/真实聊天验收。
- 2026-06-03 · Codex · **固定管理员令牌已部署**：`ADMIN_STATIC_TOKEN` 仅管理接口可用；admin overview/pricing 200，wallet with static token 401。
- 2026-06-03 · Codex/Claude · **REQ-012 硅基流动平台模型与后台定价已完成并部署**：默认 `deepseek-ai/DeepSeek-V4-Pro`；后台 `GET/POST /api/admin/pricing`；剩余：配置真实平台 key 后做聊天验收。

## ⚪ 空闲可认领 (FREE TO CLAIM)

- REQ-001：Web/Android 主流程真实验收，尤其创建分身→聊天→刷新持久化。
- 管理后台增强：趋势图、筛选、封禁/退款。
- Android release/HTTPS：正式上架前处理域名、HTTPS、release 签名。
