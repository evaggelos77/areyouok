import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, PhoneCall, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import TopBar from '../components/TopBar';
import { useAuth } from '../contexts/AuthContext';
import { usePrefs } from '../contexts/PrefsContext';
import { useToast } from '../contexts/ToastContext';
import { apiFetch } from '../lib/api';
import { t } from '../lib/i18n';

type Schedule = {
  id: number;
  user_id: number;
  days_of_week: string;
  time_hhmm: string;
  timezone: string;
  enabled: number;
};

function useQuery() {
  const loc = useLocation();
  return useMemo(() => new URLSearchParams(loc.search), [loc.search]);
}

const dayLabelsEl = ['Κυρ', 'Δευ', 'Τρι', 'Τετ', 'Πεμ', 'Παρ', 'Σαβ'];
const dayLabelsEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CheckinPage() {
  const auth = useAuth();
  const prefs = usePrefs();
  const toast = useToast();
  const nav = useNavigate();
  const q = useQuery();
  const cid = q.get('cid');

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [busy, setBusy] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [time, setTime] = useState('18:00');

  const tz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Athens';
    } catch {
      return 'Europe/Athens';
    }
  }, []);

  const load = async () => {
    const data = await apiFetch<{ schedules: Schedule[] }>('/api/checkins/schedules', { method: 'GET' });
    setSchedules(data.schedules);
  };

  useEffect(() => {
    load();
  }, []);

  const sendNow = async () => {
    setBusy(true);
    try {
      await apiFetch('/api/checkins/send-now', { method: 'POST', body: '{}' });
      toast.show('✅');
      auth.refresh().catch(() => undefined);
    } catch (e: any) {
      if (e?.error === 'MAX_PER_HOUR') {
        toast.show('🔒');
        auth.refresh().catch(() => undefined);
      } else {
        toast.show('⚠️');
      }
    } finally {
      setBusy(false);
    }
  };

  const respond = async (response: 'ok' | 'call_me' | 'need_help') => {
    if (!cid) return;
    setBusy(true);
    try {
      await apiFetch('/api/checkins/respond', {
        method: 'POST',
        body: JSON.stringify({ checkinId: Number(cid), response })
      });
      toast.show('✅');
      nav('/');
    } finally {
      setBusy(false);
    }
  };

  const toggleDay = (d: number) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  };

  const addSchedule = async () => {
    setBusy(true);
    try {
      const data = await apiFetch<{ schedule: Schedule }>('/api/checkins/schedules', {
        method: 'POST',
        body: JSON.stringify({ daysOfWeek: days, timeHHMM: time, timezone: tz })
      });
      setSchedules((s) => [data.schedule, ...s]);
      setShowAdd(false);
      toast.show('✨');
      auth.refresh().catch(() => undefined);
    } catch (e: any) {
      if (e?.error === 'CHECKIN_SCHEDULES_LOCKED' || e?.error === 'CHECKIN_SCHEDULE_LIMIT_REACHED') {
        toast.show('🔒');
        auth.refresh().catch(() => undefined);
        nav('/settings');
      } else {
        toast.show('⚠️');
      }
    } finally {
      setBusy(false);
    }
  };

  const removeSchedule = async (id: number) => {
    setBusy(true);
    try {
      await apiFetch(`/api/checkins/schedules/${id}`, { method: 'DELETE' });
      setSchedules((s) => s.filter((x) => x.id !== id));
      toast.show('🗑️');
    } finally {
      setBusy(false);
    }
  };

  const toggleEnabled = async (s: Schedule) => {
    setBusy(true);
    try {
      const data = await apiFetch<{ schedule: Schedule }>(`/api/checkins/schedules/${s.id}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled: s.enabled !== 1 })
      });
      setSchedules((prev) => prev.map((x) => (x.id === s.id ? data.schedule : x)));
    } finally {
      setBusy(false);
    }
  };

  const dayLabels = prefs.lang === 'el' ? dayLabelsEl : dayLabelsEn;
  const scheduleLimit = auth.entitlements?.limits.checkin_schedules_limit ?? 0;
  const schedulesLocked = scheduleLimit <= 0;

  return (
    <div className="page">
      <TopBar />
      <div className="content safe-pad">
        <div style={{ paddingTop: 8 }}>
          <div className="page-title">{t(prefs.lang, 'checkinTitle')}</div>

          {cid ? (
            <div className="glass neon-outline card" style={{ marginTop: 14 }}>
              <div className="muted">{t(prefs.lang, 'checkinTitle')}</div>
              <div className="respond-grid" style={{ marginTop: 12 }}>
                <button className="btn btn-ok" onClick={() => respond('ok')} disabled={busy}>
                  <CheckCircle2 size={18} /> {t(prefs.lang, 'iAmOk')}
                </button>
                <button className="btn btn-primary" onClick={() => respond('call_me')} disabled={busy}>
                  <PhoneCall size={18} /> {t(prefs.lang, 'callMe')}
                </button>
                <button className="btn btn-sos" onClick={() => respond('need_help')} disabled={busy}>
                  <AlertTriangle size={18} /> {t(prefs.lang, 'notOk')}
                </button>
              </div>
            </div>
          ) : (
            <div className="glass neon-outline card" style={{ marginTop: 14 }}>
              <div className="muted">{t(prefs.lang, 'checkinManual')}</div>
              <button className="btn btn-grad" onClick={sendNow} disabled={busy} style={{ marginTop: 12 }}>
                {t(prefs.lang, 'checkinSendNow')}
              </button>
            </div>
          )}

          <div className="glass neon-outline card" style={{ marginTop: 14 }}>
            <div className="row-between">
              <div>
                <div className="muted">{t(prefs.lang, 'checkinScheduled')}</div>
                {schedulesLocked ? (
                  <div className="muted small" style={{ marginTop: 6 }}>
                    {t(prefs.lang, 'checkinSchedulesLocked')}
                  </div>
                ) : null}
              </div>
              <button className="btn btn-secondary" onClick={() => (schedulesLocked ? nav('/settings') : setShowAdd((v) => !v))}>
                <Plus size={18} /> {t(prefs.lang, 'addSchedule')}
              </button>
            </div>

            {schedulesLocked ? (
              <div className="upgrade-box" style={{ marginTop: 12 }}>
                <div className="muted small">{t(prefs.lang, 'checkinSchedulesLocked')}</div>
                <div className="btn-row" style={{ marginTop: 10 }}>
                  <button className="btn btn-grad" onClick={() => nav('/settings')}>
                    {t(prefs.lang, 'upgrade')}
                  </button>
                </div>
              </div>
            ) : showAdd ? (
              <div className="add-schedule" style={{ marginTop: 14 }}>
                <div className="muted small">{t(prefs.lang, 'days')}</div>
                <div className="days">
                  {dayLabels.map((lbl, idx) => (
                    <button
                      key={idx}
                      className={days.includes(idx) ? 'day active' : 'day'}
                      onClick={() => toggleDay(idx)}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>

                <div className="row-between" style={{ marginTop: 12 }}>
                  <div>
                    <div className="muted small">{t(prefs.lang, 'time')}</div>
                    <input className="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                  </div>
                  <button className="btn btn-grad" onClick={addSchedule} disabled={busy}>
                    {t(prefs.lang, 'save')}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="schedule-list" style={{ marginTop: 12 }}>
              {schedules.length === 0 ? (
                <div className="muted small">—</div>
              ) : (
                schedules.map((s) => (
                  <div key={s.id} className="schedule-item">
                    <button className={s.enabled === 1 ? 'toggle on' : 'toggle'} onClick={() => toggleEnabled(s)} />
                    <div className="schedule-meta">
                      <div className="schedule-time">{s.time_hhmm}</div>
                      <div className="muted small">
                        {s.days_of_week
                          .split(',')
                          .filter(Boolean)
                          .map((d) => dayLabels[Number(d)])
                          .join(' · ')}
                      </div>
                    </div>
                    <button
                      className="icon-btn"
                      onClick={() => removeSchedule(s.id)}
                      aria-label={t(prefs.lang, 'delete')}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
