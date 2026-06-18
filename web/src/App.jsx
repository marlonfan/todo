import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import MainLayout from './components/MainLayout';
import { authAPI, getToken, getTokenStore } from './api/client';
import { tokenReady } from './platform/init';
import { setUserTimezone } from './utils/time';
import { scheduleSync } from './data/syncEngine';

function App() {
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
            scheduleSync();
          })
          .catch(() => {
            getTokenStore().remove();
            localStorage.removeItem('user');
          })
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--blue-surface))] px-4">
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

  return (
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
          ) : (
            <Navigate to="/login" />
          )
        }
      />
    </Routes>
  );
}

export default App;
