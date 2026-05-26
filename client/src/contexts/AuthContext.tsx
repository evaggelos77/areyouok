import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../lib/api';
import { usePrefs } from './PrefsContext';

export type User = {
  id: number;
  email: string;
  name: string | null;
  avatar: string | null;
  phone?: string | null;
  mode: 'teen' | 'adult' | 'senior';
  role: 'user' | 'circle';
  language: 'el' | 'en';
  theme: 'neon' | 'clean' | 'high_contrast';
  premium: number;
  subscription_plan?: 'free' | 'monthly' | 'yearly' | null;
  premium_current_period_end?: number | null;
  onboarded?: number;
  snooze_until?: number | null;
  max_checkins_per_hour?: number;
  last_signal_at?: number | null;
  trial_used?: number | boolean;
  trial_expires_at?: number | null;
  plan_source?: 'free' | 'trial' | 'stripe' | null;
  plan_interval?: 'free' | 'month' | 'year' | null;
};

export type Entitlements = {
  is_premium: boolean;
  plan_source: 'free' | 'trial' | 'stripe';
  plan_interval: 'free' | 'month' | 'year';
  trial_used: boolean;
  trial_expires_at: number | null;
  trial_remaining_ms: number;
  trial_expired: boolean;
  premium_until: number | null;
  voice_keywords_enabled: boolean;
  limits: {
    checks_per_hour: number;
    trusted_contacts_limit: number;
    safewalk_limit: number;
    checkin_schedules_limit: number;
  };
  usage: {
    checks_sent_last_24h: number;
    safewalk_sessions_last_24h: number;
    alerts_sent_last_24h: number;
    trusted_people_notified_last_24h: number;
  };
};

type AuthContextValue = {
  user: User | null;
  entitlements: Entitlements | null;
  loading: boolean;
  requestOtp: (email: string) => Promise<{ devCode?: string }>;
  verifyOtp: (email: string, code: string) => Promise<void>;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  startTrial: () => Promise<Entitlements>;
};

type MeResponse = {
  user: User | null;
  entitlements?: Entitlements | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [loading, setLoading] = useState(true);
  const prefs = usePrefs();
  const refreshInFlight = useRef<Promise<void> | null>(null);

  const refresh = async () => {
    if (refreshInFlight.current) return refreshInFlight.current;

    const run = (async () => {
      const data = await apiFetch<MeResponse>('/api/auth/me', { method: 'GET' });
      setUser(data.user);
      if (data.user) prefs.applyFromUser(data.user);

      if (!data.user) {
        setEntitlements(null);
        return;
      }

      try {
        const liveEntitlements = await apiFetch<Entitlements>('/api/me/entitlements', { method: 'GET' });
        setEntitlements(liveEntitlements);
      } catch {
        setEntitlements(data.entitlements || null);
      }
    })();

    refreshInFlight.current = run.finally(() => {
      refreshInFlight.current = null;
    });

    return refreshInFlight.current;
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onFocus = () => {
      refresh().catch(() => undefined);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!entitlements || entitlements.plan_source !== 'trial' || !entitlements.trial_expires_at || entitlements.trial_expired) {
      return;
    }

    const msLeft = entitlements.trial_expires_at - Date.now() + 350;
    if (msLeft <= 0) {
      refresh().catch(() => undefined);
      return;
    }

    const tmr = window.setTimeout(() => {
      refresh().catch(() => undefined);
    }, Math.min(msLeft, 2_147_483_647));

    return () => window.clearTimeout(tmr);
  }, [entitlements?.plan_source, entitlements?.trial_expires_at, entitlements?.trial_expired]);

  const requestOtp = async (email: string) => {
    const data = await apiFetch<{ ok: true; devCode?: string }>('/api/auth/request-otp', {
      method: 'POST',
      body: JSON.stringify({ email, language: prefs.lang })
    });
    return { devCode: data.devCode };
  };

  const verifyOtp = async (email: string, code: string) => {
    await apiFetch('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, code })
    });
    await refresh();
  };

  const startTrial = async () => {
    const data = await apiFetch<{ ok: true; entitlements: Entitlements }>('/api/trial/start', {
      method: 'POST',
      body: '{}'
    });
    localStorage.setItem('ayok_trial_used_device', '1');
    setEntitlements(data.entitlements);
    await refresh();
    return data.entitlements;
  };

  const logout = async () => {
    await apiFetch<{ ok: true }>('/api/auth/logout', { method: 'POST', body: '{}' });
    setUser(null);
    setEntitlements(null);
  };

  const value = useMemo(
    () => ({ user, entitlements, loading, requestOtp, verifyOtp, refresh, logout, startTrial }),
    [user, entitlements, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('AuthProvider missing');
  return ctx;
}
