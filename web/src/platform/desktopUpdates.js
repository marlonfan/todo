export function getDesktopUpdateRuntime() {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.todoElectron?.updates || null;
}

export function isDesktopUpdateRuntimeAvailable() {
  return Boolean(getDesktopUpdateRuntime());
}

export async function getDesktopUpdateStatus() {
  const runtime = getDesktopUpdateRuntime();
  if (!runtime) {
    return {
      supported: false,
      currentVersion: '',
      status: 'unavailable',
      checking: false,
      downloading: false,
      downloaded: false,
      available: false,
      version: '',
      error: '',
      progress: null,
    };
  }
  return runtime.getStatus();
}

export async function checkForDesktopUpdates() {
  const runtime = getDesktopUpdateRuntime();
  if (!runtime) {
    throw new Error('Desktop updates are unavailable in this runtime.');
  }
  return runtime.check();
}

export async function installDesktopUpdate() {
  const runtime = getDesktopUpdateRuntime();
  if (!runtime) {
    throw new Error('Desktop updates are unavailable in this runtime.');
  }
  return runtime.install();
}

export function onDesktopUpdateStatus(callback) {
  const runtime = getDesktopUpdateRuntime();
  if (!runtime || typeof runtime.onStatus !== 'function') {
    return () => {};
  }
  return runtime.onStatus(callback);
}
