const { app, BrowserWindow, Tray, Menu, Notification, ipcMain, nativeImage, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('node:path');
const { buildDeveloperMenu } = require('./menu.cjs');

const isMac = process.platform === 'darwin';
const isWindows = process.platform === 'win32';
const keepsRunningInTray = isMac || isWindows;
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL || process.env.ELECTRON_DEV);
const devURL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000';
const APP_USER_MODEL_ID = 'life.marlon.todo';
const STARTUP_HIDDEN_ARG = '--todo-startup-hidden';

let mainWindow = null;
let tray = null;
let isQuitting = false;
let startHidden = process.argv.includes(STARTUP_HIDDEN_ARG);
const scheduledNotifications = new Map();
const activeNotifications = new Set();
const MAX_TIMER_DELAY_MS = 2_147_483_647;
const NOTIFICATION_DELIVERY_TIMEOUT_MS = 3000;
const NOTIFICATION_REF_TTL_MS = 5 * 60 * 1000;
const MAC_TRAY_ICON_SIZE = 18;
const MAC_TRAY_TEMPLATE_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAYAAADhAJiYAAAAfElEQVR4nO3VUQrAIAwDUO9/aXeCimlTU1gC/jiID6e4lvOT7MsxCtOKQhGtOBaGgmJjyqioDFm4FaTuoR5IgwyK5m+vt0FSkKzLoGxJ5uGkPB8GZUGVHvmhRnaxHYT+VriQgaGCdvANwdBBjFHKKAwb9SSyhU8ZB3Ke5QM4aGimfd1r3QAAAABJRU5ErkJggg==';
const UPDATE_CHECK_DELAY_MS = 15 * 1000;
const DESKTOP_TITLE_BAR_HEIGHT = 42;

function resolveResourcePath(...segments) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, ...segments);
  }
  return path.join(__dirname, '..', ...segments);
}

function resolveIconPath(...segments) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'icons', ...segments);
  }
  return path.join(__dirname, 'icons', ...segments);
}

function getIconPath() {
  if (process.platform === 'win32') {
    return resolveIconPath('icon.ico');
  }
  if (isMac) {
    return resolveIconPath('icon.icns');
  }
  return resolveIconPath('icon.png');
}

function getTrayIcon() {
  if (isMac) {
    const image = nativeImage.createFromDataURL(`data:image/png;base64,${MAC_TRAY_TEMPLATE_PNG_BASE64}`);
    if (!image.isEmpty()) {
      const resized = image.resize({ width: MAC_TRAY_ICON_SIZE, height: MAC_TRAY_ICON_SIZE });
      resized.setTemplateImage(true);
      return resized;
    }
  }

  const trayIconPath = resolveIconPath(isMac ? '64x64.png' : '32x32.png');
  const image = nativeImage.createFromPath(trayIconPath);
  if (image.isEmpty()) {
    return image;
  }
  if (isMac) {
    const resized = image.resize({ width: MAC_TRAY_ICON_SIZE, height: MAC_TRAY_ICON_SIZE });
    resized.setTemplateImage(true);
    return resized;
  }
  return image;
}

function isUpdaterSupported() {
  return app.isPackaged && !isDev;
}

let updateStatus = {
  supported: false,
  platform: process.platform,
  currentVersion: app.getVersion(),
  status: 'unavailable',
  checking: false,
  downloading: false,
  downloaded: false,
  available: false,
  version: '',
  releaseName: '',
  releaseDate: '',
  lastCheckedAt: '',
  error: '',
  progress: null,
};
let updateCheckInFlight = null;
let autoUpdaterConfigured = false;
let updateDownloadedNotificationShown = false;

function getUpdateStatus() {
  return {
    ...updateStatus,
    supported: isUpdaterSupported(),
    platform: process.platform,
    currentVersion: app.getVersion(),
  };
}

