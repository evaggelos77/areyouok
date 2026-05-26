import React, { useState } from 'react';
import { Mail, KeyRound, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePrefs } from '../contexts/PrefsContext';
import InstallBanner from '../components/InstallBanner';
import { t } from '../lib/i18n';

export default function LoginPage() {
  const auth = useAuth();
  const { lang } = usePrefs();

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [devCode, setDevCode] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const onSend = async () => {
    setError(null);
    setBusy(true);
    try {
      const r = await auth.requestOtp(email);
      setDevCode(r.devCode);
      setStep('code');
    } catch (e: any) {
      setError(e?.error || 'ERROR');
    } finally {
      setBusy(false);
    }
  };

  const onVerify = async () => {
    setError(null);
    setBusy(true);
    try {
      await auth.verifyOtp(email, code);
    } catch (e: any) {
      setError(e?.error || 'ERROR');
    } finally {
      setBusy(false);
    }
  };


  const errorKeyByCode: Record<string, string> = {
    SMTP_NOT_CONFIGURED: 'otpEmailUnavailable',
    OTP_EMAIL_UNAVAILABLE: 'otpEmailUnavailable',
    OTP_TOO_MANY_REQUESTS: 'otpTooManyRequests',
    OTP_TOO_MANY_ATTEMPTS: 'otpTooManyAttempts',
    OTP_INVALID: 'otpInvalid',
    OTP_EXPIRED: 'otpExpired',
    INVALID_EMAIL: 'otpInvalidEmail',
    INVALID_INPUT: 'otpInvalid'
  };
  const errorText = error ? t(lang, errorKeyByCode[error] || 'errorsGeneric') : '';

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
          {t(lang, 'brandTagline')}
        </div>

        <InstallBanner compact />

        <div className="login-card glass neon-outline" style={{ marginTop: 22 }}>
          <div className="login-title">{t(lang, 'loginTitle')}</div>
          <div className="muted small">{t(lang, 'loginSubtitle')}</div>

          {step === 'email' ? (
            <div className="form" style={{ marginTop: 16 }}>
              <label className="label">{t(lang, 'emailLabel')}</label>
              <div className="input-wrap">
                <Mail size={18} />
                <input
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t(lang, 'emailPlaceholder')}
                  inputMode="email"
                  autoComplete="email"
                />
              </div>
              <button className="btn btn-grad" onClick={onSend} disabled={busy}>
                {t(lang, 'sendCode')} <ArrowRight size={18} />
              </button>
            </div>
          ) : (
            <div className="form" style={{ marginTop: 16 }}>
              <label className="label">{t(lang, 'codeLabel')}</label>
              <div className="input-wrap">
                <KeyRound size={18} />
                <input
                  className="input"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
              </div>
              <button className="btn btn-grad" onClick={onVerify} disabled={busy}>
                {t(lang, 'verifyCode')} <ArrowRight size={18} />
              </button>
              <button className="btn btn-secondary" onClick={() => setStep('email')} disabled={busy}>
                {t(lang, 'emailLabel')}
              </button>

              {devCode ? <div className="muted small">{t(lang, 'devCode', { code: devCode })}</div> : null}
            </div>
          )}

          {error ? <div className="error">{errorText}</div> : null}
        </div>
      </div>
    </div>
  );
}
