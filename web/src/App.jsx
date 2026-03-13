import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import MainLayout from './components/MainLayout';
import { authAPI, getToken, getTokenStore } from './api/client';
import { setUserTimezone } from './utils/time';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
        .catch(() => {
          getTokenStore().remove();
          localStorage.removeItem('user');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#eaf2ff]">
        <div className="md-card px-6 py-4 text-base font-medium text-slate-700">Loading...</div>
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
