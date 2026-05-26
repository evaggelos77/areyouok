import React, { useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePrefs } from '../contexts/PrefsContext';
import { useToast } from '../contexts/ToastContext';
import { useVoiceAssist } from '../contexts/VoiceAssistContext';
import { apiFetch, getBatteryLevel, getCurrentPosition } from '../lib/api';

type RecAny = any;

function getRecognitionCtor(): any | null {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function normalize(text: string) {
  return String(text || '')
    .toLowerCase()
    .replaceAll('ά', 'α')
    .replaceAll('έ', 'ε')
    .replaceAll('ή', 'η')
    .replaceAll('ί', 'ι')
    .replaceAll('ό', 'ο')
    .replaceAll('ύ', 'υ')
    .replaceAll('ώ', 'ω')
    .replaceAll('ϊ', 'ι')
    .replaceAll('ΐ', 'ι')
    .replaceAll('ϋ', 'υ')
    .replaceAll('ΰ', 'υ');
}

export default function VoiceAssistRunner() {
  const auth = useAuth();
  const prefs = usePrefs();
  const toast = useToast();
  const voice = useVoiceAssist();

  const recRef = useRef<RecAny | null>(null);
  const restartTmr = useRef<number | null>(null);
  const runningRef = useRef<boolean>(false);
  const keywordsRef = useRef<string[]>(voice.keywords);
  const enabledRef = useRef<boolean>(voice.enabled);
  const langRef = useRef<'el' | 'en'>(prefs.lang);
  const lastTriggerAtRef = useRef<number>(0);

  useEffect(() => {
    keywordsRef.current = voice.keywords;
  }, [voice.keywords]);
  useEffect(() => {
    enabledRef.current = voice.enabled;
  }, [voice.enabled]);
  useEffect(() => {
    langRef.current = prefs.lang;
  }, [prefs.lang]);

  const normalizedKeywords = useMemo(() => voice.keywords.map((k) => normalize(k)).filter(Boolean), [voice.keywords]);
  const yearlyUnlocked = Boolean(auth.entitlements?.voice_keywords_enabled);

  const stop = () => {
    if (restartTmr.current) {
      window.clearTimeout(restartTmr.current);
      restartTmr.current = null;
    }
    runningRef.current = false;
    const rec = recRef.current;
    recRef.current = null;
    if (!rec) return;
    try {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      rec.onaudiostart = null;
      rec.onaudioend = null;
      rec.stop?.();
    } catch {
      // ignore
    }
    try {
      rec.abort?.();
    } catch {
      // ignore
    }
  };

  const triggerHelp = async (matchedKeyword?: string) => {
    const COOLDOWN_MS = 2 * 60 * 1000;
    const now = Date.now();
    if (now - lastTriggerAtRef.current < COOLDOWN_MS) return;
    lastTriggerAtRef.current = now;

    try {
      const battery = await getBatteryLevel();
      let pos: any = null;
      try {
        pos = await getCurrentPosition();
      } catch {
        pos = null;
      }
      await apiFetch('/api/signals/voice-help', {
        method: 'POST',
        body: JSON.stringify({ battery, keyword: matchedKeyword || null, ...(pos || {}) })
      });
      toast.show('🆘');
      auth.refresh().catch(() => undefined);
    } catch (e: any) {
      if (e?.error === 'YEARLY_REQUIRED') {
        voice.setEnabled(false);
        stop();
        toast.show('🔒');
        return;
      }
      toast.show('⚠️');
    }
  };

  const start = () => {
    if (runningRef.current) return;
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    const rec: RecAny = new Ctor();
    recRef.current = rec;
    runningRef.current = true;

    rec.lang = langRef.current === 'el' ? 'el-GR' : 'en-US';
    rec.continuous = true;
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onresult = (event: any) => {
      try {
        const kw = keywordsRef.current;
        if (!enabledRef.current) return;
        if (!kw || kw.length === 0) return;
        const kws = kw.map((k) => normalize(k)).filter(Boolean);
        if (kws.length === 0) return;

        const startIdx = typeof event.resultIndex === 'number' ? event.resultIndex : 0;
        for (let i = startIdx; i < event.results.length; i++) {
          const res = event.results[i];
          if (!res?.isFinal) continue;
          const transcriptRaw = String(res?.[0]?.transcript || '');
          const transcript = normalize(transcriptRaw);
          if (!transcript) continue;
          for (let idx = 0; idx < kws.length; idx++) {
            const k = kws[idx];
            if (k && transcript.includes(k)) {
              triggerHelp(kw[idx]);
              return;
            }
          }
        }
      } catch {
        // ignore
      }
    };

    rec.onerror = (e: any) => {
      const err = String(e?.error || '');
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        stop();
        return;
      }
      try {
        rec.stop?.();
      } catch {
        // ignore
      }
    };

    rec.onend = () => {
      runningRef.current = false;
      recRef.current = null;
      if (!enabledRef.current) return;
      if (!document.hidden) {
        restartTmr.current = window.setTimeout(() => start(), 700);
      }
    };

    try {
      rec.start();
    } catch {
      runningRef.current = false;
      recRef.current = null;
    }
  };

  useEffect(() => {
    const shouldRun = Boolean(auth.user) && yearlyUnlocked && voice.supported && voice.enabled && normalizedKeywords.length > 0;
    if (!shouldRun) {
      stop();
      return;
    }
    start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.user?.id, auth.entitlements?.voice_keywords_enabled, yearlyUnlocked, voice.supported, voice.enabled, prefs.lang, normalizedKeywords.join('|')]);

  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        stop();
      } else {
        const shouldRun =
          Boolean(auth.user) && yearlyUnlocked && voice.supported && voice.enabled && keywordsRef.current.length > 0;
        if (shouldRun) start();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.user?.id, auth.entitlements?.voice_keywords_enabled, yearlyUnlocked, voice.supported, voice.enabled]);

  return null;
}
