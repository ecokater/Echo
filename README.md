# Echo 回声

Echo 是一个本地优先的数字生命与长期陪伴实验项目。它把人格、聊天记录、私有记忆和导入语料保存在用户设备本地，只把临时上下文发送给云端推理代理；服务端主要负责账号、钱包、计费、审计、管理后台和模型调用。

当前主线已经从早期 Echo/回声 原型更名为 Echo/回声。为了兼容已有本地数据，部分内部存储键、IndexedDB 名称和 CSS 类仍保留 `amber_*` / `amber-local` / `bubble-amber-rim`，这些是工程兼容层，不代表当前产品名。

## 当前状态

- 阶段：beta / active development
- 主前端：`回声Echo数字生命UI/`，Vite + React + Capacitor + Electron
- 后端：`Echo/echo-engine/`，FastAPI + SQLAlchemy
- Android appId：`com.echo.app`
- 测试服务器：`http://129.204.151.118`
- 主分支工作线：`refactor/architecture`

## 核心原则

- 本地优先：聊天全文、人格、长期记忆和导入语料默认只保存在本地 IndexedDB。
- 云端最小化：服务端不持久化聊天全文和私有记忆，只保存账号、钱包、订单、推理消耗、错误元数据、分享卡和兑换码状态。
- 多端复用：同一套 React 前端同时服务 Web/Electron/Android。
- 主版本不包含 QQ bot：QQ bot 相关能力不进入当前主线。
- 上架合规优先：敏感词过滤、隐私说明、账号删除、支付合规和数据最小化是核心约束。

## 功能概览

| 模块 | 状态 |
|------|------|
| 注册/登录/账号删除 | 已实现 |
| 本地人格与聊天 | 已实现，IndexedDB 本地保存 |
| 云端推理代理 | 已实现，`/api/inference/chat|distill|memory-summary` |
| 平台模型配置 | 已实现，默认 SiliconFlow + `deepseek-ai/DeepSeek-V4-Pro`，后台可实时改模型/key/单价 |
| 记忆管理 | 已实现，查看、搜索、置顶、删除、手动添加 |
| 自动记忆整理与情绪退火 | 已实现，本地 Janitor + 需要总结时临时调用推理 |
| 探索广场 | 已实现，云端仅分享人格卡，不上传私有聊天/记忆 |
| 聊天记录导入 | 已实现，支持微信/QQ `.txt` 导入、粘贴导入 |
| 图片 OCR 导入 | 已实现 Android 侧 ML Kit 中文离线识别，相册选图后进入本地导入管线 |
| 兑换码 | 已实现，后台生成 100-1000 碎片兑换码，用户在“我的”中激活 |
| 钱包/订单/消耗历史 | 已实现，碎片余额、订单、usage events |
| 管理后台 | 已实现，`/api/admin/dashboard`，含用量、订单、分享审核、平台定价、兑换码工具 |
| 多语言 | 已实现中文/英文切换，主要页面与面板已覆盖 |
| 敏感词过滤 | 已实现，前端拦截 + 后端扣费前二次校验 |
| Android debug APK | 已实现，可构建并安装到模拟器 |
| 微信/支付宝支付 | 未实现，等待商户资质、回调域名和合规材料 |

## 实机截图

以下截图来自当前 Android Echo debug 版本，包名 `com.echo.app`。

<p align="center">
  <img src="Readme/image/echo_chat.png" alt="Echo 对话界面" width="250" />
  <img src="Readme/image/echo_explore.png" alt="Echo 探索广场" width="250" />
  <img src="Readme/image/echo_memory.png" alt="Echo 记忆管理" width="250" />
</p>

<p align="center">
  <img src="Readme/image/echo_me.png" alt="Echo 我的页面" width="250" />
  <img src="Readme/image/echo_import.png" alt="Echo 导入聊天记录" width="250" />
</p>

## 架构

```text
React UI (Vite)
  ├─ Web / Electron
  └─ Capacitor Android
        │
        │ HTTPS / HTTP debug
        ▼
FastAPI Echo Engine
  ├─ auth / wallet / billing
  ├─ inference proxy
  ├─ usage + system audit
  ├─ admin dashboard
  ├─ explore shared persona cards
  └─ redeem codes

Local device
  └─ IndexedDB: personas / messages / corpus / imported chat memory
```

服务端不会主动读取或保存完整聊天历史。前端在发送消息时从本地取最近对话和检索到的记忆，组装临时上下文，请求 `/api/inference/chat`，再把回复写回本地。

## 目录结构

```text
Echo/echo-engine/              FastAPI 后端
  main.py                        应用入口
  database.py                    SQLAlchemy 模型
  routers/                       API 路由
  services/                      推理、钱包、敏感词等服务
  repositories/                  数据访问层

回声Echo数字生命UI/              当前主前端
  src/pages/                     页面
  src/components/                业务组件与 UI 组件
  src/api/                       前端 API client
  src/lib/                       本地 DB、RAG、导入、OCR、i18n 等
  android/                       Capacitor Android 工程

deploy/                          Docker Compose / Caddy 部署
docs/                            部署、移动端构建等文档
work.md / working.md             Codex 与 Claude 协作日志
用户需求.md                       需求状态清单
```

