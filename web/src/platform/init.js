function isTauri() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function initPlatform() {
  if (!isTauri()) return;

  const { invoke } = await import('@tauri-apps/api/core');

  // 启动时从 Keychain 加载 token 到内存
  let _token = null;
  try {
    _token = await invoke('get_token');
  } catch {
    // 首次启动 Keychain 无记录，忽略
  }

  // 注入同步接口（内存读，异步 Keychain 写）
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

  // window.__todoPlatform 不需要覆盖：Tauri WebView 中
  // window.setInterval / addEventListener 均正常工作
}
