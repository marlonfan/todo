function buildDeveloperMenu(isMac) {
  return {
    label: isMac ? '开发' : 'Developer',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { type: 'separator' },
      {
        label: isMac ? '打开开发者工具' : 'Toggle Developer Tools',
        role: 'toggleDevTools',
        accelerator: isMac ? 'Alt+Command+I' : 'Control+Shift+I',
      },
    ],
  };
}

module.exports = {
  buildDeveloperMenu,
};
