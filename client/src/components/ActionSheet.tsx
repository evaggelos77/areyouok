import React from 'react';
import { CheckCircle2, PhoneCall, AlertTriangle, MapPin, X } from 'lucide-react';
import { usePrefs } from '../contexts/PrefsContext';
import { t } from '../lib/i18n';

export type QuickAction = 'ok' | 'call_me' | 'need_help' | 'share_location_10';

export default function ActionSheet({
  open,
  onClose,
  onAction
}: {
  open: boolean;
  onClose: () => void;
  onAction: (a: QuickAction) => void;
}) {
  const { lang } = usePrefs();

  if (!open) return null;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet glass neon-outline" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div className="sheet-title">{t(lang, 'quickActions')}</div>
          <button className="icon-btn" onClick={onClose} aria-label={t(lang, 'cancel')}>
            <X size={18} />
          </button>
        </div>

        <div className="sheet-actions">
          <button className="btn btn-ok" onClick={() => onAction('ok')}>
            <CheckCircle2 size={18} />
            {t(lang, 'iAmOk')}
          </button>
          <button className="btn btn-primary" onClick={() => onAction('call_me')}>
            <PhoneCall size={18} />
            {t(lang, 'callMe')}
          </button>
          <button className="btn btn-sos" onClick={() => onAction('need_help')}>
            <AlertTriangle size={18} />
            {t(lang, 'notOk')}
          </button>
          <button className="btn btn-secondary" onClick={() => onAction('share_location_10')}>
            <MapPin size={18} />
            {t(lang, 'shareLocation10')}
          </button>

          <button className="btn btn-secondary" onClick={onClose}>
            {t(lang, 'cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
