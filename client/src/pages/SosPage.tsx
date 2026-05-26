import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Phone, MapPin, Mic, Square, X } from 'lucide-react';
import TopBar from '../components/TopBar';
import { usePrefs } from '../contexts/PrefsContext';
import { useToast } from '../contexts/ToastContext';
import { apiFetch, getBatteryLevel, getCurrentPosition } from '../lib/api';
import { t } from '../lib/i18n';

const numbers = [
  { num: '112', labelEl: 'Ευρωπαϊκός Αριθμός', labelEn: 'European emergency' },
  { num: '100', labelEl: 'Αστυνομία', labelEn: 'Police' },
  { num: '166', labelEl: 'ΕΚΑΒ', labelEn: 'Ambulance' },
  { num: '199', labelEl: 'Πυροσβεστική', labelEn: 'Fire brigade' }
];

type AudioMode = 10 | 20 | 30 | 60 | 'manual';

type LiveRecorder = {
  rec: MediaRecorder;
  stream: MediaStream;
  chunks: BlobPart[];
  startedAt: number;
  stopTimerId: number | null;
  tickId: number | null;
  signalId: number | null;
  emergencyNumber: string;
  discard: boolean;
};

const DURATION_OPTIONS: AudioMode[] = [10, 20, 30, 60, 'manual'];

