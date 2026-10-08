import test from 'node:test';
import assert from 'node:assert/strict';
import { isDesktopRuntime, redirectToLogin } from './runtime.js';

test('Web auth invalidation navigates to /login', () => {
  let destination;
  globalThis.window = { location: { assign: (path) => { destination = path; } } };
  assert.equal(isDesktopRuntime(), false);
  redirectToLogin();
  assert.equal(destination, '/login');
  delete globalThis.window;
});

test('Electron auth invalidation uses the hash router', () => {
  globalThis.window = { todoElectron: {}, location: { hash: '#/tasks', assign: () => assert.fail('desktop should use hash') } };
  assert.equal(isDesktopRuntime(), true);
  redirectToLogin();
  assert.equal(window.location.hash, '#/login');
  delete globalThis.window;
});
