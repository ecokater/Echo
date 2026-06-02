# Amber 移动端构建指南 (Capacitor)

移动端复用 `琥珀Amber数字生命UI/` 的同一份 React 代码,经 Capacitor 包装为原生 Android / iOS 应用,运行时连接**云端** FastAPI。

---

## 架构

```
React (Vite, dist/)  ──Capacitor──►  Android (WebView) / iOS (WKWebView)
                                              │ HTTPS + WSS
                                              ▼
                                   云端 FastAPI (:443)
```

已完成的工程化改造：
- `App.tsx` 改用 **HashRouter**（WebView `capacitor://` / `file://` 下 BrowserRouter 失效）
- `vite.config.ts` 设 **`base: "./"`**（相对路径加载 bundle）
- `capacitor.config.ts`：`appId=com.amber.app`、`webDir=dist`
- `android/`、`ios/` 原生工程已生成，web 产物已同步

---

## 关键：API 地址

`127.0.0.1` 在手机上指向**手机自己**，必须改为设备可达的公网地址。
编辑 `.env.production`：

```env
VITE_API_BASE_URL=https://api.your-domain.com
VITE_WS_BASE_URL=wss://api.your-domain.com
```

改完必须重新 `build` + `cap sync` 才生效。

### Android debug 本机测试

`npm run android:build` / `npm run android:build:debug` 会默认把 API 指向：

```env
VITE_API_BASE_URL=http://10.0.2.2:8000
VITE_WS_BASE_URL=ws://10.0.2.2:8000
```

`10.0.2.2` 是 Android Emulator 访问电脑宿主机的地址。测试前先启动电脑本机后端：

```powershell
cd Amber/amber-engine
python main.py
```

Release APK/AAB 必须配置真实公网 HTTPS API。构建脚本会阻止 `api.your-domain.com` 占位域名进入 release 包。

---

## 出包流程

每次改代码后的标准三步：
```bash
npm run build          # 产出 dist/
npx cap sync           # 同步 dist/ + 插件到 android/ios
# 然后用原生工具构建
```

### Android（需 JDK 17 + Android SDK）
本机必须具备：
- JDK 17（Android Studio 自带 JBR 也可以）
- Android SDK
- `ANDROID_HOME` 或 `ANDROID_SDK_ROOT`

Windows 快速检查：

```powershell
java -version
Test-Path "$env:LOCALAPPDATA\Android\Sdk"
```

如果已安装 Android Studio 但 `java -version` 不可用，先找到 Android Studio 的 `jbr` 目录，再设置当前终端环境变量：

```powershell
$env:JAVA_HOME="C:\Program Files\Android Studio\jbr"
$env:PATH="$env:JAVA_HOME\bin;$env:PATH"
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
npm.cmd run android:check
```

如果 Android Studio 安装在其它位置，把 `$env:JAVA_HOME` 改成实际 `jbr` 路径。也可以单独安装 JDK 17，并将 `JAVA_HOME` 指向 JDK 17 根目录。

已提供 npm 构建命令：

```bash
npm run android:check          # 只检查 JDK/Android SDK/Gradle wrapper
npm run android:sync           # build + cap sync android
npm run android:build          # debug APK
npm run android:build:debug    # debug APK
npm run android:build:release  # unsigned release APK
npm run android:bundle         # release AAB
npm run android:open           # 打开 Android Studio
```

输出路径：

```text
android/app/build/outputs/apk/debug/app-debug.apk
android/app/build/outputs/apk/release/app-release-unsigned.apk
android/app/build/outputs/bundle/release/app-release.aab
```

如果没有配置 Android 环境，`android:check` / `android:build` 会提前失败并提示缺少 JDK 或 `ANDROID_HOME`。

也可以用 Android Studio：

```bash
npm run android:sync
npm run android:open
# Studio 内 Build > Generate Signed Bundle/APK
```

### iOS（需 macOS + Xcode + CocoaPods）
Windows **无法**构建 iOS。在 Mac 上：
```bash
npm run build && npx cap sync ios
cd ios/App && pod install
npx cap open ios             # Xcode 中 Archive → 上传 App Store Connect
```

---

## 真机开发热重载（可选）

无需每次出包即可在真机调试：
1. `capacitor.config.ts` 取消注释 `server.url`，设为开发机局域网 IP：
   ```ts
   server: { url: "http://192.168.x.x:5173", cleartext: true }
   ```
2. `npx vite --host`（监听局域网）
3. `npx cap run android`（设备 WebView 直连 dev server，热重载生效）

---

## 上架前置（详见 docs/MULTIPLATFORM_PLAN.md WP-C）

- **签名**：Android keystore；iOS Distribution 证书 + Provisioning Profile
- **隐私**：iOS `PrivacyInfo.xcprivacy`、Play 数据安全表单
- **账号删除入口**（App Store 强制）—— 前端已具备 `DELETE /api/auth/me`
- **支付**：iOS 虚拟商品必须走 App Store IAP（后端 `payment_service.py` 已留 Apple 校验骨架），不可用微信/支付宝绕过
- **国内**：App 备案 + 算法备案（LLM 生成内容）

---

## 推荐后续插件

| 能力 | 插件 |
|------|------|
| JWT 安全存储 | `@capacitor/preferences`（已可用 localStorage 兜底） |
| 系统通知 | `@capacitor/push-notifications` + FCM/APNs |
| 状态栏/启动屏 | `@capacitor/status-bar` `@capacitor/splash-screen` |
| 应用内购 | `@capacitor-community/in-app-purchases`（iOS 合规必需） |
