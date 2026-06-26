import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import './i18n'  // 引入 i18n 配置
import App from './App.jsx'
import '@fontsource-variable/inter';
import '@todo/vendor-marktext-muya/lib/core.css'
import './index.css'
import { queryClient } from './query/client'
import { initializeSyncEngine } from './data/syncEngine'
import { initPlatform } from './platform/init'
import { initInputModality } from './utils/inputModality'

(async () => {
  const isDesktopRuntime = Boolean(window.todoElectron);
  const isLocalPreviewHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
  const shouldDisableServiceWorker = isDesktopRuntime || import.meta.env.DEV || isLocalPreviewHost;
  const shouldUseServiceWorker = 'serviceWorker' in navigator && !shouldDisableServiceWorker;
  initInputModality();

  // Local preview and desktop builds should always use the freshly served bundle.
  if ('serviceWorker' in navigator && shouldDisableServiceWorker) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .catch((err) => {
          console.error('Service worker unregister failed:', err);
        });

      if ('caches' in window) {
        caches
          .keys()
          .then((keys) => Promise.all(keys.filter((key) => key.startsWith('todo-kimi-cache')).map((key) => caches.delete(key))))
          .catch((err) => {
            console.error('Service worker cache cleanup failed:', err);
          });
      }
    });
  }

  // Service Worker：桌面端和 Vite 开发模式不需要
  if (shouldUseServiceWorker) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          registration.addEventListener('updatefound', () => {
            const worker = registration.installing;
            if (!worker) return;

            worker.addEventListener('statechange', () => {
              if (worker.state === 'activated' && navigator.serviceWorker.controller) {
                window.location.reload();
              }
            });
          });
        })
        .catch((err) => {
          console.error('Service worker registration failed:', err);
        });
    });
  }

  // 不阻塞——先渲染，平台初始化在后台进行
  initPlatform();

  initializeSyncEngine(queryClient);
  const Router = isDesktopRuntime ? HashRouter : BrowserRouter;

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <Router>
          <App />
        </Router>
      </QueryClientProvider>
    </React.StrictMode>,
  );
})();
