import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Lang } from '../lib/i18n';

export type Theme = 'neon' | 'clean' | 'high_contrast';
export type Mode = 'teen' | 'adult' | 'senior';

export type Prefs = {
  lang: Lang;
  theme: Theme;
  mode: Mode;
};

type PrefsContextValue = Prefs & {
  setLang: (lang: Lang) => void;
  setTheme: (theme: Theme) => void;
  setMode: (mode: Mode) => void;
  applyFromUser: (u: any) => void;
};

const PrefsContext = createContext<PrefsContextValue | null>(null);

function getInitialLang(): Lang {
  const saved = localStorage.getItem('ayok_lang');
  if (saved === 'el' || saved === 'en') return saved;
  const nav = navigator.language?.toLowerCase?.() || 'en';
  return nav.startsWith('el') ? 'el' : 'en';
}

function getInitialTheme(): Theme {
  const saved = localStorage.getItem('ayok_theme');
  if (saved === 'neon' || saved === 'clean' || saved === 'high_contrast') return saved;
  return 'neon';
}

function getInitialMode(): Mode {
  const saved = localStorage.getItem('ayok_mode');
  if (saved === 'teen' || saved === 'adult' || saved === 'senior') return saved;
  return 'teen';
}

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => getInitialLang());
  const [theme, setThemeState] = useState<Theme>(() => getInitialTheme());
  const [mode, setModeState] = useState<Mode>(() => getInitialMode());

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem('ayok_lang', l);
  };

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem('ayok_theme', t);
  };

  const setMode = (m: Mode) => {
    setModeState(m);
    localStorage.setItem('ayok_mode', m);
  };

  const applyFromUser = (u: any) => {
    if (!u) return;
    if (u.language === 'el' || u.language === 'en') setLang(u.language);
    if (u.theme === 'neon' || u.theme === 'clean' || u.theme === 'high_contrast') setTheme(u.theme);
    if (u.mode === 'teen' || u.mode === 'adult' || u.mode === 'senior') setMode(u.mode);
  };

  // Apply theme + mode classes to body
  useEffect(() => {
    const cl = document.body.classList;
    cl.remove('theme-neon', 'theme-clean', 'theme-high-contrast');
    cl.add(theme === 'clean' ? 'theme-clean' : theme === 'high_contrast' ? 'theme-high-contrast' : 'theme-neon');

    cl.remove('mode-teen', 'mode-adult', 'mode-senior');
    cl.add(mode === 'adult' ? 'mode-adult' : mode === 'senior' ? 'mode-senior' : 'mode-teen');
  }, [theme, mode]);

  const value = useMemo(
    () => ({ lang, theme, mode, setLang, setTheme, setMode, applyFromUser }),
    [lang, theme, mode]
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error('PrefsProvider missing');
  return ctx;
}
