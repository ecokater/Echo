# Echo 进行中任务看板（防冲突 · 精简版）

> 开始任何具体工作前：先读 `用户需求.md`，再读本文件，并在「正在进行」认领文件/模块。
> 完成后：释放锁，并在 `work.md` 追加短记录。
> 久远完成流水已移入 `work.md` 摘要，避免协作上下文过重。

---

## 🔴 正在进行 (IN PROGRESS)

| 执行者 | 任务 | 锁定文件/模块 | 开始时间 |
|--------|------|--------------|---------|

## 🟢 最近完成 (RECENTLY DONE)

- 2026-06-06 · Codex · **当前工程已提交 GitHub，iOS Mac 接手指南已生成**：完整工程已推送到 `ecokater/Echo` 的 `refactor/architecture` 分支，主提交 `f2ab19d`；新增 `回声Echo数字生命UI/ios/IOS_MAC_HANDOFF.md`，覆盖 Mac 环境、Xcode/CocoaPods、首次构建、插件/业务验收、IAP、隐私清单和 TestFlight 流程。锁已释放。
- 2026-06-06 · Codex · **Digital Life 正式软件图标已应用**：已清理选中图标边缘并生成正式母版，同步替换 Clay UI、现有 Vite UI 的 Android/iOS/Web/Electron 图标与 `Echo/main_ui` 桌面图标，并移除桌面 Web 元数据中的旧 SVG 图标入口；三个前端 build 与两个 Android debug APK build 均通过。剩余为模拟器/真机启动器视觉确认。锁已释放。
- 2026-06-06 · Codex · **Echo Clay App 图标五方向选型稿完成**：生成回声涟漪、陪伴气泡、数字生命、记忆萌芽、Echo 徽记五个候选与选型总览，保存于 `Echo-Clay-UI/design/app-icons/`。待用户选择后制作 Android/iOS 正式图标资源。锁已释放。

- 2026-06-06 · Codex · **Echo Clay UI 全量功能迁移完成**：`Echo-Clay-UI/` 已迁入现有 UI 全部业务源码与 Web/Android/iOS 配置，新增独立 Clay 主题覆盖；功能源码比对 `88/88`，tsc、Web build、Android check、Android debug APK build 全部通过。剩余为连接真实后端做人工全链路验收。锁已释放。

- 2026-06-06 · Codex · **Echo Claymorphism 独立前端完成**：新建 `Echo-Clay-UI/`，实现对话、探索、记忆、我的四个响应式页面与黏土式交互视觉；`npm.cmd run build` 通过，预览运行于 `http://127.0.0.1:4174`。剩余为接入现有业务数据与 API。锁已释放。

- 2026-06-05 · Claude · **全量改名 Amber→Echo / 琥珀→回声(含文件夹)**:文件夹 `Amber/`→`Echo/`、`amber-engine`→`echo-engine`、`琥珀Amber数字生命UI`→`回声Echo数字生命UI`、`启动Amber.*`→`启动Echo.*`;前后端硬改全部内部标识(IndexedDB/localStorage 键、`AmberUser/AmberDB`、`bubble-amber-rim`、role 字面量、`echo_memory.db`、`com.echo.frag*`、订单前缀 ECHO);docs/README/CLAUDE 品牌改;保留真实文件名 `amber_deploy_ed25519`/`amber_admin_static_token.txt`。tsc+android:build 从新目录全绿。本地数据按约定重置。服务器 DB/目录改名留待下次部署(重置+重配 key)。锁已释放。

- 2026-06-05 · Codex · **`Readme/` 全部文档与图片已重写**：重写中英日 README、Quick Start、Backend Guide、Frontend Guide；删除旧 Echo 图片并替换为当前 Echo Android 实机/模拟器截图 `echo_chat/explore/memory/me/import.png`；根 README 也加入实机截图；产品名统一 Echo/回声，贡献者统一 `ecokater`。未提交/未推送。锁已释放。

