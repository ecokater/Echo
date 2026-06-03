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

- 2026-06-03 · Claude · **剩余需求整批前端完成 REQ-002/003/009/011（004 经核实已由 007 覆盖）**：新增 `MemoryPanel`(记忆查看/搜索/置顶/删除/手动加)、`ExplorePanel`(广场浏览/搜索/获取安装/我的发布)、`ChatImportModal`(微信/QQ txt 导入)、`lib/janitor.ts`(情绪退火定时 + 记忆结晶节流自动/手动)、`lib/chatImport.ts`(容错解析+分块);`Chat.tsx` 接移动端 memory/explore tab + 桌面 LeftNav 浮层入口 + 「+」导入 + 定时退火 + 对话后自动结晶;`CreatePersona.tsx` 加导入按钮。验证 tsc 0 + vite build 通过(409KB)。**未碰后端/Codex 的 redeem 文件**。锁定文件已释放。备注:Codex 的 REQ-015「我的-激活兑换码」前端入口现可接(Chat.tsx 锁已释放)。

- 2026-06-03 · Codex · **协作日志精简完成**：`work.md` 已压缩为当前架构、API 契约、需求状态、近期关键记录；`working.md` 已压缩为当前锁和最近关键完成项。锁定文件已释放。
- 2026-06-03 · Codex · **REQ-015 兑换码后端/API/后台工具已完成并部署**：新增 `redeem_codes`、`POST /api/redeem`、`POST /api/admin/redeem-codes/generate`、`GET /api/admin/redeem-codes`；后台 dashboard 有 `Redeem Codes`；服务器 backend 已重建，health 200。剩余：前端“我的-激活兑换码”待 Claude 释放前端锁。
- 2026-06-03 · Codex · **Android 模拟器已更新到服务器 API 版本**：debug APK 指向 `http://129.204.151.118`，已安装到 `emulator-5554` 并进入登录页。剩余：登录/真实聊天验收。
- 2026-06-03 · Codex · **固定管理员令牌已部署**：`ADMIN_STATIC_TOKEN` 仅管理接口可用；admin overview/pricing 200，wallet with static token 401。
- 2026-06-03 · Codex/Claude · **REQ-012 硅基流动平台模型与后台定价已完成并部署**：默认 `deepseek-ai/DeepSeek-V4-Pro`；后台 `GET/POST /api/admin/pricing`；剩余：配置真实平台 key 后做聊天验收。

## ⚪ 空闲可认领 (FREE TO CLAIM)

- REQ-001：Web/Android 主流程真实验收，尤其创建分身→聊天→刷新持久化。
- REQ-015 前端：等 Claude 释放前端锁后，在“我的”页接入兑换码入口。
- 管理后台增强：趋势图、筛选、封禁/退款。
- Android release/HTTPS：正式上架前处理域名、HTTPS、release 签名。
