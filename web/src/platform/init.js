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

  let _token = null;

  // 先注入接口（token 暂 null），让 React 可以立即渲染
  window.__tokenStore = {
    get: () => _token,
    set: (token) => {
      _token = token;
      invoke('set_token', { token }).catch(console.error);
    },
    remove: () => {
      _token = null;
      invoke('remove_token').catch(console.error);
    },
  };

  // 异步从 Keychain 加载 token
  try {
    _token = await invoke('get_token');
  } catch {
    // 首次启动，Keychain 无记录
  }

  // 通知等待方：token 已就绪
  _resolveReady();
}
