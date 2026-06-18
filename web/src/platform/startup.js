export function getStartupRuntime() {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.todoElectron?.startup || null;
}

export function isStartupRuntimeAvailable() {
  return Boolean(getStartupRuntime());
}

export async function getStartupStatus() {
  const runtime = getStartupRuntime();
  if (!runtime) {
    return {
      supported: false,
      enabled: false,
      registered: false,
      platform: '',
      packaged: false,
      status: 'unavailable',
    };
  }
  return runtime.get();
}

export async function setStartupEnabled(enabled) {
  const runtime = getStartupRuntime();
  if (!runtime) {
    throw new Error('Startup launch is unavailable in this runtime.');
  }
  return runtime.setEnabled(Boolean(enabled));
}
