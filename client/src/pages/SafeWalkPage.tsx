import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Play, StopCircle, Timer } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePrefs } from '../contexts/PrefsContext';
import { useToast } from '../contexts/ToastContext';
import { apiFetch, getBatteryLevel, getCurrentPosition } from '../lib/api';
import { t } from '../lib/i18n';

type Session = {
  id: number;
  user_id: number;
  duration_minutes: number;
  interval_minutes: number;
  started_at: number;
  ends_at: number;
  next_checkin_at: number;
  status: string;
};

function msToMinSec(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function SafeWalkPage() {
  const auth = useAuth();
  const prefs = usePrefs();
  const toast = useToast();

  const [session, setSession] = useState<Session | null>(null);
  const [duration, setDuration] = useState<10 | 15 | 20 | 30>(10);
  const [interval, setIntervalMin] = useState<5 | 10>(10);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  const load = async () => {
    const data = await apiFetch<{ session: Session | null }>('/api/safewalk/active', { method: 'GET' });
    setSession(data.session);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const start = async () => {
    setBusy(true);
    try {
      const battery = await getBatteryLevel();
      const pos = await getCurrentPosition();
      const data = await apiFetch<{ session: Session; usedToday?: number; limit?: number }>('/api/safewalk/start', {
        method: 'POST',
        body: JSON.stringify({ durationMinutes: duration, intervalMinutes: interval, battery, ...(pos || {}) })
      });
      setSession(data.session);
      toast.show('🟦');
      auth.refresh().catch(() => undefined);
    } catch (e: any) {
      if (e?.error === 'SAFEWALK_LIMIT_REACHED') {
        toast.show('🔒');
        auth.refresh().catch(() => undefined);
      } else {
        toast.show('⚠️');
      }
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    try {
      await apiFetch('/api/safewalk/stop', { method: 'POST', body: '{}' });
      setSession(null);
      toast.show('⏹️');
      auth.refresh().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };

  const quickOk = async () => {
    const battery = await getBatteryLevel();
    await apiFetch('/api/signals/ok', { method: 'POST', body: JSON.stringify({ battery }) });
    toast.show('✅');
  };

  const usedToday = auth.entitlements?.usage.safewalk_sessions_last_24h ?? 0;
  const safewalkLimit = auth.entitlements?.limits.safewalk_limit ?? 0;
  const safewalkLocked = !session && safewalkLimit > 0 && usedToday >= safewalkLimit;

  const progress = useMemo(() => {
    if (!session) return 0;
    const total = session.ends_at - session.started_at;
    const left = session.ends_at - now;
    return total > 0 ? Math.min(1, Math.max(0, 1 - left / total)) : 0;
  }, [session, now]);

  const leftStr = useMemo(() => {
    if (!session) return '--:--';
    return msToMinSec(session.ends_at - now);
  }, [session, now]);

  return (
    <div style={{ paddingTop: 8 }}>
      <div className="page-title">{t(prefs.lang, 'safewalkTitle')}</div>

      {session ? (
        <div className="glass neon-outline card" style={{ marginTop: 14 }}>
          <div className="row-between">
            <div>
              <div className="muted">{t(prefs.lang, 'active')}</div>
              <div className="small muted">
                {t(prefs.lang, 'interval')} {session.interval_minutes} {t(prefs.lang, 'minutes')}
              </div>
            </div>
            <button className="btn btn-secondary" onClick={stop} disabled={busy}>
              <StopCircle size={18} /> {t(prefs.lang, 'stop')}
            </button>
          </div>

          <div className="safewalk-ring" style={{ marginTop: 18 }}>
            <div className="ring" style={{ ['--p' as any]: progress }}>
              <div className="ring-inner glass">
                <Timer size={18} />
                <div className="ring-time">{leftStr}</div>
                <div className="muted small">{t(prefs.lang, 'duration')}</div>
              </div>
            </div>
          </div>

          <div className="btn-row" style={{ marginTop: 16 }}>
            <button className="btn btn-ok" onClick={quickOk} disabled={busy}>
              <CheckCircle2 size={18} /> {t(prefs.lang, 'iAmOk')}
            </button>
          </div>
        </div>
      ) : (
        <div className="glass neon-outline card" style={{ marginTop: 14 }}>
          <div className="muted">{t(prefs.lang, 'startSafewalk')}</div>
          {safewalkLimit > 0 ? (
            <div className="muted small" style={{ marginTop: 8 }}>
              {t(prefs.lang, 'safewalkUsageHint', { used: usedToday, limit: safewalkLimit })}
            </div>
          ) : null}

          {safewalkLocked ? (
            <div className="upgrade-box" style={{ marginTop: 12 }}>
              <div className="muted small">{t(prefs.lang, 'safewalkLimitReached')}</div>
              <div className="btn-row" style={{ marginTop: 10 }}>
                <button className="btn btn-grad" onClick={() => (window.location.href = '/settings')}>
                  {t(prefs.lang, 'upgrade')}
                </button>
              </div>
            </div>
          ) : null}

          <div className="muted small" style={{ marginTop: 10 }}>
            {t(prefs.lang, 'duration')}
          </div>
          <div className="days">
            {[10, 15, 20, 30].map((d) => (
              <button key={d} className={duration === d ? 'day active' : 'day'} onClick={() => setDuration(d as any)}>
                {d}′
              </button>
            ))}
          </div>

          <div className="muted small" style={{ marginTop: 10 }}>
            {t(prefs.lang, 'interval')}
          </div>
          <div className="days">
            {[5, 10].map((d) => (
              <button key={d} className={interval === d ? 'day active' : 'day'} onClick={() => setIntervalMin(d as any)}>
                {d}′
              </button>
            ))}
          </div>

          <button className="btn btn-grad" onClick={start} disabled={busy || safewalkLocked} style={{ marginTop: 14 }}>
            <Play size={18} /> {t(prefs.lang, 'startSafewalk')}
          </button>
        </div>
      )}
    </div>
  );
}
