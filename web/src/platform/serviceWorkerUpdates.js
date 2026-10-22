// First-time SW installation must not reload the page and discard form input.
// This worker uses skipWaiting + clients.claim, so controllerchange is the single
// signal that a replacement worker has actually taken control.
export function registerServiceWorkerUpdates(serviceWorker, reload) {
  let controller = serviceWorker.controller;
  let refreshing = false;
  serviceWorker.addEventListener('controllerchange', () => {
    const previous = controller;
    controller = serviceWorker.controller;
    if (!previous || !controller || previous === controller || refreshing) return;
    refreshing = true;
    reload();
  });
  return serviceWorker.register('/sw.js');
}
