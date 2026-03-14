function isTauri() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

// App.jsx 可以 await 这个 Promise，等 Keychain 读完再检查 token
let _resolveReady;
const _ready = new Promise((resolve) => { _resolveReady = resolve; });
export const tokenReady = _ready;

export async function initPlatform() {
  if (!isTauri()) {
    // Web 环境：直接用 localStorage，无需等待
    _resolveReady();
    return;
  }

  const { invoke } = await import('@tauri-apps/api/core');

  const STORAGE_KEY = 'token';  // 与 defaultTokenStore 用同一个 key
  let _token = null;

  // 先注入接口（token 暂 null），让 React 可以立即渲染
  window.__tokenStore = {
    get: () => _token ?? localStorage.getItem(STORAGE_KEY) ?? null,
    set: (token) => {
      _token = token;
      localStorage.setItem(STORAGE_KEY, token);
      invoke('set_token', { token }).catch((err) => console.error('[Tauri] set_token:', err));
    },
    remove: () => {
      _token = null;
      localStorage.removeItem(STORAGE_KEY);
      invoke('remove_token').catch((err) => console.error('[Tauri] remove_token:', err));
    },
  };

  // 从 Keychain 加载，成功则同步到 localStorage
  try {
    _token = await invoke('get_token');
    if (_token) {
      localStorage.setItem(STORAGE_KEY, _token);
    }
  } catch (err) {
    console.error('[Tauri] get_token:', err);
  }

  // Keychain 为空，从 localStorage 读
  if (!_token) {
    _token = localStorage.getItem(STORAGE_KEY) ?? null;
  }

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
