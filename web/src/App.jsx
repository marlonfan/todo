import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authAPI, getToken, getTokenStore } from './api/client';
import { tokenReady } from './platform/init';
import { setUserTimezone } from './utils/time';
import { clearAuthenticatedLocalState, initializeSyncEngine, stopSyncEngine } from './data/syncEngine';
import { queryClient } from './query/client';
import ErrorBoundary from './components/ErrorBoundary';

const Login = lazy(() => import('./components/Login'));
const Register = lazy(() => import('./components/Register'));
const MainLayout = lazy(() => import('./components/MainLayout'));
const Landing = lazy(() => import('./components/Landing'));

// PWA / Electron 直接进功能页（未登录进登录页）；仅 Web 浏览器显示 landing
const isNativeApp = typeof window !== 'undefined' && (
  Boolean(window.todoElectron)
  || (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches)
);

function AppLoadingSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--card))] px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-sm" aria-label="Loading">
        <div className="mb-5 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-slate-200" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 w-32 rounded-full bg-slate-200" />
            <div className="h-2.5 w-24 rounded-full bg-slate-100" />
          </div>
        </div>
        <div className="space-y-3">
          <div className="h-9 rounded-md bg-slate-100" />
          <div className="h-9 rounded-md bg-slate-100" />
          <div className="h-9 rounded-md bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

function App() {
  const { t } = useTranslation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tokenReady.then(() => {
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.timezone) {
          setUserTimezone(user.timezone, false);
        }
      } catch {
        // ignore invalid cached user data
      }

      const token = getToken();
      if (token) {
        authAPI.me()
          .then((res) => {
            setUser(res.data);
            localStorage.setItem('user', JSON.stringify(res.data));
            if (res.data.timezone) {
              setUserTimezone(res.data.timezone, false);
            }
          })
          .catch(async () => {
            getTokenStore().remove();
            localStorage.removeItem('user');
            await clearAuthenticatedLocalState(queryClient);
          })
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!user) {
      stopSyncEngine();
      return undefined;
    }
    initializeSyncEngine(queryClient);
    return () => stopSyncEngine();
  }, [user]);

  useEffect(() => {
    const handleAuthInvalidated = async () => {
      await clearAuthenticatedLocalState(queryClient);
      setUser(null);
      if (isDesktopRuntime) {
        window.location.hash = '#/login';
      } else {
        window.location.assign('/login');
      }
    };
    window.addEventListener('todo:auth-invalidated', handleAuthInvalidated);
    return () => window.removeEventListener('todo:auth-invalidated', handleAuthInvalidated);
  }, []);

  if (loading) {
    return <AppLoadingSkeleton />;
  }

  return (
    <ErrorBoundary
      title={t('common.somethingWentWrong')}
      message={t('common.reloadPageHint')}
      resetLabel={t('common.tryAgain')}
      reloadLabel={t('common.reload')}
    >
      <Suspense fallback={<AppLoadingSkeleton />}>
        <Routes>
          <Route
            path="/login"
            element={user ? <Navigate to="/" /> : <Login setUser={setUser} />}
          />
          <Route
            path="/register"
            element={user ? <Navigate to="/" /> : <Register setUser={setUser} />}
          />
          <Route
            path="/*"
            element={
              user ? (
                <MainLayout user={user} setUser={setUser} />
              ) : isNativeApp ? (
                <Navigate to="/login" />
              ) : (
                <Landing />
              )
            }
          />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
