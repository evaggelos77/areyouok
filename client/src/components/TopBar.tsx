import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePrefs } from '../contexts/PrefsContext';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../lib/api';
import { t } from '../lib/i18n';

export default function TopBar() {
  const prefs = usePrefs();
  const auth = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const onLangChange = async (lang: 'el' | 'en') => {
    prefs.setLang(lang);
    if (auth.user) {
      try {
        await apiFetch('/api/profile', {
          method: 'PUT',
          body: JSON.stringify({ language: lang })
        });
        await auth.refresh();
      } catch {
        // ignore
      }
    }
  };

  return (
    <div className="topbar safe-pad safe-top">
      <div className="topbar-left">
        {loc.pathname !== '/' ? (
          <button
            className="back-btn"
            onClick={() => {
              const idx = (window.history.state && (window.history.state as any).idx) || 0;
              if (idx > 0) nav(-1);
              else nav('/');
            }}
            aria-label={prefs.lang === 'el' ? 'Πίσω' : 'Back'}
          >
            <span aria-hidden>⟵</span>
            <span>{prefs.lang === 'el' ? 'Πίσω' : 'Back'}</span>
          </button>
        ) : null}

        <div className="brand-row" onClick={() => nav('/')} role="button" aria-label="home">
          <img className="brand-mark" src="/logo-symbol.png" alt="AreYouOK" />
          {loc.pathname === '/' ? (
            <div className="brand">
              <span className="brand-are">Are</span>
              <span className="brand-you">You</span>
              <span className="brand-ok">OK</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="topbar-right">
        <button className="help-btn" onClick={() => nav('/help')} aria-label="help">
          ?
        </button>
        <select
          className="lang-select"
          value={prefs.lang}
          onChange={(e) => onLangChange(e.target.value as 'el' | 'en')}
          aria-label="language"
        >
          <option value="el">{t(prefs.lang, 'languageGreek')}</option>
          <option value="en">{t(prefs.lang, 'languageEnglish')}</option>
        </select>
        <div className="avatar">
          <span>{(auth.user?.name || auth.user?.email || '?').slice(0, 1).toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
}
