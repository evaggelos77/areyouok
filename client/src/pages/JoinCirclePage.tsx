import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Link2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePrefs } from '../contexts/PrefsContext';
import { apiFetch } from '../lib/api';
import { t } from '../lib/i18n';

export default function JoinCirclePage() {
  const { token } = useParams();
  const auth = useAuth();
  const prefs = usePrefs();
  const nav = useNavigate();

  const [status, setStatus] = useState<'idle' | 'joining' | 'done' | 'error'>('idle');

  useEffect(() => {
    if (token) {
      localStorage.setItem('ayok_join_token', token);
    }
  }, [token]);

  useEffect(() => {
    const run = async () => {
      const tok = token || localStorage.getItem('ayok_join_token');
      if (!tok) return;
      if (!auth.user) return;
      setStatus('joining');
      try {
        await apiFetch('/api/circle/join', { method: 'POST', body: JSON.stringify({ token: tok }) });
        localStorage.removeItem('ayok_join_token');
        setStatus('done');
        nav('/circle');
      } catch {
        setStatus('error');
      }
    };
    run();
  }, [auth.user, token]);

  return (
    <div className="page safe-pad safe-top">
      <div className="login">
        <div className="brand big">
          <span className="brand-are">Are</span>
          <span className="brand-you">You</span>
          <span className="brand-ok">OK</span>
        </div>

        <div className="login-card glass neon-outline" style={{ marginTop: 18 }}>
          <div className="login-title">{t(prefs.lang, 'joinCircle')}</div>
          <div className="muted small" style={{ marginTop: 6 }}>
            {auth.user
              ? status === 'joining'
                ? t(prefs.lang, 'joining')
                : status === 'error'
                  ? t(prefs.lang, 'errorsGeneric')
                  : '—'
              : prefs.lang === 'el'
                ? 'Κάνε σύνδεση για να μπεις στα Άτομα Εμπιστοσύνης.'
                : 'Sign in to join Trusted People.'}
          </div>

          <div style={{ marginTop: 14 }}>
            <div className="pill">
              <Link2 size={16} />
              {token}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
