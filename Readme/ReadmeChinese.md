# Echo 回声

Echo 回声是一个本地优先的数字生命与长期陪伴应用。它让用户创建、陪伴、整理和延展自己的数字分身，同时尽量把聊天、人格和私有记忆留在用户设备本地。

当前项目已经彻底更名为 **Echo 回声**。仓库里个别目录名仍带有历史工程名称，是为了避免破坏已有路径和本地数据，不代表产品名称。

## 导航

- [English](ReadmeEnglish.md)
- [日本語](ReadmeJapanese.md)
- [快速开始](QUICK_START.md)
- [后端指南](BACKEND_GUIDE.md)
- [前端指南](FRONTEND_GUIDE.md)

## 实机截图

以下截图来自当前 Android Echo debug 版本，包名 `com.echo.app`。

<p align="center">
  <img src="image/echo_chat.png" alt="Echo 对话界面" width="260" />
  <img src="image/echo_explore.png" alt="Echo 探索广场" width="260" />
  <img src="image/echo_memory.png" alt="Echo 记忆管理" width="260" />
</p>

<p align="center">
  <img src="image/echo_me.png" alt="Echo 我的页面" width="260" />
  <img src="image/echo_import.png" alt="Echo 聊天记录与截图导入" width="260" />
</p>

## 核心特性

- 本地优先：人格、聊天、长期记忆、导入语料默认保存在本地 IndexedDB。
- 云端推理代理：服务端只接收临时上下文，不持久化聊天全文和私有记忆。
- 多端体验：React/Vite 前端可运行在 Web、Electron 和 Android Capacitor。
- 长期记忆：支持查看、搜索、置顶、删除、手动添加和自动结晶。
- 聊天记录导入：支持微信/QQ `.txt` 导入、粘贴导入，以及 Android 侧本地 OCR 截图识别。
- 探索广场：用户可分享公开人格卡，其他用户可一键获取到本地。
- 兑换码与钱包：后台生成兑换码，用户在“我的”中激活并获得记忆碎片。
- 多语言：支持中文和英文切换。
- 合规基础：前端敏感词拦截 + 后端扣费前二次校验。
- 管理后台：含用量、订单、分享审核、平台模型定价、兑换码工具。

## 数据边界

| 数据类型 | 保存位置 |
|----------|----------|
| 人格、聊天、私有记忆、导入语料 | 用户本地设备 |
| OCR 识别结果 | 用户本地设备 |
| 账号、钱包、订单、用量审计 | 服务端 |
| 探索广场人格卡 | 服务端，仅用户主动发布的公开字段 |
| 兑换码状态 | 服务端 |

Echo 不会把完整聊天记录或私有记忆作为云端数据持久化。推理时，前端只会把当前对话需要的临时上下文发送到服务端。

## 技术栈

- 前端：Vite、React、TypeScript、Tailwind CSS、Capacitor、Electron
- 本地数据：IndexedDB
- 后端：FastAPI、SQLAlchemy、SQLite/PostgreSQL
- 推理：OpenAI-compatible API，当前默认 SiliconFlow + `deepseek-ai/DeepSeek-V4-Pro`
- Android OCR：ML Kit 捆绑中文识别器，离线识别

## 贡献者

本项目当前维护者与贡献者：

- ecokater

## 合规声明

Echo 仍处于 beta 阶段，仅适合作为研究、测试和个人使用项目。导入聊天记录、创建他人分身、使用肖像或其它个人信息前，应取得相关权利人的明确授权。严禁将本项目用于冒充、诈骗、骚扰、侵犯隐私、侵犯名誉或传播违法内容。
