const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('todoElectron', {
  platform: process.platform,
  notifications: {
    isSupported: () => ipcRenderer.invoke('todo:notifications:is-supported'),
    isPermissionGranted: () => ipcRenderer.invoke('todo:notifications:is-permission-granted'),
    requestPermission: () => ipcRenderer.invoke('todo:notifications:request-permission'),
    send: (payload) => ipcRenderer.invoke('todo:notifications:send', payload),
    cancel: (ids) => ipcRenderer.invoke('todo:notifications:cancel', ids),
  },
});
