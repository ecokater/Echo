# Echo Quick Start

This guide starts the current Echo development stack on Windows.

## Requirements

- Python 3.11+
- Node.js 22+
- Android Studio and Android SDK if building Android
- Optional: Docker and Docker Compose for server deployment

## Backend

```powershell
cd Echo/echo-engine
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py
```

The backend listens on:

```text
http://127.0.0.1:8000
```

Useful environment variables:

```env
SECRET_KEY=change-me
DATABASE_URL=sqlite:///data/amber_memory.db
ADMIN_STATIC_TOKEN=change-me-admin-token
PLATFORM_API_KEY=sk-...
PLATFORM_BASE_URL=https://api.siliconflow.cn/v1
PLATFORM_MODEL_ID=deepseek-ai/DeepSeek-V4-Pro
```

## Frontend

```powershell
cd 回声Echo数字生命UI
npm install
npm.cmd run dev
```

Use `npm.cmd` on Windows if PowerShell blocks `npm.ps1`.

## One-command launcher

From the repository root:

```powershell
python launch.py
```

## Android debug APK

```powershell
cd 回声Echo数字生命UI
npm.cmd run android:check
npm.cmd run android:build
```

Output:

```text
回声Echo数字生命UI/android/app/build/outputs/apk/debug/app-debug.apk
```

Install and launch:

```powershell
$adb="$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb install -r "回声Echo数字生命UI\android\app\build\outputs\apk\debug\app-debug.apk"
& $adb shell monkey -p com.echo.app -c android.intent.category.LAUNCHER 1
```

Debug builds default to the host backend:

```env
VITE_API_BASE_URL=http://10.0.2.2:8000
VITE_WS_BASE_URL=ws://10.0.2.2:8000
```

To build against the current test server:

```powershell
$env:VITE_API_BASE_URL="http://129.204.151.118"
$env:VITE_WS_BASE_URL="ws://129.204.151.118"
npm.cmd run android:build
```

## What to verify

1. Register or log in.
2. Create a persona from a preset or manual input.
3. Send a chat message.
4. Open Memory and confirm local memories are visible.
5. Try Explore and install a public persona card.
6. Open Account and check wallet, orders, usage history, and redeem-code entry.
7. Import a `.txt` chat export or use screenshot OCR on Android.

## Notes

- Echo is the product name. Some paths still include historical names for compatibility.
- Do not put packaged desktop builds under a path containing Chinese characters.
- Release Android/iOS builds must use a real HTTPS API endpoint.
