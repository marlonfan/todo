import test from 'node:test';
import assert from 'node:assert/strict';
import { registerServiceWorkerUpdates } from './serviceWorkerUpdates.js';

function fixture(controller = null) {
  const serviceWorker = new EventTarget();
  serviceWorker.controller = controller;
  let registrations = 0;
  let reloads = 0;
  serviceWorker.register = async (url) => { assert.equal(url, '/sw.js'); registrations += 1; };
  const registered = registerServiceWorkerUpdates(serviceWorker, () => { reloads += 1; });
  return {
    serviceWorker, registered,
    counts: () => ({ registrations, reloads }),
    change: (next) => { serviceWorker.controller = next; serviceWorker.dispatchEvent(new Event('controllerchange')); },
  };
}

test('first service worker activation preserves the current page and user input', async () => {
  const worker = fixture();
  await worker.registered;
  worker.change({ version: 1 });
  assert.deepEqual(worker.counts(), { registrations: 1, reloads: 0 });
});

test('a replacement worker reloads exactly once after first installation', async () => {
  const worker = fixture();
  await worker.registered;
  worker.change({ version: 1 });
  const replacement = { version: 2 };
  worker.change(replacement);
  worker.change(replacement);
  worker.change({ version: 3 });
  assert.equal(worker.counts().reloads, 1);
});

test('an existing controller only reloads when it is replaced', async () => {
  const current = { version: 1 };
  const worker = fixture(current);
  await worker.registered;
  worker.change(current);
  assert.equal(worker.counts().reloads, 0);
  worker.change({ version: 2 });
  assert.equal(worker.counts().reloads, 1);
});