- 2026-06-05 · Codex · **GitHub Echo README 已更新**：根目录 `README.md` 已从旧 Echo 说明重写为 Echo 当前项目说明，覆盖本地优先架构、功能状态、快速启动、Android 构建、Docker 部署、隐私合规与目录结构。未提交/未推送；如需同步 GitHub，建议单独 commit/push README 与日志，避免夹带其它未提交功能改动。锁已释放。

- 2026-06-04 · Claude · **REQ-020 图片 OCR 导入完成**:接 `@pantrist/...ml-kit-text-recognition@6` + `@capacitor/camera@6`,patch-package 把插件改为 **ML Kit 捆绑中文识别器**(中英混识/离线/免 Play Services);新增 `lib/ocr.ts` + `ChatImportModal`「从截图识别文字」按钮(仅原生,结果走现有本地导入管线);AndroidManifest 加相册权限。验证 tsc+build,APK 含离线中文模型,模拟器插件注册无崩溃。剩余:相册选图→识别真机点按走查(测试图已入相册)。**未提交**。锁已释放。

- 2026-06-04 · Codex · **Android debug APK 重新安装并启动**:`adb install -r` 安装 `回声Echo数字生命UI/android/app/build/outputs/apk/debug/app-debug.apk` 到 `emulator-5554` 成功;`monkey -p com.echo.app` 启动成功;前台窗口确认为 `com.echo.app/.MainActivity`。锁已释放。

- 2026-06-04 · Claude · **后端改名+敏感词+distill修复 已部署线上**:scp 6 文件到 `/home/ubuntu/Echo/Echo/echo-engine` + `docker compose up -d --build backend`;验证 backend healthy、`/api/health` 200、`/openapi.json` 标题=`Echo Engine API`、`inference/distill` 路由存在。REQ-016 后端/REQ-019 后端/distill 修复线上生效。待确认服务器是否配 `PLATFORM_API_KEY`。

- 2026-06-04 · Claude · **REQ-017 收尾 + 占位符 + 弃用 amber.app**:三大覆盖层面板(MemoryPanel/ExplorePanel/ChatImportModal)全量 i18n;聊天输入框占位符改为「和{分身名}说点什么…」;`adb uninstall com.amber.app`,设备仅剩 `com.echo.app`,新 APK 重建安装验证(占位符显示「和girl friend说点什么」)。tsc+build+启动验证通过。未锁文件。

- 2026-06-04 · Claude · **钱包流水类型翻译 + REQ-017 深层 i18n + 新 appId APK**:`ledgerLabel/usageLabel/statusLabel` 中英翻译(consume_chat→对话消耗 等);i18n 覆盖 Chat 全量 + Recharge + CreatePersona + App;重建 `com.echo.app` debug APK 安装到 `emulator-5554`,登录页显示「回声 Echo」本地化文案。tsc+build+启动验证通过。剩:Memory/Explore/ChatImport 覆盖层渐进迁移;后端待经 SSH 重部署。未锁文件(已释放)。

- 2026-06-03 · Claude · **REQ-016/017/018/019 新批次完成(tsc+build+后端编译全绿)**:**REQ-016 全量改名**(后端可见文本 + 前端品牌「回声 Echo→回声 Echo」+ Android appId `com.amber.app→com.echo.app`/包名/app_name,MainActivity 迁 `com/echo/app`;保留 `amber_*` 存储键/`amber-local` 库名/`bubble-amber-rim`/TS 类型名=工程红线);**REQ-017 i18n MVP**(新 `lib/i18n.ts`+`stores/locale.ts`,设置内中/英切换,覆盖 Login+Settings+品牌/导航,Chat 深层文案待渐进迁移);**REQ-018 预设人格**(新 `lib/presets.ts` 5 个 + 创建页一键填充);**REQ-019 敏感词**(新前端 `lib/moderation.ts` 拦发送/创建 + 后端 `services/moderation_service.py` 扣费前二次校验命中即拒,词库可热扩展)。另**修复 distill 误退款**(`run_distill` 容错 JSON 解析 `_loads_json_loose`)。**后端改动(moderation/distill 修复/改名)需重新部署服务器才生效。** 锁已释放。
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
