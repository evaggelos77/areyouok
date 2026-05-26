import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, Info } from 'lucide-react';
import { usePrefs } from '../contexts/PrefsContext';
import { t } from '../lib/i18n';
import {
  clearDeferredInstallPrompt,
  getDeferredInstallPrompt,
  initInstallPromptCapture,
  isAppleMobile,
  isStandaloneDisplay,
  subscribeInstallPrompt
} from '../lib/installPrompt';

export default function InstallBanner({ compact = false }: { compact?: boolean }) {
  const { lang } = usePrefs();
  const [deferred, setDeferred] = useState(() => getDeferredInstallPrompt());
  const [showIosHint, setShowIosHint] = useState(false);

  const iosLike = useMemo(() => isAppleMobile(), []);
  const visible = !isStandaloneDisplay() && (Boolean(deferred) || iosLike);

  useEffect(() => {
    initInstallPromptCapture();
    const sync = () => setDeferred(getDeferredInstallPrompt());
    sync();
    return subscribeInstallPrompt(sync);
  }, []);

  if (!visible) return null;

  const onInstall = async () => {
    if (!deferred) {
      setShowIosHint((v) => !v);
      return;
    }

    try {
      await deferred.prompt();
      await deferred.userChoice;
    } finally {
      clearDeferredInstallPrompt();
      setDeferred(null);
    }
  };

  return (
    <div className={compact ? 'install-banner install-banner-compact' : 'install-banner safe-pad'}>
      <div className="install-inner glass neon-outline">
        <div className="install-copy">
          <div className="install-title">{t(lang, 'installTitle')}</div>
          <div className="muted small install-subcopy">
            {iosLike && !deferred ? t(lang, 'installIOSShort') : t(lang, 'installPromptLine')}
          </div>
        </div>

        <div className="install-actions">
          <button className="btn btn-grad install-cta" onClick={onInstall}>
            <ArrowDownToLine size={18} />
            {t(lang, 'installTitle')}
          </button>
          <div className="muted small install-note">{t(lang, 'installNote')}</div>
          {iosLike && !deferred && showIosHint ? (
            <div className="install-tip" role="note" aria-live="polite">
              <Info size={16} />
              <span>{t(lang, 'installIOSHint')}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