function broadcastUpdateStatus() {
  const status = getUpdateStatus();
  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window || window.isDestroyed()) return;
    window.webContents.send('todo:updates:status', status);
  });
}

function setUpdateStatus(patch = {}) {
  updateStatus = {
    ...updateStatus,
    ...patch,
    supported: isUpdaterSupported(),
    platform: process.platform,
    currentVersion: app.getVersion(),
  };
  broadcastUpdateStatus();
  updateTrayContextMenu();
}

function normalizeUpdateInfo(info = {}) {
  return {
    version: String(info.version || ''),
    releaseName: String(info.releaseName || ''),
    releaseDate: String(info.releaseDate || ''),
  };
}

function normalizeUpdateError(error) {
  return String(error?.message || error || 'Update check failed');
}

function showUpdateDownloadedNotification(info = {}) {
  if (updateDownloadedNotificationShown || !Notification.isSupported()) return;
  updateDownloadedNotificationShown = true;
  const version = String(info.version || updateStatus.version || '').trim();
  const notification = new Notification({
    title: 'Todo update ready',
    body: version
      ? `Version ${version} has been downloaded. Restart Todo to install it.`
      : 'A new version has been downloaded. Restart Todo to install it.',
  });
  activeNotifications.add(notification);
  notification.once('click', showMainWindow);
  notification.once('close', () => activeNotifications.delete(notification));
  notification.show();
}

