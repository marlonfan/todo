export function isDesktopRuntime() {
  return typeof window !== 'undefined' && Boolean(window.todoElectron);
}

export function redirectToLogin() {
  if (isDesktopRuntime()) {
    window.location.hash = '#/login';
  } else {
    window.location.assign('/login');
  }
}
