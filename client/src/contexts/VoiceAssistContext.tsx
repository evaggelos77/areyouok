import React, { createContext, useContext, useMemo, useState } from 'react';

export type VoiceAssistSettings = {
  enabled: boolean;
  keywords: string[];
  supported: boolean;
  setEnabled: (v: boolean) => void;
  setKeywords: (v: string[]) => void;
};

const VoiceAssistContext = createContext<VoiceAssistSettings | null>(null);

function detectSupport(): boolean {
  const w = window as any;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

function getInitialEnabled(): boolean {
  const v = localStorage.getItem('ayok_voice_enabled');
  return v === '1' || v === 'true';
}

function getInitialKeywords(): string[] {
  const raw = localStorage.getItem('ayok_voice_keywords');
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      return arr
        .map((x) => String(x || '').trim())
        .filter((x) => x.length > 0)
        .slice(0, 8);
    }
    return [];
  } catch {
    // Back-compat: allow comma-separated string.
    return raw
      .split(',')
      .map((x) => x.trim())
      .filter((x) => x.length > 0)
      .slice(0, 8);
  }
}

export function VoiceAssistProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState<boolean>(() => getInitialEnabled());
  const [keywords, setKeywordsState] = useState<string[]>(() => getInitialKeywords());
  const supported = useMemo(() => detectSupport(), []);

  const setEnabled = (v: boolean) => {
    setEnabledState(v);
    localStorage.setItem('ayok_voice_enabled', v ? '1' : '0');
  };

  const setKeywords = (arr: string[]) => {
    const cleaned = (arr || [])
      .map((x) => String(x || '').trim())
      .filter((x) => x.length > 0)
      .slice(0, 8);
    setKeywordsState(cleaned);
    localStorage.setItem('ayok_voice_keywords', JSON.stringify(cleaned));
  };

  const value = useMemo(
    () => ({ enabled, keywords, supported, setEnabled, setKeywords }),
    [enabled, keywords, supported]
  );

  return <VoiceAssistContext.Provider value={value}>{children}</VoiceAssistContext.Provider>;
}

export function useVoiceAssist() {
  const ctx = useContext(VoiceAssistContext);
  if (!ctx) throw new Error('VoiceAssistProvider missing');
  return ctx;
}
