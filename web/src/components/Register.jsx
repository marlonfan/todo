import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authAPI } from '../api/client';

function Register({ setUser }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      await authAPI.register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
      });
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--blue-surface))] px-4">
      <div className="md-card w-full max-w-md space-y-7 p-8">
        <div>
          <h2 className="text-3xl font-bold text-center text-slate-900">{t('app.name')}</h2>
          <p className="mt-2 text-center text-slate-600">{t('auth.registerTitle')}</p>
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
              data-testid="register-username-input"
              className="form-input"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            />
          </div>

          <div>
            <label className="form-label">{t('auth.email')}</label>
            <input
              type="email"
              required
              data-testid="register-email-input"
              className="form-input"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div>
            <label className="form-label">{t('auth.password')}</label>
            <input
              type="password"
              required
              minLength={6}
              data-testid="register-password-input"
              className="form-input"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          <div>
            <label className="form-label">{t('auth.confirmPassword')}</label>
            <input
              type="password"
              required
              data-testid="register-confirm-password-input"
              className="form-input"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            data-testid="register-submit-button"
            className="w-full btn-primary disabled:opacity-50"
          >
            {loading ? t('common.loading') : t('auth.register')}
          </button>
        </form>

        <div className="text-center">
          <p className="text-slate-600">
            {t('auth.hasAccount')}{' '}
            <Link to="/login" className="text-blue-600 hover:text-blue-800">
              {t('auth.login')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
