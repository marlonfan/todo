import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { notifyAPI, authAPI } from '../api/client';
import {
  getLocalNotificationRefreshSeconds,
  getLocalNotificationStatus,
  isLocalNotificationEnabled,
  onLocalNotificationStatusChange,
  requestLocalNotificationPermission,
  scheduleLocalNotificationRefresh,
  sendLocalNotificationTest,
  setLocalNotificationEnabled,
  setLocalNotificationRefreshSeconds,
} from '../platform/localNotifications';
import Select from './ui/Select';
import { Checkbox } from './ui/Checkbox';
import { useConfirmDialog } from './ui/useConfirmDialog';

function NotificationSettings() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState([]);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [localEnabled, setLocalEnabled] = useState(isLocalNotificationEnabled());
  const [localRefreshSeconds, setLocalRefreshSeconds] = useState(getLocalNotificationRefreshSeconds());
  const [localStatus, setLocalStatus] = useState(getLocalNotificationStatus());
  
  // Form state
  const [selectedChannel, setSelectedChannel] = useState('');
  const [config, setConfig] = useState({});
  const [newSettingDefault, setNewSettingDefault] = useState(false);
  const { requestConfirm, confirmDialog } = useConfirmDialog({
    title: t('common.confirm'),
    cancelLabel: t('common.cancel'),
    confirmLabel: t('common.confirm'),
  });

  useEffect(() => {
    fetchSettings();
    fetchChannels();
    const unlisten = onLocalNotificationStatusChange(setLocalStatus);
    setLocalStatus(getLocalNotificationStatus());
    return unlisten;
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await notifyAPI.getSettings();
      setSettings(res.data);
    } catch (err) {
      setError(t('notification.loadSettingsFailed'));
    }
  };

  const fetchChannels = async () => {
    try {
      const res = await notifyAPI.getChannels();
      setChannels(res.data.channels);
      if (res.data.channels.length > 0) {
        setSelectedChannel(res.data.channels[0]);
      }
    } catch (err) {
      console.error('Failed to fetch channels:', err);
    }
  };

  const handleAddSetting = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await notifyAPI.createSetting({
        channel: selectedChannel,
        config,
        is_default: newSettingDefault,
      });
      setConfig({});
      setNewSettingDefault(false);
      await fetchSettings();
      setSuccess(t('settings.saveSuccess'));
    } catch (err) {
      setError(err.response?.data?.error || t('common.loading'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSetting = async (id) => {
    const confirmed = await requestConfirm(t('common.confirm'), {
      confirmLabel: t('common.delete'),
      confirmVariant: 'destructive',
    });
    if (!confirmed) return;

    try {
      await notifyAPI.deleteSetting(id);
      fetchSettings();
    } catch (err) {
      setError(err.response?.data?.error || t('notification.deleteFailed'));
    }
  };

  const handleTest = async (channel, config) => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await notifyAPI.test({ channel, config });
      setSuccess(t('notification.testSuccess'));
    } catch (err) {
      setError(err.response?.data?.error || t('notification.testFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (id) => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await notifyAPI.setDefaultSetting(id);
      await fetchSettings();
      setSuccess(t('settings.saveSuccess'));
    } catch (err) {
      setError(err.response?.data?.error || t('settings.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleReconcileReminders = async () => {
    const confirmed = await requestConfirm(t('notification.reconcileConfirm'));
    if (!confirmed) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await authAPI.reconcileReminders();
      setSuccess(t('notification.reconcileSuccess'));
    } catch (err) {
      setError(err.response?.data?.error || t('notification.reconcileFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleLocalNotificationToggle = (enabled) => {
    setLocalEnabled(enabled);
    setLocalNotificationEnabled(enabled);
    setLocalStatus(getLocalNotificationStatus());
    setSuccess(enabled ? t('notification.local.enabled') : t('notification.local.disabled'));
  };

  const handleLocalRefreshChange = (nextValue) => {
    const applied = setLocalNotificationRefreshSeconds(nextValue);
    setLocalRefreshSeconds(applied);
    setLocalStatus(getLocalNotificationStatus());
    setSuccess(t('notification.local.refreshSaved'));
  };

  const handleRequestLocalPermission = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const granted = await requestLocalNotificationPermission();
      setLocalStatus(getLocalNotificationStatus());
      if (!granted) {
        setError(t('notification.local.permissionDenied'));
        return;
      }
      scheduleLocalNotificationRefresh({ reason: 'permission-granted', immediate: true });
      setSuccess(t('notification.local.permissionGranted'));
    } catch (err) {
      setError(err?.message || t('notification.local.permissionFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleLocalTest = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await sendLocalNotificationTest();
      setLocalStatus(getLocalNotificationStatus());
      setSuccess(t('notification.local.testSuccess'));
    } catch (err) {
      setError(err?.message || t('notification.local.testFailed'));
    } finally {
      setLoading(false);
    }
  };

  const renderConfigFields = () => {
    switch (selectedChannel) {
      case 'telegram':
        return (
          <>
            <div>
              <label className="form-label">{t('notification.telegram.botToken')}</label>
              <input
                type="text"
                value={config.bot_token || ''}
                onChange={(e) => setConfig({ ...config, bot_token: e.target.value })}
                placeholder={t('notification.telegram.botTokenPlaceholder')}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">{t('notification.telegram.chatId')}</label>
              <input
                type="text"
                value={config.chat_id || ''}
                onChange={(e) => setConfig({ ...config, chat_id: e.target.value })}
                placeholder={t('notification.telegram.chatIdPlaceholder')}
                className="form-input"
              />
            </div>
          </>
        );
      case 'ntfy':
        return (
          <>
            <div>
              <label className="form-label">{t('notification.ntfy.serverUrl')}</label>
              <input
                type="text"
                value={config.server_url || ''}
                onChange={(e) => setConfig({ ...config, server_url: e.target.value })}
                placeholder="https://ntfy.sh"
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">{t('notification.ntfy.topic')}</label>
              <input
                type="text"
                value={config.topic || ''}
                onChange={(e) => setConfig({ ...config, topic: e.target.value })}
                placeholder={t('notification.ntfy.topicPlaceholder')}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">{t('notification.ntfy.priority')}</label>
              <input
                type="number"
                min="1"
                max="5"
                value={config.priority || '3'}
                onChange={(e) => setConfig({ ...config, priority: e.target.value })}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">{t('notification.ntfy.token')}</label>
              <input
                type="password"
                value={config.token || ''}
                onChange={(e) => setConfig({ ...config, token: e.target.value })}
                placeholder={t('notification.ntfy.tokenPlaceholder')}
                className="form-input"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t('notification.ntfy.tokenHint')}
              </p>
            </div>
          </>
        );
      case 'webhook':
        return (
          <>
            <div>
              <label className="form-label">{t('notification.webhook.url')}</label>
              <input
                type="text"
                value={config.url || ''}
                onChange={(e) => setConfig({ ...config, url: e.target.value })}
                placeholder={t('notification.webhook.urlPlaceholder')}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">{t('notification.webhook.method')}</label>
              <Select
                value={config.method || 'POST'}
                onChange={(e) => setConfig({ ...config, method: e.target.value })}
                className="form-select"
              >
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
              </Select>
            </div>
          </>
        );
      default:
        return null;
    }
  };

  const getChannelIcon = (channel) => {
    switch (channel) {
      case 'telegram': return '📱';
      case 'ntfy': return '🔔';
      case 'webhook': return '🔗';
      default: return '📢';
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}

      <div className="bg-card p-4 border border-border">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-medium mb-2">{t('notification.local.title')}</h3>
            <p className="text-sm text-muted-foreground">{t('notification.local.hint')}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('notification.local.status')}: <span className="font-medium">{localStatus.supported ? t(`notification.local.permission.${localStatus.permission}`) : t('notification.local.unsupported')}</span>
            </p>
          </div>
          <label className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground lg:shrink-0">
            <Checkbox
              checked={localEnabled}
              onChange={(e) => handleLocalNotificationToggle(e.target.checked)}
              disabled={!localStatus.supported}
            />
            <span className="whitespace-nowrap">{t('notification.local.enable')}</span>
          </label>
        </div>

        <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
          <div className="min-w-0">
            <label className="form-label">{t('notification.local.refreshInterval')}</label>
            <Select
              value={String(localRefreshSeconds)}
              onChange={(e) => handleLocalRefreshChange(e.target.value)}
              className="form-select"
              disabled={!localStatus.supported || !localEnabled}
            >
              <option value="0">{t('notification.local.refreshDisabled')}</option>
              <option value="60">{t('notification.local.refresh60')}</option>
              <option value="120">{t('notification.local.refresh120')}</option>
              <option value="300">{t('notification.local.refresh300')}</option>
              <option value="600">{t('notification.local.refresh600')}</option>
            </Select>
          </div>
          <div className="flex min-w-0 flex-wrap items-end gap-2">
            <button
              type="button"
              onClick={handleRequestLocalPermission}
              disabled={loading || !localStatus.supported || !localEnabled}
              className="btn-secondary min-w-0"
            >
              {t('notification.local.requestPermission')}
            </button>
            <button
              type="button"
              onClick={handleLocalTest}
              disabled={loading || !localStatus.supported || !localEnabled}
              className="btn-secondary min-w-0"
            >
              {t('notification.local.test')}
            </button>
          </div>
        </div>
      </div>

      {/* Add New Setting */}
      <div className="bg-card p-4 border border-border">
        <h3 className="text-lg font-medium mb-4">{t('notification.addChannel')}</h3>
        
        <div className="space-y-4">
          <div>
            <label className="form-label">{t('notification.channel')}</label>
            <Select
              value={selectedChannel}
              onChange={(e) => {
                setSelectedChannel(e.target.value);
                setConfig({});
              }}
              className="form-select"
            >
              {channels.map((ch) => (
                <option key={ch} value={ch}>
                  {getChannelIcon(ch)} {ch.charAt(0).toUpperCase() + ch.slice(1)}
                </option>
              ))}
            </Select>
          </div>

          {renderConfigFields()}

          <label className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox
              checked={newSettingDefault}
              onChange={(e) => setNewSettingDefault(e.target.checked)}
            />
            {t('common.default')}
          </label>

          <div className="flex gap-2">
            <button
              onClick={handleAddSetting}
              disabled={loading}
              className="btn-primary"
            >
              {t('common.add')}
            </button>
            <button
              onClick={() => handleTest(selectedChannel, config)}
              disabled={loading}
              className="btn-secondary"
            >
              {t('notification.test')}
            </button>
          </div>
        </div>
      </div>

      {/* Existing Settings */}
      <div className="bg-card border border-border">
        <div className="p-4 border-b border-border">
          <h3 className="font-medium">{t('settings.notifications')}</h3>
        </div>
        
        {settings.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {t('notification.noSettings')}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {settings.map((setting) => (
              <li key={setting.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span>{getChannelIcon(setting.channel)}</span>
                      <span className="font-medium capitalize">{setting.channel}</span>
                      {setting.is_default && (
                        <span className="bg-accent text-primary text-xs px-2 py-0.5 rounded">
                          {t('common.default')}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {Object.entries(setting.config).map(([key, value]) => {
                        if (key === 'token') return null;
                        return (
                          <div key={key}>
                            <span className="font-medium">{key}:</span>{' '}
                            {key.includes('token') || key.includes('password')
                              ? '***'
                              : value}
                          </div>
                        );
                      })}
                      {setting.config.token && (
                        <div className="text-xs text-muted-foreground">
                          {t('notification.authEnabled')}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!setting.is_default && (
                      <button
                        onClick={() => handleSetDefault(setting.id)}
                        disabled={loading}
                        className="text-indigo-600 hover:text-indigo-800 text-sm"
                      >
                        {t('common.default')}
                      </button>
                    )}
                    <button
                      onClick={() => handleTest(setting.channel, setting.config)}
                      disabled={loading}
                      className="text-primary hover:text-primary text-sm"
                    >
                      {t('notification.test')}
                    </button>
                    <button
                      onClick={() => handleDeleteSetting(setting.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Rebuild Reminders */}
      <div className="bg-card border border-border p-4">
        <h3 className="text-lg font-medium mb-2">{t('notification.rebuildReminders')}</h3>
        <p className="text-sm text-muted-foreground mb-4">{t('notification.rebuildRemindersHint')}</p>
        <button
          onClick={handleReconcileReminders}
          disabled={loading}
          className="btn-secondary"
        >
          {t('notification.rebuildRemindersBtn')}
        </button>
      </div>
      {confirmDialog}
    </div>
  );
}

export default NotificationSettings;