## 快速开始

### 1. 后端

```powershell
cd Echo/echo-engine
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py
```

默认监听：

```text
http://127.0.0.1:8000
```

可选环境变量：

```env
SECRET_KEY=change-me
DATABASE_URL=sqlite:///data/amber_memory.db
ADMIN_STATIC_TOKEN=change-me-admin-token
PLATFORM_API_KEY=sk-...
PLATFORM_BASE_URL=https://api.siliconflow.cn/v1
PLATFORM_MODEL_ID=deepseek-ai/DeepSeek-V4-Pro
```

### 2. 前端

```powershell
cd 回声Echo数字生命UI
npm install
npm.cmd run dev
```

Windows PowerShell 如果遇到 `npm.ps1` 执行策略限制，可以使用：

```powershell
npm.cmd run dev
```

### 3. 一键启动开发环境

```powershell
python launch.py
```

## Android 构建

需要 Android Studio、JDK 17、Android SDK。

检查环境：

```powershell
cd 回声Echo数字生命UI
npm.cmd run android:check
```

构建 debug APK：

```powershell
npm.cmd run android:build
```

输出路径：

```text
回声Echo数字生命UI/android/app/build/outputs/apk/debug/app-debug.apk
```

debug 默认连接电脑宿主机：

```env
VITE_API_BASE_URL=http://10.0.2.2:8000
VITE_WS_BASE_URL=ws://10.0.2.2:8000
```

如果要构建连接测试服务器的 APK：

```powershell
$env:VITE_API_BASE_URL="http://129.204.151.118"
$env:VITE_WS_BASE_URL="ws://129.204.151.118"
npm.cmd run android:build
```

安装到模拟器：

```powershell
$adb="$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb install -r "回声Echo数字生命UI\android\app\build\outputs\apk\debug\app-debug.apk"
& $adb shell monkey -p com.echo.app -c android.intent.category.LAUNCHER 1
```

release / 上架版本必须使用真实 HTTPS API 域名。

## Docker 部署

服务器部署配置位于 `deploy/`。基本流程：

```bash
cd deploy
cp .env.example .env
# 编辑 .env：SECRET_KEY / DATABASE_URL / PLATFORM_API_KEY / ADMIN_STATIC_TOKEN 等
docker compose up -d --build
```

管理后台：

```text
http://<server>/api/admin/dashboard
```

把管理员账号 JWT 或 `ADMIN_STATIC_TOKEN` 粘贴到后台顶部 token 输入框即可进入。固定管理员令牌等同后台长期密钥，不要提交到仓库、截图或公开日志。

## 常用验证

后端：

```powershell
python -m compileall Echo\echo-engine
python -c "import sys; sys.path.insert(0, r'Echo\\echo-engine'); import main; print('main import ok')"
```

前端：

```powershell
cd 回声Echo数字生命UI
npx.cmd tsc --noEmit -p tsconfig.app.json
npm.cmd run build
```

Android：

```powershell
cd 回声Echo数字生命UI
npm.cmd run android:build
```

## 隐私与数据

- 本地数据：人格、聊天、长期记忆、导入语料、OCR 识别结果。
- 云端数据：账号、钱包、订单、推理消耗、错误元数据、公开分享的人格卡、兑换码状态。
- 不上传：完整聊天全文、私有记忆库、微信/QQ 原始导出全文。
- OCR 导入：当前 Android 侧使用 ML Kit 捆绑中文识别器，识别在设备本地完成。
- 探索分享：只发布用户主动选择分享的人格卡字段，不包含私有聊天记录。

## 合规提示

- 导入聊天记录、创建他人分身或使用肖像/声音/文本资料前，应取得相关权利人的明确授权。
- 不得用于诈骗、冒充他人、诱导、骚扰、侵犯名誉、侵犯隐私或传播违法内容。
- 当前敏感词过滤只是基础防线，正式上线建议接入维护版词库或内容安全服务。
- iOS 虚拟商品通常需要走 App Store IAP；国内分发还需关注 App 备案、算法备案、生成式 AI 相关要求。
- 本项目仍处于 beta 阶段，生产/商业使用前应补齐隐私政策、用户协议、数据删除流程、安全审计和支付合规。

## 重要说明

- 不要把项目放在包含中文字符的安装路径下运行打包版 Electron/PyInstaller，Windows 打包或运行时可能出问题。
- 本仓库目前仍保留部分 `Echo` 目录名，这是历史工程目录名，不影响当前产品名 Echo。
- 旧 `Echo/main_ui` Next.js 前端基本退役，当前开发请使用 `回声Echo数字生命UI/`。

## 贡献者

当前维护者与贡献者：

- ecokater

## 灵感来源

- [notdog1998/yourself-skill](https://github.com/notdog1998/yourself-skill)：早期灵感来源。
- [LC044/WeChatMsg](https://github.com/LC044/WeChatMsg)：聊天记录导出与文档启发。

## 反馈

- Email: [t2510458625@gmail.com](mailto:t2510458625@gmail.com)
- Issues: 请在 GitHub 仓库提交问题和建议。
