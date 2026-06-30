import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import './i18n'  // 引入 i18n 配置
import App from './App.jsx'
import '@fontsource-variable/inter';
import './index.css'
import { queryClient } from './query/client'
import { initializeSyncEngine } from './data/syncEngine'
import { initPlatform } from './platform/init'
import { initInputModality } from './utils/inputModality'

const VIEWPORT_CONTENT = 'width=device-width, initial-scale=1.0, viewport-fit=cover';

function ensureMobileViewport() {
  if (typeof document === 'undefined') return;

  let viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) {
    viewport = document.createElement('meta');
    viewport.setAttribute('name', 'viewport');
    document.head.appendChild(viewport);
  }

  if (viewport.getAttribute('content') !== VIEWPORT_CONTENT) {
    viewport.setAttribute('content', VIEWPORT_CONTENT);
  }
}

(async () => {
  const isDesktopRuntime = Boolean(window.todoElectron);
  const shouldUseServiceWorker = 'serviceWorker' in navigator && !isDesktopRuntime && !import.meta.env.DEV;
  ensureMobileViewport();
  initInputModality();

  // Dev servers need fresh modules for HMR, so clear any SW left from older runs.
  if ('serviceWorker' in navigator && import.meta.env.DEV) {
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
    let refreshing = false;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          registration.addEventListener('updatefound', () => {
            const worker = registration.installing;
            if (!worker) return;

            worker.addEventListener('statechange', () => {
              if (worker.state === 'activated' && navigator.serviceWorker.controller) {
                if (refreshing) return;
                refreshing = true;
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
