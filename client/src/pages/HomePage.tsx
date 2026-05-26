import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhoneCall, MessageCircle, Mic, ShieldAlert } from 'lucide-react';
import Orb from '../components/Orb';
import ActionSheet, { QuickAction } from '../components/ActionSheet';
import { usePrefs } from '../contexts/PrefsContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { apiFetch, getBatteryLevel, getCurrentPosition } from '../lib/api';
import { t } from '../lib/i18n';

function formatTime(ts: number | null, lang: 'el' | 'en') {
  if (!ts) return '--:--';
  try {
    return new Intl.DateTimeFormat(lang === 'el' ? 'el-GR' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(ts));
  } catch {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
}

export default function HomePage() {
  const prefs = usePrefs();
  const auth = useAuth();
  const toast = useToast();
  const nav = useNavigate();

  const [voiceListening, setVoiceListening] = useState(false);

  const [sheet, setSheet] = useState(false);
  const [sharingUntil, setSharingUntil] = useState<number | null>(() => {
    const v = localStorage.getItem('ayok_share_until');
    return v ? Number(v) : null;
  });

  const lastSignalAt = auth.user?.last_signal_at ?? null;
  const lastTimeStr = useMemo(() => formatTime(lastSignalAt, prefs.lang), [lastSignalAt, prefs.lang]);

  const sendOk = async () => {
    try {
      const battery = await getBatteryLevel();
      await apiFetch('/api/signals/ok', { method: 'POST', body: JSON.stringify({ battery }) });
      await auth.refresh();
      toast.show('✅ ' + t(prefs.lang, 'toastIamOk'));
    } catch {
      toast.show('⚠️ ' + t(prefs.lang, 'toastFailed'));
    }
  };

  const sendCallMe = async () => {
    try {
      const battery = await getBatteryLevel();
      await apiFetch('/api/signals/call-me', { method: 'POST', body: JSON.stringify({ battery }) });
      toast.show('✅ ' + t(prefs.lang, 'toastCallMe'));
    } catch {
      toast.show('⚠️ ' + t(prefs.lang, 'toastFailed'));
    }
  };

  const sendNeedHelp = async () => {
    try {
      const battery = await getBatteryLevel();
      // Optional location (if available)
      const pos = await getCurrentPosition();
      await apiFetch('/api/signals/need-help', {
        method: 'POST',
        body: JSON.stringify({ battery, ...(pos || {}) })
      });
      toast.show('🆘 ' + t(prefs.lang, 'toastNeedHelp'));
    } catch {
      toast.show('⚠️ ' + t(prefs.lang, 'toastFailed'));
    }
  };

  const shareLocation10 = async () => {
    const until = Date.now() + 10 * 60 * 1000;
    localStorage.setItem('ayok_share_until', String(until));
    setSharingUntil(until);

    try {
      const battery = await getBatteryLevel();
      const pos = await getCurrentPosition();
      if (!pos) {
        toast.show('⚠️ ' + t(prefs.lang, 'toastFailed'));
        return;
      }
      await apiFetch('/api/signals/location', { method: 'POST', body: JSON.stringify({ battery, ...pos }) });
      toast.show('📍 ' + t(prefs.lang, 'toastLocationShare'));
    } catch {
      toast.show('⚠️ ' + t(prefs.lang, 'toastFailed'));
    }
  };

  // While share is active and app open, refresh location every 60s
  useEffect(() => {
    if (!sharingUntil) return;
    const tick = () => {
      if (Date.now() > sharingUntil) {
        setSharingUntil(null);
        localStorage.removeItem('ayok_share_until');
      }
    };

    const interval = window.setInterval(async () => {
      tick();
      if (sharingUntil && Date.now() < sharingUntil) {
        try {
          const battery = await getBatteryLevel();
          const pos = await getCurrentPosition();
          if (pos) {
            await apiFetch('/api/signals/location', { method: 'POST', body: JSON.stringify({ battery, ...pos }) });
          }
        } catch {
          // ignore
        }
      }
    }, 60_000);

    const tmr = window.setInterval(tick, 2_000);

    return () => {
      window.clearInterval(interval);
      window.clearInterval(tmr);
    };
  }, [sharingUntil]);

  const onQuickAction = async (a: QuickAction) => {
    setSheet(false);
    if (a === 'ok') return sendOk();
    if (a === 'call_me') return sendCallMe();
    if (a === 'need_help') return sendNeedHelp();
    if (a === 'share_location_10') return shareLocation10();
  };

  const onPickMeUp = async () => {
    try {
      const battery = await getBatteryLevel();
      const pos = await getCurrentPosition();
      await apiFetch('/api/signals/pick-me-up', { method: 'POST', body: JSON.stringify({ battery, ...(pos || {}) }) });
      toast.show('🚗 ' + t(prefs.lang, 'toastPickMeUp'));
    } catch {
      toast.show('⚠️ ' + t(prefs.lang, 'toastFailed'));
    }
  };

  const sendBullyingAlert = async (battery: number | null) => {
    const data = await apiFetch<{ ok: true; signal: any }>('/api/signals/bullying-alert', {
      method: 'POST',
      body: JSON.stringify({ battery })
    });
    return (data as any)?.signal?.id ?? null;
  };

  const recordBullyingAudio = async (eventIdPromise: Promise<number | null>) => {
    // Evidence: record a short audio clip and upload as bullying_audio_clip (doesn't touch the existing audio flow).
    if (!('mediaDevices' in navigator) || !navigator.mediaDevices?.getUserMedia) return;
    // @ts-ignore
    if (typeof window.MediaRecorder === 'undefined') return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const options: MediaRecorderOptions = {};
      // Prefer Opus in WebM when available.
      // @ts-ignore
      const MR: typeof MediaRecorder = window.MediaRecorder;
      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
      for (const c of candidates) {
        try {
          if (MR.isTypeSupported && MR.isTypeSupported(c)) {
            options.mimeType = c;
            break;
          }
        } catch {
          // ignore
        }
      }

      const rec = new MediaRecorder(stream, options);
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };

      const startedAt = Date.now();
      const stopped = new Promise<void>((resolve) => {
        rec.onstop = () => resolve();
      });

      rec.start();

      // Auto-stop in ~60 seconds.
      window.setTimeout(() => {
        try {
          if (rec.state !== 'inactive') rec.stop();
        } catch {
          // ignore
        }
      }, 60_000);

      await stopped;

      try {
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }

      const durationMs = Math.max(0, Date.now() - startedAt);
      const mime = rec.mimeType || options.mimeType || 'audio/webm';
      const blob = new Blob(chunks, { type: mime });
      if (!blob || blob.size < 256) return;

      const battery = await getBatteryLevel();
      const eventId = await eventIdPromise;

      const res = await fetch('/api/signals/bullying-audio-clip', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': blob.type || 'application/octet-stream',
          'X-Audio-Duration-Ms': String(durationMs),
          ...(eventId ? { 'X-Bullying-Event-Id': String(eventId) } : {}),
          ...(battery !== null ? { 'X-Battery': String(battery) } : {})
        },
        body: blob
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : null;
      if (!res.ok) throw data || { error: 'REQUEST_FAILED' };

      await auth.refresh();
    } catch {
      // ignore (must not break the rest of the flow)
    }
  };

  const recordBullyingVideo = async (eventIdPromise: Promise<number | null>) => {
    // Evidence: try a short video clip (10–20s). If camera permission isn't granted, silently skip.
    if (!('mediaDevices' in navigator) || !navigator.mediaDevices?.getUserMedia) return;
    // @ts-ignore
    if (typeof window.MediaRecorder === 'undefined') return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });

      const options: MediaRecorderOptions = {};
      // @ts-ignore
      const MR: typeof MediaRecorder = window.MediaRecorder;
      const candidates = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
      for (const c of candidates) {
        try {
          if (MR.isTypeSupported && MR.isTypeSupported(c)) {
            options.mimeType = c;
            break;
          }
        } catch {
          // ignore
        }
      }

      const rec = new MediaRecorder(stream, options);
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };

      const startedAt = Date.now();
      const stopped = new Promise<void>((resolve) => {
        rec.onstop = () => resolve();
      });

      rec.start();

      // Auto-stop in ~15 seconds.
      window.setTimeout(() => {
        try {
          if (rec.state !== 'inactive') rec.stop();
        } catch {
          // ignore
        }
      }, 15_000);

      await stopped;

      try {
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }

      const durationMs = Math.max(0, Date.now() - startedAt);
      const mime = rec.mimeType || options.mimeType || 'video/webm';
      const blob = new Blob(chunks, { type: mime });
      if (!blob || blob.size < 1024) return;

      const battery = await getBatteryLevel();
      const eventId = await eventIdPromise;

      const res = await fetch('/api/signals/bullying-video-clip', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': blob.type || 'application/octet-stream',
          'X-Video-Duration-Ms': String(durationMs),
          ...(eventId ? { 'X-Bullying-Event-Id': String(eventId) } : {}),
          ...(battery !== null ? { 'X-Battery': String(battery) } : {})
        },
        body: blob
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : null;
      if (!res.ok) throw data || { error: 'REQUEST_FAILED' };

      await auth.refresh();
    } catch {
      // ignore (permissions / unsupported / etc)
    }
  };

  const onBullyingSos = async () => {
    const battery = await getBatteryLevel();
    // Share one alert promise with the evidence capture so the alert isn't sent twice,
    // while still surfacing the real outcome to the user (no more false "sent").
    let resolveEventId: (v: number | null) => void = () => {};
    const eventIdPromise = new Promise<number | null>((r) => {
      resolveEventId = r;
    });
    // Start evidence capture immediately (and never break the app if permissions are missing).
    recordBullyingAudio(eventIdPromise);
    recordBullyingVideo(eventIdPromise);
    try {
      const id = await sendBullyingAlert(battery);
      resolveEventId(id);
      toast.show('🟣 ' + t(prefs.lang, 'toastBullyingSent'));
    } catch {
      resolveEventId(null);
      toast.show('⚠️ ' + t(prefs.lang, 'toastFailed'));
    }
  };

  const recordDangerAudio = async () => {
    // MVP: record a short audio clip (auto-stop) and upload to server as a signal.
    if (!('mediaDevices' in navigator) || !navigator.mediaDevices?.getUserMedia) {
      toast.show('⚠️ ' + t(prefs.lang, 'toastMicUnavailable'));
      return;
    }
    // @ts-ignore
    if (typeof window.MediaRecorder === 'undefined') {
      toast.show('⚠️ ' + t(prefs.lang, 'toastMicUnavailable'));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const options: MediaRecorderOptions = {};
      // Prefer Opus in WebM when available.
      // @ts-ignore
      const MR: typeof MediaRecorder = window.MediaRecorder;
      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
      for (const c of candidates) {
        try {
          if (MR.isTypeSupported && MR.isTypeSupported(c)) {
            options.mimeType = c;
            break;
          }
        } catch {
          // ignore
        }
      }

      const rec = new MediaRecorder(stream, options);
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };

      const startedAt = Date.now();
      const stopped = new Promise<void>((resolve) => {
        rec.onstop = () => resolve();
      });

      rec.start();
      setVoiceListening(true);

      // Auto-stop in ~60 seconds (MVP).
      window.setTimeout(() => {
        try {
          if (rec.state !== 'inactive') rec.stop();
        } catch {
          // ignore
        }
      }, 60_000);

      await stopped;

      try {
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }

      const durationMs = Math.max(0, Date.now() - startedAt);
      const mime = rec.mimeType || options.mimeType || 'audio/webm';
      const blob = new Blob(chunks, { type: mime });
      if (!blob || blob.size < 256) {
        toast.show('⚠️ ' + t(prefs.lang, 'toastAudioNotSent'));
        return;
      }

      const battery = await getBatteryLevel();
      const res = await fetch('/api/signals/audio-clip', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': blob.type || 'application/octet-stream',
          'X-Audio-Duration-Ms': String(durationMs),
          ...(battery !== null ? { 'X-Battery': String(battery) } : {})
        },
        body: blob
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : null;
      if (!res.ok) throw data || { error: 'REQUEST_FAILED' };

      toast.show('🎙️ ' + t(prefs.lang, 'toastAudioSent'));
      await auth.refresh();
    } catch {
      toast.show('⚠️ ' + t(prefs.lang, 'toastFailed'));
    } finally {
      setVoiceListening(false);
    }
  };

  return (
    <div style={{ paddingTop: 12 }}>
      <div className="home-head">
        <div className="muted">{t(prefs.lang, 'brandTagline')}</div>
      </div>

      <div className="home-orb">
        <Orb
          title={t(prefs.lang, 'iAmOk')}
          subtitle={t(prefs.lang, 'lastSignal', { time: lastTimeStr })}
          onPress={sendOk}
          onLongPress={() => setSheet(true)}
        />
      </div>

      <div className="home-cta muted">{t(prefs.lang, 'oneTapCovered')}</div>

      <div className="btn-row" style={{ marginTop: 14 }}>
        <button className="btn btn-sos" onClick={() => nav('/sos')}>
          {t(prefs.lang, 'sos')}
        </button>
        <button
          className={voiceListening ? 'btn btn-primary btn-listening' : 'btn btn-primary'}
          onClick={recordDangerAudio}
        >
          <Mic size={18} /> {voiceListening ? t(prefs.lang, 'voiceSosListening') : t(prefs.lang, 'voiceSosArm')}
        </button>
        <button className="btn btn-grad" onClick={onPickMeUp}>
          <PhoneCall size={18} /> {t(prefs.lang, 'pickMeUp')}
        </button>
      </div>

      <div className="btn-row two" style={{ marginTop: 10 }}>
        <button className="btn btn-secondary" onClick={() => nav('/checkin')}>
          <MessageCircle size={18} /> {t(prefs.lang, 'checkIn')}
        </button>
        <button className="btn btn-bullying" onClick={onBullyingSos}>
          <ShieldAlert size={18} /> {t(prefs.lang, 'bullyingSos')}
        </button>
      </div>

      <ActionSheet open={sheet} onClose={() => setSheet(false)} onAction={onQuickAction} />
    </div>
  );
}
