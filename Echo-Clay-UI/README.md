# Echo Clay UI

Echo / 回声的完整功能 Claymorphism 前端。

该目录包含现有 `回声Echo数字生命UI/` 的全部业务能力，并通过独立的
`src/clay-theme.css` 重塑视觉，不修改原有生产 UI。

## 功能

- 注册、登录、会话恢复与退出
- 本地分身创建、预设人格、头像、蒸馏与敏感词校验
- 本地聊天、记忆召回、情绪更新、自动记忆整理与推理请求
- 本地记忆搜索、添加、置顶、删除
- 探索广场、发布、安装与下架分身
- TXT 聊天记录导入与 Android 离线中文 OCR 导入
- 充值、钱包流水、兑换码、推理用量、订单、帮助与关于
- 用户头像、中文/英文、主题和自定义模型高级设置
- Web、Electron、Android 与 iOS/Capacitor 配置

首次启动默认使用浅色 Clay 主题，用户选择深色主题后会持久化。

## Web 运行

```powershell
cd Echo-Clay-UI
npm.cmd install
npm.cmd run dev
```

打开 `http://127.0.0.1:4174`。

## 验证与 Android 构建

```powershell
npx.cmd tsc --noEmit -p tsconfig.app.json
npm.cmd run build
npm.cmd run android:check
npm.cmd run android:build
```
