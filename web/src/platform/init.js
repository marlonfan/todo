function isElectron() {
  return typeof window !== 'undefined' && Boolean(window.todoElectron);
}

function isDesktopRuntime() {
  return isElectron();
}

// App.jsx 可以 await 这个 Promise，等平台 token 初始化完成再检查 token
let _resolveReady;
const _ready = new Promise((resolve) => { _resolveReady = resolve; });
export const tokenReady = _ready;

export async function initPlatform() {
  if (!isDesktopRuntime()) {
    // Web 环境：直接用 localStorage，无需等待
    _resolveReady();
    return;
  }

  const STORAGE_KEY = 'token';  // 与 defaultTokenStore 用同一个 key
  let _token = localStorage.getItem(STORAGE_KEY) ?? null;

  window.__tokenStore = {
    get: () => _token ?? localStorage.getItem(STORAGE_KEY) ?? null,
    set: (token) => {
      _token = token;
      localStorage.setItem(STORAGE_KEY, token);
    },
    remove: () => {
      _token = null;
      localStorage.removeItem(STORAGE_KEY);
    },
  };

  // 通知等待方：token 已就绪
  _resolveReady();
}
