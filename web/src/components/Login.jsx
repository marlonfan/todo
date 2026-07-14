import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authAPI, getTokenStore } from '../api/client';
import { setUserTimezone } from '../utils/time';

function Login({ setUser }) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await authAPI.login(formData);
      getTokenStore().set(res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      if (res.data.user?.timezone) {
        setUserTimezone(res.data.user.timezone, false);
      }
      setUser(res.data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--card))] px-4">
      <div className="md-card w-full max-w-md space-y-7 p-8">
        <div>
          <h2 className="text-3xl font-bold text-center text-foreground">{t('app.name')}</h2>
          <p className="mt-2 text-center text-muted-foreground">{t('auth.loginTitle')}</p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label className="form-label">{t('auth.username')}</label>
            <input
              type="text"
              required
              data-testid="login-username-input"
              className="form-input"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            />
          </div>

          <div>
            <label className="form-label">{t('auth.password')}</label>
            <input
              type="password"
              required
              data-testid="login-password-input"
              className="form-input"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            data-testid="login-submit-button"
            className="w-full btn-primary disabled:opacity-50"
          >
            {loading ? t('common.loading') : t('auth.login')}
          </button>
        </form>

        <div className="text-center">
          <p className="text-muted-foreground">
            {t('auth.noAccount')}{' '}
            <Link to="/register" className="text-primary hover:text-primary">
              {t('auth.register')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
