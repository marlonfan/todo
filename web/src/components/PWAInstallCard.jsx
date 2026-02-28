import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

function isIOSDevice() {
  const ua = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua);
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function PWAInstallCard() {
  const { t } = useTranslation();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  if (installed) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
        {t('settings.pwaInstalled')}
      </div>
    );
  }

  const ios = typeof window !== 'undefined' && isIOSDevice();

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm font-medium text-slate-700">{t('settings.pwaTitle')}</p>
      <p className="mt-1 text-xs text-slate-500">{t('settings.pwaHint')}</p>
      {deferredPrompt ? (
        <button
          type="button"
          className="btn-primary mt-3"
          onClick={async () => {
            deferredPrompt.prompt();
            await deferredPrompt.userChoice;
            setDeferredPrompt(null);
          }}
        >
          {t('settings.pwaInstall')}
        </button>
      ) : ios ? (
        <p className="mt-2 text-xs text-slate-600">{t('settings.pwaIOSHint')}</p>
      ) : (
        <p className="mt-2 text-xs text-slate-500">{t('settings.pwaWaiting')}</p>
      )}
    </div>
  );
}

export default PWAInstallCard;