function formatTimer(ms: number) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export default function SosPage() {
  const prefs = usePrefs();
  const toast = useToast();

  const [selected, setSelected] = useState('112');
  const [sendLocation, setSendLocation] = useState(true);
  const [sendAudio, setSendAudio] = useState(false);
  const [audioMode, setAudioMode] = useState<AudioMode>(20);
  const [slide, setSlide] = useState(0);
  const [busy, setBusy] = useState(false);

  const [recorderOpen, setRecorderOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [audioElapsedMs, setAudioElapsedMs] = useState(0);
  const [audioMaxMs, setAudioMaxMs] = useState(20_000);
  const [audioEmergencyNumber, setAudioEmergencyNumber] = useState('112');

  const recorderRef = useRef<LiveRecorder | null>(null);

  const rows = useMemo(
    () =>
      numbers.map((n) => ({
        ...n,
        label: prefs.lang === 'el' ? n.labelEl : n.labelEn
      })),
    [prefs.lang]
  );

  const maxAudioMs = audioMode === 'manual' ? 60_000 : Number(audioMode) * 1000;
  const timerLabel = recording ? formatTimer(Math.max(0, audioMaxMs - audioElapsedMs)) : formatTimer(audioElapsedMs);

  const cleanupRecorder = (live: LiveRecorder | null) => {
    if (!live) return;
    if (live.stopTimerId) window.clearTimeout(live.stopTimerId);
    if (live.tickId) window.clearInterval(live.tickId);
    try {
      live.stream.getTracks().forEach((t) => t.stop());
    } catch {
      // ignore
    }
  };

  const stopSosAudio = (discard = false) => {
    const live = recorderRef.current;
    if (!live) {
      setRecorderOpen(false);
      setRecording(false);
      setUploadingAudio(false);
      return;
    }
    live.discard = discard;
    try {
      if (live.rec.state !== 'inactive') {
        live.rec.stop();
      }
    } catch {
      cleanupRecorder(live);
      recorderRef.current = null;
      setRecorderOpen(false);
      setRecording(false);
      setUploadingAudio(false);
    }
  };

  useEffect(() => {
    return () => {
      const live = recorderRef.current;
      if (live) {
        live.discard = true;
        try {
          if (live.rec.state !== 'inactive') live.rec.stop();
        } catch {
          cleanupRecorder(live);
        }
      }
    };
  }, []);

  const startSosAudioRecorder = async (signalId: number | null, emergencyNumber: string) => {
    if (!('mediaDevices' in navigator) || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('MIC_UNAVAILABLE');
    }
    // @ts-ignore
    if (typeof window.MediaRecorder === 'undefined') {
      throw new Error('RECORDER_UNAVAILABLE');
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const options: MediaRecorderOptions = {};
    // @ts-ignore
    const MR: typeof MediaRecorder = window.MediaRecorder;
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
    for (const candidate of candidates) {
      try {
        if (MR.isTypeSupported && MR.isTypeSupported(candidate)) {
          options.mimeType = candidate;
          break;
        }
      } catch {
        // ignore
      }
    }

    const rec = new MediaRecorder(stream, options);
    const chunks: BlobPart[] = [];
    const startedAt = Date.now();

    const live: LiveRecorder = {
      rec,
      stream,
      chunks,
      startedAt,
      stopTimerId: null,
      tickId: null,
      signalId,
      emergencyNumber,
      discard: false
    };
    recorderRef.current = live;

    rec.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunks.push(ev.data);
    };

    rec.onstop = async () => {
      cleanupRecorder(live);
      const durationMs = Math.max(0, Date.now() - startedAt);
      setRecording(false);
      setAudioElapsedMs(durationMs);

      const mime = rec.mimeType || options.mimeType || 'audio/webm';
      const blob = new Blob(chunks, { type: mime });
      const shouldDiscard = live.discard;
      recorderRef.current = null;

      if (shouldDiscard) {
        setRecorderOpen(false);
        setUploadingAudio(false);
        return;
      }

      if (!blob || blob.size < 256) {
        setRecorderOpen(false);
        setUploadingAudio(false);
        toast.show('⚠️ ' + t(prefs.lang, 'toastAudioNotSent'));
        return;
      }

      setUploadingAudio(true);
      try {
        const battery = await getBatteryLevel();
        const res = await fetch('/api/signals/sos-audio-clip', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': blob.type || 'application/octet-stream',
            'X-Audio-Duration-Ms': String(durationMs),
            ...(live.signalId ? { 'X-SOS-Signal-Id': String(live.signalId) } : {}),
            ...(live.emergencyNumber ? { 'X-Emergency-Number': live.emergencyNumber } : {}),
            ...(battery !== null ? { 'X-Battery': String(battery) } : {})
          },
          body: blob
        });

        const text = await res.text();
        const data = text ? JSON.parse(text) : null;
        if (!res.ok) throw data || { error: 'REQUEST_FAILED' };

        toast.show('🎙️ ' + t(prefs.lang, 'toastAudioSent'));
      } catch {
        toast.show('⚠️ ' + t(prefs.lang, 'toastAudioNotSent'));
      } finally {
        setUploadingAudio(false);
        setRecorderOpen(false);
      }
    };

    rec.start();

    setAudioEmergencyNumber(emergencyNumber);
    setAudioMaxMs(maxAudioMs);
    setAudioElapsedMs(0);
    setRecorderOpen(true);
    setRecording(true);
    setUploadingAudio(false);

    live.tickId = window.setInterval(() => {
      setAudioElapsedMs(Math.max(0, Date.now() - startedAt));
    }, 250);

    live.stopTimerId = window.setTimeout(() => {
      stopSosAudio(false);
    }, maxAudioMs);
  };

  const openDialer = (number: string) => {
    window.location.href = `tel:${number}`;
  };

  const onCall = async () => {
    setBusy(true);
    let signalOk = false;
    let signalData: { ok: true; signal?: { id?: number } } | null = null;
    try {
      const battery = await getBatteryLevel();
      const pos = sendLocation ? await getCurrentPosition() : null;
      signalData = await apiFetch<{ ok: true; signal?: { id?: number } }>('/api/signals/sos', {
        method: 'POST',
        body: JSON.stringify({ number: selected, sendLocation, battery, ...(pos || {}) })
      });
      signalOk = true;
    } catch {
      // Never swallow silently: in an emergency the user must still be able to call.
      signalOk = false;
    }

    try {
      if (signalOk && sendAudio) {
        // Alert reached the server — the audio clip attaches to it.
        toast.show('🆘 ' + t(prefs.lang, 'toastSosSent'));
        try {
          await startSosAudioRecorder(signalData?.signal?.id ?? null, selected);
        } catch {
          toast.show('⚠️ ' + t(prefs.lang, 'toastRecordFailed'));
          openDialer(selected);
        }
      } else {
        // No audio, or the alert failed. The call is the priority — always open the dialer.
        toast.show(
          signalOk
            ? '🆘 ' + t(prefs.lang, 'toastSosSent')
            : '⚠️ ' + t(prefs.lang, 'toastSosNotSentCalling')
        );
        openDialer(selected);
      }
    } finally {
      setBusy(false);
      setSlide(0);
    }
  };

  return (
    <div className="page">
      <TopBar />
      <div className="content safe-pad">
        <div style={{ paddingTop: 8 }}>
          <div className="page-title">{t(prefs.lang, 'sosTitle')}</div>

          <div className="glass neon-outline card" style={{ marginTop: 14 }}>
            <div className="muted">{t(prefs.lang, 'emergencyNumbers')}</div>

            <div className="sos-list" style={{ marginTop: 12 }}>
              {rows.map((r) => (
                <button
                  key={r.num}
                  className={selected === r.num ? 'sos-item active' : 'sos-item'}
                  onClick={() => setSelected(r.num)}
                >
                  <div className="sos-num">
                    <Phone size={18} /> {r.num}
                  </div>
                  <div className="muted small">{r.label}</div>
                </button>
              ))}
            </div>

            <div className="row-between" style={{ marginTop: 14 }}>
              <div className="toggle-row">
                <MapPin size={18} />
                <div>
                  <div className="small">{t(prefs.lang, 'sendLocationToCircle')}</div>
                  <div className="muted small">{t(prefs.lang, 'privacyFirst')}</div>
                </div>
              </div>
              <button className={sendLocation ? 'toggle on' : 'toggle'} onClick={() => setSendLocation((v) => !v)} />
            </div>

            <div className="row-between" style={{ marginTop: 14 }}>
              <div className="toggle-row">
                <Mic size={18} />
                <div>
                  <div className="small">{t(prefs.lang, 'sendAudioToo')}</div>
                  <div className="muted small">{t(prefs.lang, 'sosAudioIntro')}</div>
                </div>
              </div>
              <button className={sendAudio ? 'toggle on' : 'toggle'} onClick={() => setSendAudio((v) => !v)} />
            </div>

            {sendAudio ? (
              <div className="sos-audio-options" style={{ marginTop: 12 }}>
                <div className="muted small">{t(prefs.lang, 'sosAudioDuration')}</div>
                <div className="sos-duration-chips" style={{ marginTop: 10 }}>
                  {DURATION_OPTIONS.map((option) => {
                    const label = option === 'manual' ? t(prefs.lang, 'sosAudioManual') : `${option}s`;
                    const active = audioMode === option;
                    return (
                      <button
                        key={String(option)}
                        className={active ? 'duration-chip active' : 'duration-chip'}
                        onClick={() => setAudioMode(option)}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div className="muted small" style={{ marginTop: 10 }}>
                  {t(prefs.lang, 'sosAudioMaxHint')}
                </div>
              </div>
            ) : null}

            <div className="slide" style={{ marginTop: 14 }}>
              <div className="muted small">{sendAudio ? t(prefs.lang, 'slideToSosAudio') : t(prefs.lang, 'slideToCall')}</div>
              <input
                type="range"
                min={0}
                max={100}
                value={slide}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setSlide(v);
                  if (v > 92 && !busy) onCall();
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {recorderOpen ? (
        <div
          className="sheet-backdrop"
          onClick={() => {
            if (!recording && !uploadingAudio) setRecorderOpen(false);
          }}
        >
          <div className="sheet glass neon-outline sos-audio-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <div className="sheet-title">{t(prefs.lang, 'sosAudioSheetTitle')}</div>
              {!uploadingAudio ? (
                <button className="icon-btn" onClick={() => stopSosAudio(true)} aria-label={t(prefs.lang, 'cancel')}>
                  <X size={18} />
                </button>
              ) : null}
            </div>

            <div className="muted small" style={{ marginTop: 10 }}>
              {t(prefs.lang, 'sosAudioSheetHint')}
            </div>

            <div className="recording-status" style={{ marginTop: 14 }}>
              <div className={recording ? 'recording-pill live' : 'recording-pill'}>
                <span className="record-dot" />
                {recording ? t(prefs.lang, 'sosAudioRecording') : t(prefs.lang, 'sosAudioUploading')}
              </div>
              <div className="record-timer">{timerLabel}</div>
            </div>

            <div className="muted small" style={{ marginTop: 10 }}>
              {recording
                ? t(prefs.lang, 'sosAudioCallHint')
                : t(prefs.lang, 'sosAudioUploadDoneHint')}
            </div>

            <div className="btn-row two" style={{ marginTop: 14 }}>
              <button className="btn btn-grad" onClick={() => openDialer(audioEmergencyNumber)} disabled={uploadingAudio}>
                <Phone size={18} /> {t(prefs.lang, 'sosAudioCallNow', { number: audioEmergencyNumber })}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => stopSosAudio(false)}
                disabled={!recording || uploadingAudio}
              >
                <Square size={18} /> {t(prefs.lang, 'sosAudioStopSend')}
              </button>
            </div>

            <div className="btn-row" style={{ marginTop: 10 }}>
              <button
                className="btn btn-secondary"
                onClick={() => stopSosAudio(true)}
                disabled={uploadingAudio}
              >
                {t(prefs.lang, 'sosAudioSkip')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
