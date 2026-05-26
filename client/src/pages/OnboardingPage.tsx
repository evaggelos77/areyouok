import React, { useState } from 'react';
import { ArrowRight, User, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePrefs } from '../contexts/PrefsContext';
import InstallBanner from '../components/InstallBanner';
import { apiFetch } from '../lib/api';
import { t } from '../lib/i18n';

export default function OnboardingPage() {
  const auth = useAuth();
  const prefs = usePrefs();

  const [step, setStep] = useState<1 | 2>(1);
  const [mode, setMode] = useState<'teen' | 'adult' | 'senior'>(prefs.mode);
  const [role, setRole] = useState<'user' | 'circle'>(auth.user?.role || 'user');
  const [busy, setBusy] = useState(false);

  const onNext = async () => {
    if (step === 1) {
      prefs.setMode(mode);
      setStep(2);
      return;
    }

    setBusy(true);
    try {
      await apiFetch('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({ mode, role, language: prefs.lang, theme: prefs.theme, onboarded: true })
      });
      await auth.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page safe-pad safe-top">
      <div className="login">
        <img className="login-mark" src="/logo-symbol.png" alt="AreYouOK" />
        <div className="brand big">
          <span className="brand-are">Are</span>
          <span className="brand-you">You</span>
          <span className="brand-ok">OK</span>
        </div>
        <div className="muted" style={{ marginTop: 8 }}>
          {t(prefs.lang, 'onboardingTitle')}
        </div>

        <InstallBanner compact />

        <div className="login-card glass neon-outline" style={{ marginTop: 18 }}>
          {step === 1 ? (
            <>
              <div className="login-title">{t(prefs.lang, 'onboardingProfile')}</div>
              <div className="grid-3" style={{ marginTop: 14 }}>
                <button
                  className={mode === 'teen' ? 'pick active' : 'pick'}
                  onClick={() => setMode('teen')}
                >
                  {t(prefs.lang, 'teen')}
                </button>
                <button
                  className={mode === 'adult' ? 'pick active' : 'pick'}
                  onClick={() => setMode('adult')}
                >
                  {t(prefs.lang, 'adult')}
                </button>
                <button
                  className={mode === 'senior' ? 'pick active' : 'pick'}
                  onClick={() => setMode('senior')}
                >
                  {t(prefs.lang, 'senior')}
                </button>
              </div>
              <button className="btn btn-grad" onClick={onNext} disabled={busy} style={{ marginTop: 16 }}>
                {t(prefs.lang, 'continue')} <ArrowRight size={18} />
              </button>
            </>
          ) : (
            <>
              <div className="login-title">{t(prefs.lang, 'onboardingRole')}</div>
              <div className="grid-2" style={{ marginTop: 14 }}>
                <button className={role === 'user' ? 'pick active' : 'pick'} onClick={() => setRole('user')}>
                  <User size={18} /> {t(prefs.lang, 'roleUser')}
                </button>
                <button className={role === 'circle' ? 'pick active' : 'pick'} onClick={() => setRole('circle')}>
                  <Users size={18} /> {t(prefs.lang, 'roleCircle')}
                </button>
              </div>
              <button className="btn btn-grad" onClick={onNext} disabled={busy} style={{ marginTop: 16 }}>
                {t(prefs.lang, 'done')} <ArrowRight size={18} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