function configureAutoUpdater() {
  if (autoUpdaterConfigured) return;
  autoUpdaterConfigured = true;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  if (!isUpdaterSupported()) {
    setUpdateStatus({ status: isDev ? 'development' : 'unavailable' });
    return;
  }

  setUpdateStatus({
    supported: true,
    status: 'idle',
    error: '',
  });

  autoUpdater.on('checking-for-update', () => {
    setUpdateStatus({
      status: 'checking',
      checking: true,
      downloading: false,
      error: '',
      progress: null,
    });
  });

  autoUpdater.on('update-available', (info) => {
    updateDownloadedNotificationShown = false;
    setUpdateStatus({
      ...normalizeUpdateInfo(info),
      status: 'available',
      checking: false,
      downloading: false,
      downloaded: false,
      available: true,
      error: '',
      progress: null,
    });
  });

  autoUpdater.on('update-not-available', () => {
    setUpdateStatus({
      status: 'idle',
      checking: false,
      downloading: false,
      downloaded: false,
      available: false,
      error: '',
      progress: null,
      lastCheckedAt: new Date().toISOString(),
    });
  });

  autoUpdater.on('download-progress', (progress = {}) => {
    setUpdateStatus({
      status: 'downloading',
      checking: false,
      downloading: true,
      downloaded: false,
      available: true,
      error: '',
      progress: {
        percent: Number(progress.percent || 0),
        transferred: Number(progress.transferred || 0),
        total: Number(progress.total || 0),
        bytesPerSecond: Number(progress.bytesPerSecond || 0),
      },
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    setUpdateStatus({
      ...normalizeUpdateInfo(info),
      status: 'downloaded',
      checking: false,
      downloading: false,
      downloaded: true,
      available: true,
      error: '',
      progress: null,
      lastCheckedAt: new Date().toISOString(),
    });
    showUpdateDownloadedNotification(info);
  });

  autoUpdater.on('error', (error) => {
    setUpdateStatus({
      status: 'error',
      checking: false,
      downloading: false,
      error: normalizeUpdateError(error),
      lastCheckedAt: new Date().toISOString(),
    });
  });
}

async function checkForUpdates(options = {}) {
  configureAutoUpdater();
  if (!isUpdaterSupported()) {
    return getUpdateStatus();
  }
  if (updateCheckInFlight) {
    await updateCheckInFlight;
    return getUpdateStatus();
  }

  setUpdateStatus({
    status: 'checking',
    checking: true,
    error: '',
    lastCheckedAt: '',
  });

  updateCheckInFlight = autoUpdater.checkForUpdates();
  try {
    await updateCheckInFlight;
  } catch (error) {
    setUpdateStatus({
      status: 'error',
      checking: false,
      downloading: false,
      error: normalizeUpdateError(error),
      lastCheckedAt: new Date().toISOString(),
    });
    if (options.manual) {
      throw error;
    }
  } finally {
    updateCheckInFlight = null;
  }
  return getUpdateStatus();
}

function installDownloadedUpdate() {
  if (!isUpdaterSupported() || !updateStatus.downloaded) {
    throw new Error('No downloaded update is ready to install.');
  }
  isQuitting = true;
  autoUpdater.quitAndInstall(false, true);
  return true;
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
      buildDeveloperMenu(false),
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
    buildDeveloperMenu(true),
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

function buildTrayMenuTemplate() {
  const template = [
    {
      label: '显示 Todo',
      click: showMainWindow,
    },
  ];

  const status = getUpdateStatus();
  if (status.supported) {
    template.push(
      { type: 'separator' },
      status.downloaded
        ? {
            label: '重启安装更新',
            click: () => {
              try {
                installDownloadedUpdate();
              } catch (error) {
                console.error('Failed to install downloaded update:', error);
              }
            },
          }
        : {
            label: status.checking || status.downloading ? '正在检查更新...' : '检查更新',
            enabled: !status.checking && !status.downloading,
            click: () => {
              checkForUpdates({ manual: true }).catch((error) => {
                console.error('Failed to check for updates:', error);
              });
            },
          },
    );
  }

  template.push(
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  );

  return template;
}

function updateTrayContextMenu() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate(buildTrayMenuTemplate()));
}

function createTray() {
  if (tray || !keepsRunningInTray) return;

  tray = new Tray(getTrayIcon());
  tray.setToolTip('Todo');
  updateTrayContextMenu();
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
    autoHideMenuBar: !isMac,
    backgroundColor: '#fbfaf7',
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    icon: isMac ? undefined : getIconPath(),
    ...(isMac ? {
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 16, y: 14 },
    } : {}),
    ...(isWindows ? {
      titleBarStyle: 'hidden',
      titleBarOverlay: {
        color: '#00000000',
        symbolColor: '#3d3935',
        height: DESKTOP_TITLE_BAR_HEIGHT,
      },
    } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      devTools: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    if (startHidden) {
      mainWindow.hide();
      return;
    }
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
    throw new Error('Desktop notifications are not supported on this system.');
  }

  return new Promise((resolve, reject) => {
    const notification = new Notification({
      id: payload.id === undefined ? undefined : String(payload.id),
      groupId: payload.groupId || payload.group || undefined,
      title: String(payload.title || 'Todo'),
      body: String(payload.body || ''),
      sound: payload.sound || undefined,
      silent: Boolean(payload.silent),
    });

    activeNotifications.add(notification);

    let settled = false;
    const releaseTimer = setTimeout(() => {
      activeNotifications.delete(notification);
    }, NOTIFICATION_REF_TTL_MS);
    const deliveryTimer = setTimeout(() => {
      settle(resolve, true);
    }, NOTIFICATION_DELIVERY_TIMEOUT_MS);

    const cleanupDelivery = () => {
      clearTimeout(deliveryTimer);
    };
    const release = () => {
      clearTimeout(releaseTimer);
      activeNotifications.delete(notification);
    };
    const settle = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanupDelivery();
      callback(value);
    };

    notification.once('show', () => {
      settle(resolve, true);
    });
    notification.once('failed', (_event, error) => {
      const details = String(error || 'unknown error');
      const hint = isMac
        ? ' macOS Electron notifications require a code-signed app; unsigned builds emit a failed event.'
        : '';
      settle(reject, new Error(`Desktop notification failed: ${details}.${hint}`));
      release();
    });
    notification.once('click', () => {
      showMainWindow();
      release();
    });
    notification.once('close', release);

    notification.show();
  });
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
    showNotification(payload).catch((error) => {
      console.error('Failed to show scheduled notification:', error);
    });
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

