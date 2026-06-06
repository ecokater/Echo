# Echo iOS Mac 构建接手指南

> 面向在 macOS 上继续工作的 Codex/Claude。主 iOS 工程位于
> `回声Echo数字生命UI/ios/App/App.xcworkspace`，不要直接打开 `.xcodeproj`。

## 当前状态

- 主前端：`回声Echo数字生命UI/`，Vite + React + Capacitor 6。
- iOS 原生工程已生成，Xcode Bundle ID 为 `com.echo.app`，显示名称为 `回声 Echo`。
- React 业务功能与 Android 共用，包括登录、分身、聊天、本地记忆、探索、导入、钱包、兑换码和多语言。
- 正式 Digital Life AppIcon 已写入 `App/App/Assets.xcassets/AppIcon.appiconset/`。
- Windows 端无法运行 Xcode，因此目前没有 iOS 编译、模拟器启动、真机或 Archive 验证记录。
- `App/App/public/`、`App/App/capacitor.config.json` 和 `App/App/config.xml` 是生成文件，不应以仓库中的旧副本判断最终状态；首次工作必须重新执行 Capacitor sync。
- `Echo-Clay-UI/ios/` 是 Claymorphism UI 的平行 iOS 工程。先跑通主前端，再决定是否切换到 Clay UI。

## 已知阻塞项

1. 尚未执行最新的 `npx cap sync ios`，iOS 生成配置可能仍保留旧 Amber 标识。
2. 尚未安装 CocoaPods，仓库不包含 `Pods/` 和 `Podfile.lock`。
3. `Info.plist` 尚缺相册访问说明；OCR/相册导入需要补充并真机验证。
4. OCR 插件的 Android 中文模型补丁不代表 iOS 中文识别已经验证，需要检查 iOS Pod 与识别效果。
5. 尚未配置 Apple Developer Team、签名证书、Provisioning Profile。
6. 尚缺 `PrivacyInfo.xcprivacy` 和 App Store 隐私申报。
7. iOS 虚拟商品充值必须使用 Apple IAP；当前微信/支付宝入口不能直接用于 App Store 版本。
8. 正式 iOS 包必须连接 HTTPS/WSS 后端，不能依赖明文 HTTP。

## 首次环境准备

```bash
xcode-select --install
sudo gem install cocoapods

git clone https://github.com/ecokater/Echo.git
cd Echo
git checkout refactor/architecture

cd "回声Echo数字生命UI"
npm install
npm run build
npx cap sync ios
```

如果 `cap sync ios` 没有成功安装 Pods：

```bash
cd ios/App
pod install --repo-update
cd ../..
```

打开工程：

```bash
npx cap open ios
```

或直接打开：

```bash
open ios/App/App.xcworkspace
```

## Mac Codex 第一阶段任务

### 1. 跑通首次构建

- 使用 `App.xcworkspace`。
- 选择一个 iPhone 模拟器。
- 在 Xcode 中执行 Build 和 Run。
- 修复所有 Swift、Pods、Capacitor 插件和部署目标错误。
- 确认 App 启动后不是白屏，并能进入登录页。

### 2. 修复原生配置

- 确认 Bundle ID 为 `com.echo.app`。
- 确认 Display Name 为 `回声 Echo`。
- 确认 AppIcon 为 Digital Life 黄色角色图标。
- 在 `Info.plist` 添加至少以下权限说明：

```xml
<key>NSPhotoLibraryUsageDescription</key>
<string>用于选择聊天截图并在设备本地识别文字。</string>
<key>NSCameraUsageDescription</key>
<string>用于拍摄需要导入的聊天记录图片。</string>
```

- 检查 iPhone 刘海、Dynamic Island、状态栏和 Home Indicator 安全区。
- 检查键盘弹出时聊天输入框不会被遮挡。

### 3. 插件与业务验收

- 注册、登录和退出。
- 创建分身、上传头像、使用预设人格。
- 发送聊天消息，杀进程后重新打开，确认本地聊天和记忆仍存在。
- 探索发布/安装、兑换码、钱包、用量与订单页面。
- 从相册选择聊天截图，验证 OCR 中文/英文识别。
- 切换中文/English、浅色/深色主题。
- 验证账号删除入口。

### 4. iOS 专属发布工作

- 为 iOS 构建隐藏微信支付、支付宝支付和外链充值引导。
- 接入 Apple IAP，并对接后端 Apple 收据/交易校验。
- 添加 `PrivacyInfo.xcprivacy`，完成所用 API 与数据类型声明。
- 配置 Apple Developer Team、自动签名、版本号和 Build Number。
- 使用真实 HTTPS/WSS API 做真机全链路验收。
- Archive 后先上传 TestFlight，再准备 App Store 审核。

## 建议验证命令

```bash
cd "回声Echo数字生命UI"

npm run build
npx tsc --noEmit -p tsconfig.app.json
npx cap sync ios

cd ios/App
pod install
xcodebuild \
  -workspace App.xcworkspace \
  -scheme App \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  build
```

如果本机没有 `iPhone 16` 模拟器，先运行：

```bash
xcrun simctl list devices available
```

然后把 `-destination` 改为已安装设备。

## 完成标准

- `xcodebuild` Debug Simulator 构建通过。
- 模拟器可启动并完成登录、创建分身、聊天和重启持久化流程。
- 真机可完成相册选择与 OCR。
- iOS 包内不出现微信/支付宝充值入口。
- TestFlight 包可安装，使用生产 HTTPS API 完成核心流程。

## 协作要求

- 开始前读取根目录 `用户需求.md` 与 `working.md`，并在 `working.md` 认领 iOS 文件。
- 不覆盖 Windows/Android 端已有功能。
- iOS API 契约发生变化时同步更新根目录 `work.md`。
- 完成后在 `work.md` 记录已完成、剩余阻塞和下一步 process，并释放 `working.md` 锁。

