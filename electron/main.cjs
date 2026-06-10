const { app, BrowserWindow, Tray, Menu, Notification, ipcMain, nativeImage, shell } = require('electron');
const path = require('node:path');

const isMac = process.platform === 'darwin';
const isWindows = process.platform === 'win32';
const keepsRunningInTray = isMac || isWindows;
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL || process.env.ELECTRON_DEV);
const devURL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000';

let mainWindow = null;
let tray = null;
let isQuitting = false;
const scheduledNotifications = new Map();
const MAX_TIMER_DELAY_MS = 2_147_483_647;
const MAC_TRAY_TEMPLATE_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAYAAADhAJiYAAAAfElEQVR4nO3VUQrAIAwDUO9/aXeCimlTU1gC/jiID6e4lvOT7MsxCtOKQhGtOBaGgmJjyqioDFm4FaTuoR5IgwyK5m+vt0FSkKzLoGxJ5uGkPB8GZUGVHvmhRnaxHYT+VriQgaGCdvANwdBBjFHKKAwb9SSyhU8ZB3Ke5QM4aGimfd1r3QAAAABJRU5ErkJggg==';

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
  if (isMac) {
    const image = nativeImage.createFromDataURL(`data:image/png;base64,${MAC_TRAY_TEMPLATE_PNG_BASE64}`);
    if (!image.isEmpty()) {
      image.setTemplateImage(true);
      return image;
    }
  }

  const trayIconPath = resolveResourcePath('src-tauri', 'icons', isMac ? '64x64.png' : '32x32.png');
  const image = nativeImage.createFromPath(trayIconPath);
  if (image.isEmpty()) {
    return image;
  }
  if (isMac) {
    const resized = image.resize({ width: 18, height: 18 });
    resized.setTemplateImage(true);
    return resized;
  }
  return image;
}

function setDockIcon() {
  if (!isMac || !app.dock) return;
  const image = nativeImage.createFromPath(getIconPath());
  if (!image.isEmpty()) {
    app.dock.setIcon(image);
  }
}

function buildApplicationMenu() {
  if (!isMac) {
    return Menu.buildFromTemplate([
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'delete' },
          { type: 'separator' },
          { role: 'selectAll' },
        ],
      },
    ]);
  }

  return Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: '显示 Todo',
          accelerator: 'CommandOrControl+Shift+T',
          click: showMainWindow,
        },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: '文件',
      submenu: [
        {
          label: '关闭窗口',
          accelerator: 'Command+W',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow() || mainWindow;
            if (focusedWindow) {
              focusedWindow.close();
            }
          },
        },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        {
          label: '显示 Todo',
          click: showMainWindow,
        },
      ],
    },
  ]);
}

function buildTextEditingContextMenu(params) {
  const template = [];

  if (params.isEditable) {
    template.push(
      { role: 'undo', enabled: params.editFlags.canUndo },
      { role: 'redo', enabled: params.editFlags.canRedo },
      { type: 'separator' },
      { role: 'cut', enabled: params.editFlags.canCut },
      { role: 'copy', enabled: params.editFlags.canCopy },
      { role: 'paste', enabled: params.editFlags.canPaste },
      { role: 'delete', enabled: params.editFlags.canDelete },
      { type: 'separator' },
      { role: 'selectAll', enabled: params.editFlags.canSelectAll },
    );
  } else if (params.selectionText) {
    template.push(
      { role: 'copy', enabled: params.editFlags.canCopy },
      { type: 'separator' },
      { role: 'selectAll', enabled: params.editFlags.canSelectAll },
    );
  }

  return template.length > 0 ? Menu.buildFromTemplate(template) : null;
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
  if (tray || !keepsRunningInTray) return;

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
  if (isMac) {
    tray.on('click', () => {
      tray.popUpContextMenu();
    });
  } else {
    tray.on('click', showMainWindow);
  }
  tray.on('right-click', () => {
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
    if (keepsRunningInTray && !isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('context-menu', (event, params) => {
    const menu = buildTextEditingContextMenu(params);
    if (menu) {
      menu.popup({ window: mainWindow });
    }
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
Menu.setApplicationMenu(buildApplicationMenu());
if (isWindows) {
  app.setAppUserModelId('life.marlon.todo');
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', showMainWindow);

  app.whenReady().then(() => {
    registerIPC();
    setDockIcon();
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
  if (!keepsRunningInTray) {
    app.quit();
  }
});

app.on('will-quit', () => {
  cancelNotifications([...scheduledNotifications.keys()]);
});
