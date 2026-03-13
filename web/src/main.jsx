import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import './i18n'  // 引入 i18n 配置
import App from './App.jsx'
import './index.css'
import { queryClient } from './query/client'
import { initializeSyncEngine } from './data/syncEngine'
import { initPlatform } from './platform/init'

(async () => {
  // Service Worker：Tauri 桌面端不需要
  if ('serviceWorker' in navigator && !('__TAURI_INTERNALS__' in window)) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('Service worker registration failed:', err);
      });
    });
  }

  await initPlatform();  // 在 Tauri 中注入 __tokenStore

  initializeSyncEngine(queryClient);

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>,
  );
})();
