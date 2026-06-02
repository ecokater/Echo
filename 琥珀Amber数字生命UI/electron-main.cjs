const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");

Menu.setApplicationMenu(null);

// Dev: load Vite server. Prod: load built dist/index.html (requires base:'./' + HashRouter).
const DEV_URL = process.env.AMBER_DEV_URL || "http://localhost:5173";
const isDev = !app.isPackaged;

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 832,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#0b0907",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });

  if (isDev) {
    win.loadURL(DEV_URL);
  } else {
    win.loadFile(path.join(__dirname, "dist", "index.html"));
  }

  win.on("closed", () => { win = null; });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
