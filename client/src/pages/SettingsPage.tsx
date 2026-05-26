import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Crown, LogOut, Moon, Sparkles, ShieldAlert, UserRound, Phone, Mic, Lock, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePrefs, Theme } from '../contexts/PrefsContext';
import { useToast } from '../contexts/ToastContext';
import { useVoiceAssist } from '../contexts/VoiceAssistContext';
import { apiFetch } from '../lib/api';
import { ensurePushSubscribed } from '../lib/push';
import { t } from '../lib/i18n';

function formatRemaining(ms: number | null | undefined, lang: 'el' | 'en') {
  if (!ms || ms <= 0) return lang === 'el' ? '0λ' : '0m';
  const totalMinutes = Math.max(1, Math.ceil(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (lang === 'el') {
    if (hours > 0 && minutes > 0) return `${hours}ω ${minutes}λ`;
    if (hours > 0) return `${hours}ω`;
    return `${minutes}λ`;
  }

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

export default function SettingsPage() {
  const auth = useAuth();
  const prefs = usePrefs();
  const toast = useToast();
  const voice = useVoiceAssist();
  const location = useLocation();

  const [name, setName] = useState(auth.user?.name || '');
  const [phone, setPhone] = useState(auth.user?.phone || '');
  const [busy, setBusy] = useState(false);
  const [voiceKeywordsText, setVoiceKeywordsText] = useState(() => (voice.keywords || []).join(', '));

  useEffect(() => {
    setVoiceKeywordsText((voice.keywords || []).join(', '));
  }, [voice.keywords]);

  useEffect(() => {
    setName(auth.user?.name || '');
    setPhone(auth.user?.phone || '');
  }, [auth.user?.name, auth.user?.phone]);

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const checkout = q.get('checkout');
    if (checkout === 'success') {
      auth.refresh().catch(() => undefined);
      toast.show('✨');
    }
  }, [location.search]);

  const entitlements = auth.entitlements;
  const premiumActive = Boolean(entitlements?.is_premium);
  const planSource = entitlements?.plan_source || 'free';
  const planInterval = entitlements?.plan_interval || 'free';
  const trialActive = planSource === 'trial' && !entitlements?.trial_expired;
  const stripeMonthlyActive = planSource === 'stripe' && planInterval === 'month';
  const stripeYearlyActive = planSource === 'stripe' && planInterval === 'year';
  const yearlyUnlocked = Boolean(entitlements?.voice_keywords_enabled);
  const canManageStripe = planSource === 'stripe';
  const canStartTrial = Boolean(auth.user && !canManageStripe && !entitlements?.trial_used);
  const trialExpired = Boolean(entitlements?.trial_expired);
  const premiumUntil = entitlements?.premium_until
    ? new Date(entitlements.premium_until)
    : auth.user?.premium_current_period_end
      ? new Date(auth.user.premium_current_period_end)
      : null;

  const trialRemaining = useMemo(
    () => formatRemaining(entitlements?.trial_remaining_ms, prefs.lang),
    [entitlements?.trial_remaining_ms, prefs.lang]
  );

  useEffect(() => {
    if (!yearlyUnlocked && voice.enabled) {
      voice.setEnabled(false);
    }
  }, [yearlyUnlocked, voice.enabled]);

  const saveProfile = async () => {
    setBusy(true);
    try {
      await apiFetch('/api/profile', { method: 'PUT', body: JSON.stringify({ name, phone }) });
      await auth.refresh();
      toast.show('✅');
    } finally {
      setBusy(false);
    }
  };

  const setTheme = async (theme: Theme) => {
    prefs.setTheme(theme);
    try {
      await apiFetch('/api/profile', { method: 'PUT', body: JSON.stringify({ theme }) });
      await auth.refresh();
    } catch {
      // ignore
    }
  };

  const setMaxPerHour = async (v: number) => {
    setBusy(true);
    try {
      await apiFetch('/api/profile', { method: 'PUT', body: JSON.stringify({ maxCheckinsPerHour: v }) });
      await auth.refresh();
      toast.show('✅');
    } finally {
      setBusy(false);
    }
  };

  const setSnooze = async (minutes: number | null) => {
    const until = minutes ? Date.now() + minutes * 60 * 1000 : null;
    setBusy(true);
    try {
      await apiFetch('/api/profile', { method: 'PUT', body: JSON.stringify({ snoozeUntil: until }) });
      await auth.refresh();
      toast.show('⏳');
    } finally {
      setBusy(false);
    }
  };

  const upgrade = async (plan: 'monthly' | 'yearly') => {
    setBusy(true);
    try {
      const data = await apiFetch<{ url: string }>('/api/stripe/create-checkout-session', {
        method: 'POST',
        body: JSON.stringify({ plan })
      });
      window.location.href = data.url;
    } catch {
      toast.show('⚠️');
    } finally {
      setBusy(false);
    }
  };

  const startTrial = async () => {
    setBusy(true);
    try {
      await auth.startTrial();
      toast.show('✨');
    } catch (e: any) {
      if (e?.error === 'TRIAL_ALREADY_USED') {
        toast.show('🔒');
      } else if (e?.error === 'SUBSCRIPTION_ACTIVE') {
        toast.show('👑');
      } else {
        toast.show('⚠️');
      }
    } finally {
      setBusy(false);
    }
  };

  const manage = async () => {
    setBusy(true);
    try {
      const data = await apiFetch<{ url: string }>('/api/stripe/create-portal-session', { method: 'POST', body: '{}' });
      window.location.href = data.url;
    } catch {
      toast.show('⚠️');
    } finally {
      setBusy(false);
    }
  };

  const onLogout = async () => {
    await auth.logout();
  };

  const enableNotifications = async () => {
    setBusy(true);
    try {
      const r = await ensurePushSubscribed();
      toast.show(r.ok ? '🔔' : '⚠️');
    } catch {
      toast.show('⚠️');
    } finally {
      setBusy(false);
    }
  };

  const checkinCap = auth.entitlements?.limits.checks_per_hour ?? 6;
  const maxPerHour = Math.min(auth.user?.max_checkins_per_hour ?? checkinCap, checkinCap);
  const snoozeUntil = auth.user?.snooze_until ?? null;
  const snoozeLeftMin = useMemo(() => {
    if (!snoozeUntil) return 0;
    return Math.max(0, Math.ceil((snoozeUntil - Date.now()) / 60000));
  }, [snoozeUntil]);

  const currentPlanLabel = trialActive
    ? t(prefs.lang, 'trialPlan')
    : stripeYearlyActive
      ? t(prefs.lang, 'yearlyPlan')
      : stripeMonthlyActive
        ? t(prefs.lang, 'monthlyPlan')
        : t(prefs.lang, 'freePlan');

  const currentPlanMeta = trialActive
    ? `${t(prefs.lang, 'trialActiveShort')} · ${t(prefs.lang, 'trialEndsIn', { time: trialRemaining })}`
    : premiumActive
      ? `${t(prefs.lang, 'currentPlan')}: ${currentPlanLabel}${
          premiumUntil
            ? prefs.lang === 'el'
              ? ` · έως ${premiumUntil.toLocaleDateString('el-GR')}`
              : ` · until ${premiumUntil.toLocaleDateString('en-US')}`
            : ''
        }`
      : trialExpired
        ? t(prefs.lang, 'trialExpiredHint')
        : t(prefs.lang, 'premiumBasicHint');

  const monthlyPitch = [t(prefs.lang, 'monthlyPitch1'), t(prefs.lang, 'monthlyPitch2'), t(prefs.lang, 'monthlyPitch3')];
  const yearlyPitch = [t(prefs.lang, 'yearlyPitch1'), t(prefs.lang, 'yearlyPitch2'), t(prefs.lang, 'yearlyPitch3')];

  return (
    <div style={{ paddingTop: 8 }}>
      <div className="settings-header">
        <img className="brand-mark" src="/logo-symbol.png" alt="AreYouOK" />
        <div className="page-title">{t(prefs.lang, 'settingsTitle')}</div>
      </div>

      <div className="glass neon-outline card" style={{ marginTop: 14 }}>
        <div className="muted">{t(prefs.lang, 'appearance')}</div>
        <div className="grid-3" style={{ marginTop: 12 }}>
          <button className={prefs.theme === 'neon' ? 'pick active' : 'pick'} onClick={() => setTheme('neon')}>
            <Sparkles size={18} /> {t(prefs.lang, 'neonDark')}
          </button>
          <button className={prefs.theme === 'clean' ? 'pick active' : 'pick'} onClick={() => setTheme('clean')}>
            <Moon size={18} /> {t(prefs.lang, 'cleanDark')}
          </button>
          <button
            className={prefs.theme === 'high_contrast' ? 'pick active' : 'pick'}
            onClick={() => setTheme('high_contrast')}
          >
            <ShieldAlert size={18} /> {t(prefs.lang, 'highContrast')}
          </button>
        </div>
      </div>

      <div className="glass neon-outline card" style={{ marginTop: 14 }}>
        <div className="muted">{t(prefs.lang, 'privacy')}</div>
        <div className="muted small" style={{ marginTop: 8 }}>
          {t(prefs.lang, 'privacyHint')}
        </div>
      </div>

      <div className="glass neon-outline card" style={{ marginTop: 14 }}>
        <div className="muted">{t(prefs.lang, 'notifications')}</div>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn btn-primary" onClick={enableNotifications} disabled={busy}>
            {t(prefs.lang, 'enableNotifications')}
          </button>
        </div>
      </div>

      <div className="glass neon-outline card" style={{ marginTop: 14 }}>
        <div className="row-between">
          <div>
            <div className="muted">{t(prefs.lang, 'premium')}</div>
            <div className="muted small" style={{ marginTop: 6 }}>
              {currentPlanMeta}
            </div>
          </div>
          <div className="pill">
            <Crown size={16} /> {currentPlanLabel}
          </div>
        </div>

        {canStartTrial ? (
          <div className="trial-start-box" style={{ marginTop: 12 }}>
            <div className="muted small">{t(prefs.lang, 'trialStartHint')}</div>
            <div className="btn-row" style={{ marginTop: 10 }}>
              <button className="btn btn-grad" onClick={startTrial} disabled={busy}>
                <ShieldCheck size={18} /> {t(prefs.lang, 'trialStartCta')}
              </button>
            </div>
          </div>
        ) : null}

        {trialActive ? (
          <div className="trial-active-box" style={{ marginTop: 12 }}>
            <div className="pill small">
              <ShieldCheck size={14} /> {t(prefs.lang, 'trialActiveShort')}
            </div>
            <div className="muted small" style={{ marginTop: 8 }}>
              {t(prefs.lang, 'trialEndsIn', { time: trialRemaining })}
            </div>
          </div>
        ) : null}

        {trialExpired ? (
          <div className="upgrade-box" style={{ marginTop: 12 }}>
            <div className="muted small">{t(prefs.lang, 'trialExpiredBody')}</div>
          </div>
        ) : null}

        <div className="muted small plan-intro" style={{ marginTop: 12 }}>
          {t(prefs.lang, 'plansIntro')}
        </div>

        <div className="plans-grid" style={{ marginTop: 12 }}>
          <button
            className={stripeMonthlyActive ? 'plan-option active' : 'plan-option'}
            onClick={() => upgrade('monthly')}
            disabled={busy || stripeMonthlyActive}
          >
            <div className="plan-head">
              <div className="plan-name">{t(prefs.lang, 'monthlyPlan')}</div>
              <div className="plan-badge subtle">{t(prefs.lang, 'cancelAnytime')}</div>
            </div>
            <div className="plan-price">
              €3.99 <span className="plan-period">/ {prefs.lang === 'el' ? 'μήνα' : 'month'}</span>
            </div>
            <div className="plan-copy">
              {monthlyPitch.map((line) => (
                <div key={line} className="plan-copy-line">
                  {line}
                </div>
              ))}
            </div>
          </button>

          <button
            className={stripeYearlyActive ? 'plan-option plan-yearly active' : 'plan-option plan-yearly'}
            onClick={() => upgrade('yearly')}
            disabled={busy || stripeYearlyActive}
          >
            <div className="plan-head">
              <div className="plan-name">{t(prefs.lang, 'yearlyPlan')}</div>
              <div className="plan-badge accent">{t(prefs.lang, 'yearlyDiscountBadge')}</div>
            </div>
            <div className="plan-price">
              €29 <span className="plan-period">/ {prefs.lang === 'el' ? 'έτος' : 'year'}</span>
            </div>
            <div className="plan-copy">
              {yearlyPitch.map((line) => (
                <div key={line} className="plan-copy-line">
                  {line}
                </div>
              ))}
            </div>
          </button>
        </div>

        {canManageStripe ? (
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn btn-secondary" onClick={manage} disabled={busy}>
              {t(prefs.lang, 'manageSub')}
            </button>
          </div>
        ) : null}
      </div>

      <div className="glass neon-outline card" style={{ marginTop: 14 }}>
        <div className="row-between">
          <div className="muted">{t(prefs.lang, 'voiceAssistTitle')}</div>
          {yearlyUnlocked ? (
            <button
              className={voice.enabled ? 'toggle on' : 'toggle'}
              onClick={() => {
                if (!voice.supported) {
                  toast.show('⚠️');
                  return;
                }
                voice.setEnabled(!voice.enabled);
              }}
            />
          ) : (
            <div className="pill">
              <Lock size={14} /> {t(prefs.lang, 'yearlyOnlyBadge')}
            </div>
          )}
        </div>

        <div className="muted small" style={{ marginTop: 8 }}>
          {t(prefs.lang, 'voiceAssistHint')}
        </div>

        {!yearlyUnlocked ? (
          <div className="upgrade-box" style={{ marginTop: 12 }}>
            <div className="muted small">
              {stripeMonthlyActive ? t(prefs.lang, 'voiceAssistMonthlyLocked') : t(prefs.lang, 'voiceAssistYearlyOnly')}
            </div>
            <div className="btn-row" style={{ marginTop: 10 }}>
              <button className="btn btn-grad" onClick={() => upgrade('yearly')} disabled={busy}>
                <Crown size={18} /> {t(prefs.lang, 'upgradeYearly')}
              </button>
            </div>
          </div>
        ) : (
          <>
            {voice.supported ? (
              <div className="pill small" style={{ marginTop: 10 }}>
                <span className="muted">{t(prefs.lang, 'voiceAssistStatus')}:</span>
                <span style={{ fontWeight: 650 }}>
                  {!voice.enabled
                    ? t(prefs.lang, 'voiceAssistStatusOff')
                    : (voice.keywords || []).length > 0
                      ? t(prefs.lang, 'voiceAssistStatusListening')
                      : t(prefs.lang, 'voiceAssistStatusOn')}
                </span>
              </div>
            ) : null}

            {!voice.supported ? (
              <div className="muted small" style={{ marginTop: 8 }}>
                {t(prefs.lang, 'voiceAssistUnsupported')}
              </div>
            ) : null}

            <div style={{ marginTop: 12 }}>
              <label className="label">{t(prefs.lang, 'voiceKeywordsLabel')}</label>
              <div className="input-wrap">
                <Mic size={18} />
                <input
                  className="input"
                  value={voiceKeywordsText}
                  onChange={(e) => {
                    const v = e.target.value;
                    setVoiceKeywordsText(v);
                    const arr = v
                      .split(/[\n,]+/g)
                      .map((x) => x.trim())
                      .filter((x) => x.length > 0);
                    voice.setKeywords(arr);
                  }}
                  placeholder={t(prefs.lang, 'voiceKeywordsPlaceholder')}
                  disabled={!voice.supported}
                />
              </div>
              <div className="muted small" style={{ marginTop: 6 }}>
                {t(prefs.lang, 'voiceKeywordsHint')}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="glass neon-outline card" style={{ marginTop: 14 }}>
        <div className="muted">{t(prefs.lang, 'antiSpam')}</div>
        <div className="row-between" style={{ marginTop: 12 }}>
          <div className="muted">{t(prefs.lang, 'maxCheckinsPerHour')}</div>
          <div className="pill">{maxPerHour}</div>
        </div>
        <input
          type="range"
          min={1}
          max={checkinCap}
          value={maxPerHour}
          onChange={(e) => setMaxPerHour(Number(e.target.value))}
          disabled={busy}
          style={{ width: '100%', marginTop: 10 }}
        />
        <div className="muted small" style={{ marginTop: 6 }}>
          {t(prefs.lang, 'limitHint', { count: checkinCap })}
        </div>

        <div className="row-between" style={{ marginTop: 14 }}>
          <div>
            <div className="muted">{t(prefs.lang, 'snooze')}</div>
            {snoozeUntil && snoozeLeftMin > 0 ? (
              <div className="muted small">
                {snoozeLeftMin}
                {prefs.lang === 'el' ? 'λ' : 'm'}
              </div>
            ) : null}
          </div>
          <div className="days">
            <button className={!snoozeUntil ? 'day active' : 'day'} onClick={() => setSnooze(null)} disabled={busy}>
              {t(prefs.lang, 'snoozeOff')}
            </button>
            <button className={snoozeLeftMin > 0 ? 'day active' : 'day'} onClick={() => setSnooze(30)} disabled={busy}>
              {prefs.lang === 'el' ? '30λ' : '30m'}
            </button>
            <button className={snoozeLeftMin > 30 ? 'day active' : 'day'} onClick={() => setSnooze(60)} disabled={busy}>
              {prefs.lang === 'el' ? '1ω' : '1h'}
            </button>
          </div>
        </div>
      </div>

      <div className="glass neon-outline card" style={{ marginTop: 14 }}>
        <div className="muted">{t(prefs.lang, 'profile')}</div>
        <div className="form" style={{ marginTop: 12 }}>
          <label className="label">{t(prefs.lang, 'nameLabel')}</label>
          <div className="input-wrap">
            <UserRound size={18} />
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex" />
          </div>

          <label className="label">{t(prefs.lang, 'phoneLabel')}</label>
          <div className="input-wrap">
            <Phone size={18} />
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+30…" />
          </div>

          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn btn-primary" onClick={saveProfile} disabled={busy}>
              {t(prefs.lang, 'save')}
            </button>
            <button className="btn btn-secondary" onClick={onLogout}>
              <LogOut size={18} /> {t(prefs.lang, 'logout')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
