function isTauri() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

// App.jsx 可以 await 这个 Promise，等平台 token 初始化完成再检查 token
let _resolveReady;
const _ready = new Promise((resolve) => { _resolveReady = resolve; });
export const tokenReady = _ready;

export async function initPlatform() {
  if (!isTauri()) {
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

  // 迁移：读取上一版本写入的旧 key
  if (!_token) {
    const legacy = localStorage.getItem('__tauri_auth_token__');
    if (legacy) {
      _token = legacy;
      localStorage.setItem(STORAGE_KEY, _token);
      localStorage.removeItem('__tauri_auth_token__');
    }
  }

  // 通知等待方：token 已就绪
  _resolveReady();
}
