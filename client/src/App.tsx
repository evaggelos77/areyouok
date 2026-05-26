import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { apiFetch } from './lib/api';

import TabsLayout from './pages/TabsLayout';
import LoginPage from './pages/LoginPage';
import OnboardingPage from './pages/OnboardingPage';
import HomePage from './pages/HomePage';
import SafeWalkPage from './pages/SafeWalkPage';
import CirclePage from './pages/CirclePage';
import SettingsPage from './pages/SettingsPage';
import SosPage from './pages/SosPage';
import CheckinPage from './pages/CheckinPage';
import JoinCirclePage from './pages/JoinCirclePage';
import HelpPage from './pages/HelpPage';
import TermsPage from './pages/TermsPage';
import VoiceAssistRunner from './components/VoiceAssistRunner';
import TrialExpiredOverlay from './components/TrialExpiredOverlay';

export default function App() {
  const auth = useAuth();

  // Auto-join flow when user logs in after opening an invite link
  useEffect(() => {
    const tok = localStorage.getItem('ayok_join_token');
    if (!tok) return;
    if (!auth.user) return;

    apiFetch('/api/circle/join', { method: 'POST', body: JSON.stringify({ token: tok }) })
      .then(() => localStorage.removeItem('ayok_join_token'))
      .catch(() => undefined);
  }, [auth.user]);

  // Auto-hide TopBar + BottomTabs while scrolling down, reveal on scroll up or at top.
  // UI-only behavior; does not change any flows/actions.
  useEffect(() => {
    let lastY = window.scrollY || 0;
    let ticking = false;
    let hidden = false;

    const setHidden = (v: boolean) => {
      hidden = v;
      document.body.classList.toggle('ayok-bars-hidden', v);
    };

    const update = () => {
      const y = window.scrollY || 0;
      const delta = y - lastY;
      lastY = y;

      // Always show at the very top.
      if (y <= 10) {
        if (hidden) setHidden(false);
        ticking = false;
        return;
      }

      const THRESH = 8;
      if (delta > THRESH) {
        if (!hidden) setHidden(true);
      } else if (delta < -THRESH) {
        if (hidden) setHidden(false);
      }

      ticking = false;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.body.classList.remove('ayok-bars-hidden');
    };
  }, []);

  if (auth.loading) {
    return (
      <div className="ayok-bg">
        <div className="page safe-pad safe-top">
          <div className="login">
            <div className="brand big">
              <span className="brand-are">Are</span>
              <span className="brand-you">You</span>
              <span className="brand-ok">OK</span>
            </div>
            <div className="muted" style={{ marginTop: 10 }}>
              …
            </div>
          </div>
        </div>
      </div>
    );
  }

  const needsOnboarding = auth.user && auth.user.onboarded !== 1;

  return (
    <div className="ayok-bg">
      <VoiceAssistRunner />
      <TrialExpiredOverlay />
      <Routes>
        <Route path="/join/:token" element={<JoinCirclePage />} />
        <Route path="/terms" element={<TermsPage />} />

        {!auth.user ? (
          <>
            <Route path="/*" element={<LoginPage />} />
          </>
        ) : needsOnboarding ? (
          <>
            <Route path="/*" element={<OnboardingPage />} />
          </>
        ) : (
          <>
            <Route path="/" element={<TabsLayout />}>
              <Route index element={<HomePage />} />
              <Route path="safewalk" element={<SafeWalkPage />} />
              <Route path="circle" element={<CirclePage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            <Route path="/sos" element={<SosPage />} />
            <Route path="/checkin" element={<CheckinPage />} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
    </div>
  );
}
