const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDeveloperMenu } = require('./menu.cjs');

test('production menu exposes the macOS developer tools shortcut', () => {
  const menu = buildDeveloperMenu(true);
  const devTools = menu.submenu.find((item) => item.role === 'toggleDevTools');

  assert.equal(menu.label, '开发');
  assert.equal(devTools.accelerator, 'Alt+Command+I');
});

test('production menu exposes the Windows and Linux developer tools shortcut', () => {
  const menu = buildDeveloperMenu(false);
  const devTools = menu.submenu.find((item) => item.role === 'toggleDevTools');

  assert.equal(menu.label, 'Developer');
  assert.equal(devTools.accelerator, 'Control+Shift+I');
});
