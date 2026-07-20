const { app, BrowserWindow, shell } = require("electron");

const APP_URL = "https://fantasy-x.vercel.app/markets?release=guest-explore-v2";
const APP_ORIGIN = new URL(APP_URL).origin;
const PROTOCOL = "fantasyx";
let mainWindow = null;

function isAppUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" && url.origin === APP_ORIGIN;
  } catch {
    return false;
  }
}

function openExternalHttps(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol === "https:") void shell.openExternal(url.toString());
  } catch {
    // Ignore malformed navigation targets from remote content.
  }
}

function createWindow() {
  const window = new BrowserWindow({
    title: "FantasyX OS",
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#0b0f14",
    icon: `${__dirname}/build/icon.ico`,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow = window;

  window.once("ready-to-show", () => window.show());

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isAppUrl(url)) {
      window.loadURL(url);
    } else {
      openExternalHttps(url);
    }
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (!isAppUrl(url)) {
      event.preventDefault();
      openExternalHttps(url);
    }
  });

  window.webContents.on("will-redirect", (event, url) => {
    if (!isAppUrl(url)) {
      event.preventDefault();
      openExternalHttps(url);
    }
  });

  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  window.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F5" || (input.control && input.key.toLowerCase() === "r")) {
      window.webContents.reload();
      event.preventDefault();
    }
  });

  window.loadURL(APP_URL);
  window.on("closed", () => { if (mainWindow === window) mainWindow = null; });
}

function handleDeepLink(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== `${PROTOCOL}:` || url.hostname !== "auth") return;
    const token = url.searchParams.get("token");
    const next = url.searchParams.get("next") || "/markets";
    if (!token || !mainWindow) return;
    const complete = new URL("/api/auth/desktop-complete", APP_ORIGIN);
    complete.searchParams.set("token", token);
    complete.searchParams.set("next", next);
    void mainWindow.loadURL(complete.toString());
    mainWindow.show();
    mainWindow.focus();
  } catch {
    // Ignore malformed protocol activations.
  }
}

app.setAppUserModelId("com.fantasyx.desktop");
app.setAsDefaultProtocolClient(PROTOCOL);

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

app.on("second-instance", (_event, argv) => {
  const deepLink = argv.find((value) => value.startsWith(`${PROTOCOL}://`));
  if (deepLink) handleDeepLink(deepLink);
  else if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
});

app.on("open-url", (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

app.whenReady().then(() => {
  createWindow();
  const deepLink = process.argv.find((value) => value.startsWith(`${PROTOCOL}://`));
  if (deepLink) setTimeout(() => handleDeepLink(deepLink), 500);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
