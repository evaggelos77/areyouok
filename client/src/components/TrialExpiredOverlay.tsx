import React, { useEffect, useMemo, useState } from 'react';
import { Crown, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePrefs } from '../contexts/PrefsContext';
import { useToast } from '../contexts/ToastContext';
import { apiFetch } from '../lib/api';
import { t } from '../lib/i18n';

export default function TrialExpiredOverlay() {
  const auth = useAuth();
  const prefs = usePrefs();
  const toast = useToast();
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  const entitlements = auth.entitlements;
  const dismissedTrialAt = typeof window !== 'undefined' ? localStorage.getItem('ayok_trial_recap_dismissed_at') : null;
  const recapKey = entitlements?.trial_expires_at ? String(entitlements.trial_expires_at) : null;
  const visible = Boolean(entitlements?.trial_expired && !dismissed && recapKey && dismissedTrialAt !== recapKey);

  useEffect(() => {
    if (!entitlements?.trial_expired) {
      setDismissed(false);
    }
  }, [entitlements?.trial_expired]);

  const recap = useMemo(() => {
    const usage = entitlements?.usage;
    return {
      checks: usage?.checks_sent_last_24h ?? 0,
      safewalks: usage?.safewalk_sessions_last_24h ?? 0,
      notified: usage?.trusted_people_notified_last_24h ?? 0
    };
  }, [entitlements?.usage]);

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

  if (!visible) return null;

  return (
    <div className="trial-recap-backdrop" role="dialog" aria-modal="true">
      <div className="trial-recap-card glass neon-outline">
        <div className="trial-recap-badge">
          <ShieldCheck size={18} /> {t(prefs.lang, 'trialExpiredBadge')}
        </div>

        <div className="trial-recap-title">{t(prefs.lang, 'trialExpiredTitle')}</div>
        <div className="muted" style={{ marginTop: 8 }}>
          {t(prefs.lang, 'trialExpiredBody')}
        </div>

        <div className="trial-recap-stats" style={{ marginTop: 16 }}>
          <div className="trial-stat">
            <div className="trial-stat-value">{recap.checks}</div>
            <div className="trial-stat-label">{t(prefs.lang, 'trialRecapChecks')}</div>
          </div>
          <div className="trial-stat">
            <div className="trial-stat-value">{recap.safewalks}</div>
            <div className="trial-stat-label">{t(prefs.lang, 'trialRecapSafeWalk')}</div>
          </div>
          <div className="trial-stat">
            <div className="trial-stat-value">{recap.notified}</div>
            <div className="trial-stat-label">{t(prefs.lang, 'trialRecapTrusted')}</div>
          </div>
        </div>

        <div className="trial-recap-actions" style={{ marginTop: 18 }}>
          <button className="btn btn-grad" onClick={() => upgrade('yearly')} disabled={busy}>
            <Crown size={18} /> {t(prefs.lang, 'trialCtaYearly')}
          </button>
          <button className="btn btn-secondary" onClick={() => upgrade('monthly')} disabled={busy}>
            {t(prefs.lang, 'trialCtaMonthly')}
          </button>
          <button
            className="btn btn-secondary ghostish"
            onClick={() => {
              if (recapKey) localStorage.setItem('ayok_trial_recap_dismissed_at', recapKey);
              setDismissed(true);
            }}
            disabled={busy}
          >
            {t(prefs.lang, 'continueFree')}
          </button>
        </div>
      </div>
    </div>
  );
}