function isStartupSupported() {
  return app.isPackaged && (isMac || isWindows);
}

function getWindowsLoginItemOptions() {
  return {
    path: app.getPath('exe'),
    args: [STARTUP_HIDDEN_ARG],
  };
}

function normalizeStartupSettings(settings = {}) {
  const registered = isWindows
    ? Boolean(settings.openAtLogin || settings.executableWillLaunchAtLogin)
    : Boolean(settings.openAtLogin);
  const enabled = isWindows
    ? Boolean(settings.executableWillLaunchAtLogin)
    : registered;

  return {
    supported: isStartupSupported(),
    platform: process.platform,
    packaged: app.isPackaged,
    enabled,
    registered,
    openAtLogin: Boolean(settings.openAtLogin),
    openAsHidden: Boolean(settings.openAsHidden),
    wasOpenedAtLogin: Boolean(settings.wasOpenedAtLogin),
    wasOpenedAsHidden: Boolean(settings.wasOpenedAsHidden),
    restoreState: Boolean(settings.restoreState),
    executableWillLaunchAtLogin: Boolean(settings.executableWillLaunchAtLogin),
    status: settings.status || '',
  };
}

function getStartupSettings() {
  if (!isStartupSupported()) {
    return normalizeStartupSettings();
  }

  const settings = isWindows
    ? app.getLoginItemSettings(getWindowsLoginItemOptions())
    : app.getLoginItemSettings();
  return normalizeStartupSettings(settings);
}

function setStartupEnabled(enabled) {
  if (!isStartupSupported()) {
    throw new Error('Startup launch is only available in packaged macOS and Windows builds.');
  }

  if (isWindows) {
    app.setLoginItemSettings({
      ...getWindowsLoginItemOptions(),
      openAtLogin: Boolean(enabled),
      enabled: Boolean(enabled),
    });
  } else {
    app.setLoginItemSettings({
      openAtLogin: Boolean(enabled),
      openAsHidden: true,
    });
  }

  return getStartupSettings();
}

function shouldStartHiddenAtLogin() {
  if (process.argv.includes(STARTUP_HIDDEN_ARG)) {
    return true;
  }
  if (!isMac || !app.isPackaged) {
    return false;
  }
  try {
    const settings = app.getLoginItemSettings();
    return Boolean(settings.wasOpenedAtLogin || settings.wasOpenedAsHidden);
  } catch (error) {
    console.error('Failed to read macOS login item launch state:', error);
    return false;
  }
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
  ipcMain.handle('todo:startup:get', () => getStartupSettings());
  ipcMain.handle('todo:startup:set-enabled', (_event, enabled) => setStartupEnabled(enabled));
  ipcMain.handle('todo:updates:get-status', () => getUpdateStatus());
  ipcMain.handle('todo:updates:check', () => checkForUpdates({ manual: true }));
  ipcMain.handle('todo:updates:install', () => installDownloadedUpdate());
}

app.setName('Todo');
Menu.setApplicationMenu(buildApplicationMenu());
if (isWindows) {
  app.setAppUserModelId(APP_USER_MODEL_ID);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    if (Array.isArray(commandLine) && commandLine.includes(STARTUP_HIDDEN_ARG)) {
      return;
    }
    showMainWindow();
  });

  app.whenReady().then(() => {
    startHidden = shouldStartHiddenAtLogin();
    configureAutoUpdater();
    registerIPC();
    setDockIcon();
    createTray();
    createWindow();
    if (isUpdaterSupported()) {
      setTimeout(() => {
        checkForUpdates({ manual: false }).catch((error) => {
          console.error('Initial update check failed:', error);
        });
      }, UPDATE_CHECK_DELAY_MS);
    }

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
