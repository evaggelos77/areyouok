import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { usePrefs } from '../contexts/PrefsContext';
import { t } from '../lib/i18n';

export default function OfflineBanner() {
  const { lang } = usePrefs();
  const [online, setOnline] = useState<boolean>(() => navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (online) return null;

  return (
    <div className="offline safe-pad">
      <div className="offline-inner glass neon-outline">
        <WifiOff size={18} />
        <span className="small">{t(lang, 'offline')}</span>
      </div>
    </div>
  );
}
