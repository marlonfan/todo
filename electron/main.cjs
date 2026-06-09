const { app, BrowserWindow, Tray, Menu, Notification, ipcMain, nativeImage, shell } = require('electron');
const path = require('node:path');

const isMac = process.platform === 'darwin';
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL || process.env.ELECTRON_DEV);
const devURL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000';

let mainWindow = null;
let tray = null;
let isQuitting = false;
const scheduledNotifications = new Map();
const MAX_TIMER_DELAY_MS = 2_147_483_647;

function resolveResourcePath(...segments) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, ...segments);
  }
  return path.join(__dirname, '..', ...segments);
}

function getIconPath() {
  if (process.platform === 'win32') {
    return resolveResourcePath('src-tauri', 'icons', 'icon.ico');
  }
  if (isMac) {
    return resolveResourcePath('src-tauri', 'icons', 'icon.icns');
  }
  return resolveResourcePath('src-tauri', 'icons', 'icon.png');
}

function getTrayIcon() {
  const trayIconPath = resolveResourcePath('src-tauri', 'icons', '32x32.png');
  const image = nativeImage.createFromPath(trayIconPath);
  if (isMac && !image.isEmpty()) {
    image.setTemplateImage(true);
  }
  return image;
}

function showMainWindow() {
  if (!mainWindow) return;
  mainWindow.show();
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.focus();
}

function createTray() {
  if (tray || !isMac) return;

  tray = new Tray(getTrayIcon());
  tray.setToolTip('Todo');
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: '显示 Todo',
      click: showMainWindow,
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]));
  tray.on('click', () => {
    tray.popUpContextMenu();
  });
  tray.on('double-click', showMainWindow);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'Todo',
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    icon: isMac ? undefined : getIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    showMainWindow();
  });

  mainWindow.on('close', (event) => {
    if (isMac && !isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL(devURL);
  } else {
    mainWindow.loadFile(resolveResourcePath('web', 'dist', 'index.html'));
  }
}

function requestNotificationPermission() {
  if (!Notification.isSupported()) {
    return 'unsupported';
  }
  return 'granted';
}

function showNotification(payload = {}) {
  if (!Notification.isSupported()) {
    return false;
  }

  const notification = new Notification({
    title: String(payload.title || 'Todo'),
    body: String(payload.body || ''),
    silent: false,
  });

  notification.on('click', showMainWindow);
  notification.show();
  return true;
}

function scheduleNotificationTimer(id, runAt, callback) {
  const arm = () => {
    const delay = Math.max(0, runAt.getTime() - Date.now());
    if (delay <= MAX_TIMER_DELAY_MS) {
      return setTimeout(callback, delay);
    }
    return setTimeout(() => {
      const nextTimer = arm();
      scheduledNotifications.set(id, nextTimer);
    }, MAX_TIMER_DELAY_MS);
  };

  return arm();
}

function scheduleNotification(payload = {}) {
  const id = Number(payload.id);
  if (!Number.isInteger(id)) {
    throw new Error('notification id must be an integer');
  }

  cancelNotifications([id]);

  const scheduledAt = payload.schedule?.at ? new Date(payload.schedule.at) : null;

  const timeout = scheduleNotificationTimer(id, scheduledAt || new Date(), () => {
    scheduledNotifications.delete(id);
    showNotification(payload);
  });

  scheduledNotifications.set(id, timeout);
  return true;
}

function cancelNotifications(ids = []) {
  const normalizedIds = Array.isArray(ids) ? ids : [ids];
  normalizedIds.forEach((rawID) => {
    const id = Number(rawID);
    const timeout = scheduledNotifications.get(id);
    if (!timeout) return;
    clearTimeout(timeout);
    scheduledNotifications.delete(id);
  });
}

function registerIPC() {
  ipcMain.handle('todo:notifications:is-supported', () => Notification.isSupported());
  ipcMain.handle('todo:notifications:is-permission-granted', () => Notification.isSupported());
  ipcMain.handle('todo:notifications:request-permission', () => requestNotificationPermission());
  ipcMain.handle('todo:notifications:send', (_event, payload) => {
    if (payload?.schedule?.at) {
      return scheduleNotification(payload);
    }
    return showNotification(payload);
  });
  ipcMain.handle('todo:notifications:cancel', (_event, ids) => {
    cancelNotifications(ids);
    return true;
  });
}

app.setName('Todo');
if (process.platform === 'win32') {
  app.setAppUserModelId('life.marlon.todo');
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', showMainWindow);

  app.whenReady().then(() => {
    registerIPC();
    createTray();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      } else {
        showMainWindow();
      }
    });
  });
}

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (!isMac) {
    app.quit();
  }
});

app.on('will-quit', () => {
  cancelNotifications([...scheduledNotifications.keys()]);
});
