"""Echo one-click launcher (new commercial frontend)."""
import os
import sys
import time
import subprocess
import urllib.request

ROOT     = os.path.dirname(os.path.abspath(__file__))
ENGINE   = os.path.join(ROOT, "Echo", "echo-engine")
UI       = os.path.join(ROOT, "回声Echo数字生命UI")
NODE     = os.path.join(os.environ["USERPROFILE"], "node22", "node-v22.16.0-win-x64")
NPX      = os.path.join(NODE, "npx.cmd")
# Reuse the Electron binary already installed (and Defender-whitelisted) under main_ui
ELECTRON = os.path.join(ROOT, "Echo", "main_ui", "node_modules", "electron", "dist", "electron.exe")

VITE_PORT = "5173"

env = os.environ.copy()
env["PATH"] = NODE + os.pathsep + env.get("PATH", "")
env["VITE_ENABLE_ROUTE_MESSAGING"] = "true"
env.pop("ELECTRON_RUN_AS_NODE", None)


def wait_http(url: str, label: str, timeout: int = 90) -> bool:
    print(f"  等待 {label} ...", end="", flush=True)
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            urllib.request.urlopen(url, timeout=2)
            print(" ✓")
            return True
        except Exception:
            print(".", end="", flush=True)
            time.sleep(2)
    print(" 超时！")
    return False


def main():
    print("\n================================")
    print("   回声 Echo  启动中 (商业化版)")
    print("================================\n")

    # 1. Backend
    print("[1/3] 启动后端 (port 8000)...")
    backend = subprocess.Popen([sys.executable, "main.py"], cwd=ENGINE, env=env,
                               creationflags=subprocess.CREATE_NEW_CONSOLE)
    if not wait_http("http://127.0.0.1:8000/api/health", "后端"):
        print("后端启动失败。"); input("按 Enter 退出..."); sys.exit(1)

    # 2. Vite frontend
    print(f"[2/3] 启动新前端 Vite (port {VITE_PORT})...")
    vite = subprocess.Popen([NPX, "vite", "--port", VITE_PORT], cwd=UI, env=env,
                            creationflags=subprocess.CREATE_NEW_CONSOLE)
    if not wait_http(f"http://localhost:{VITE_PORT}", "前端"):
        print("前端启动失败。"); backend.terminate(); input("按 Enter 退出..."); sys.exit(1)

    # 3. Electron shell loading the new frontend
    print("[3/3] 启动 Electron 桌面窗口...")
    app = subprocess.Popen([ELECTRON, UI], cwd=UI, env=env)
    print(f"\n✓ 回声 Echo 已启动 (PID: {app.pid})")
    print("  关闭窗口后将自动清理后台进程。\n")

    app.wait()
    print("正在关闭后台服务...")
    backend.terminate()
    vite.terminate()
    time.sleep(1)
    print("已退出。")


if __name__ == "__main__":
    main()
