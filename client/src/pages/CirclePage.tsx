import React, { useEffect, useMemo, useState } from 'react';
import { PhoneCall, MessageSquare, Link as LinkIcon, RefreshCw } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useAuth } from '../contexts/AuthContext';
import { usePrefs } from '../contexts/PrefsContext';
import { useToast } from '../contexts/ToastContext';
import { apiFetch } from '../lib/api';
import { t } from '../lib/i18n';

type Member = {
  id: number;
  email: string;
  name: string | null;
  avatar: string | null;
  phone?: string | null;
  language: 'el' | 'en';
};

type SignalItem = {
  id: number;
  user_id: number;
  type: string;
  message: string | null;
  created_at: number;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  battery: number | null;
  meta_json?: string | null;
  name: string | null;
  email: string;
  avatar: string | null;
};

function timeStr(ts: number, lang: 'el' | 'en') {
  try {
    return new Intl.DateTimeFormat(lang === 'el' ? 'el-GR' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(ts));
  } catch {
    return '';
  }
}

function typeLabel(type: string, lang: 'el' | 'en') {
  const mapEl: Record<string, string> = {
    OK: 'OK',
    CALL_ME: 'Πάρε με',
    NEED_HELP: '🆘 Βοήθεια',
    VOICE_HELP: '🎙️ Φωνητική βοήθεια',
    PICK_ME_UP: 'Έλα να με πάρεις',
    SOS: '🆘 SOS',
    NO_RESPONSE: 'Δεν απάντησε',
    SAFEWALK_START: 'SafeWalk',
    audio_clip: 'Νέα ηχογράφηση',
    AUDIO_CLIP: 'Νέα ηχογράφηση',
    sos_audio_clip: 'Ηχητικό μήνυμα SOS',
    SOS_AUDIO_CLIP: 'Ηχητικό μήνυμα SOS',
    bullying_alert: 'SOS Εκφοβισμού',
    BULLYING_ALERT: 'SOS Εκφοβισμού',
    bullying_audio_clip: 'Αποδεικτικό ήχου',
    BULLYING_AUDIO_CLIP: 'Αποδεικτικό ήχου',
    bullying_video_clip: 'Αποδεικτικό βίντεο',
    BULLYING_VIDEO_CLIP: 'Αποδεικτικό βίντεο'
  };
  const mapEn: Record<string, string> = {
    OK: 'OK',
    CALL_ME: 'Call me',
    NEED_HELP: '🆘 Help',
    VOICE_HELP: '🎙️ Voice help',
    PICK_ME_UP: 'Pick me up',
    SOS: '🆘 SOS',
    NO_RESPONSE: 'No response',
    SAFEWALK_START: 'SafeWalk',
    audio_clip: 'New recording',
    AUDIO_CLIP: 'New recording',
    sos_audio_clip: 'SOS audio message',
    SOS_AUDIO_CLIP: 'SOS audio message',
    bullying_alert: 'Bullying SOS',
    BULLYING_ALERT: 'Bullying SOS',
    bullying_audio_clip: 'Audio evidence',
    BULLYING_AUDIO_CLIP: 'Audio evidence',
    bullying_video_clip: 'Video evidence',
    BULLYING_VIDEO_CLIP: 'Video evidence'
  };

  const map = lang === 'el' ? mapEl : mapEn;
  const raw = String(type || '').trim();
  const hit = map[raw];
  if (hit) return hit;

  // If backend sends an unknown/garbled type, don't surface random symbols in UI.
  const fallback = lang === 'el' ? 'Σήμα' : 'Signal';
  if (!raw) return fallback;
  if (raw.length > 32) return fallback;

  // Allow letters/numbers and a few separators.
  const safe = /^[\p{L}\p{N}_: \-]+$/u;
  if (!safe.test(raw)) return fallback;

  return raw;
}

export default function CirclePage() {
  const auth = useAuth();
  const prefs = usePrefs();
  const toast = useToast();

  const [members, setMembers] = useState<Member[]>([]);
  const [membersLimit, setMembersLimit] = useState<number>(auth.entitlements?.limits.trusted_contacts_limit || 0);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [feed, setFeed] = useState<SignalItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [openAudioId, setOpenAudioId] = useState<number | null>(null);
  const [openVideoId, setOpenVideoId] = useState<number | null>(null);

  const load = async () => {
    const m = await apiFetch<{ members: Member[]; circle: any; limit?: number }>('/api/circle/members', { method: 'GET' });
    setMembers(m.members);
    setMembersLimit(m.limit || auth.entitlements?.limits.trusted_contacts_limit || 0);
    const f = await apiFetch<{ items: SignalItem[]; circle: any }>('/api/circle/feed', { method: 'GET' });
    setFeed(f.items);
  };

  useEffect(() => {
    load();
  }, []);

  const createInvite = async () => {
    setBusy(true);
    try {
      const data = await apiFetch<{ link: string; limit?: number }>('/api/circle/invite', { method: 'POST', body: '{}' });
      setInviteLink(data.link);
      if (data.limit) setMembersLimit(data.limit);
    } catch (e: any) {
      if (e?.error === 'TRUSTED_CONTACTS_LIMIT_REACHED') {
        toast.show('🔒');
        auth.refresh().catch(() => undefined);
      } else {
        toast.show('⚠️');
      }
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    toast.show(t(prefs.lang, 'copied'));
  };

  const onRefresh = async () => {
    setBusy(true);
    try {
      await load();
      toast.show('↻');
    } finally {
      setBusy(false);
    }
  };

  const currentLimit = membersLimit || auth.entitlements?.limits.trusted_contacts_limit || 0;
  const canInvite = currentLimit === 0 ? true : members.length < currentLimit;

  const feedItems = useMemo(() => feed, [feed]);

  return (
    <div style={{ paddingTop: 8 }}>
      <div className="row-between">
        <div className="page-title">{t(prefs.lang, 'circleTitle')}</div>
        <button className="btn btn-secondary" onClick={onRefresh} disabled={busy}>
          <RefreshCw size={18} />
        </button>
      </div>

      <div className="muted small" style={{ marginTop: 6 }}>
        {t(prefs.lang, 'circleDesc')}
      </div>

      <div className="glass neon-outline card" style={{ marginTop: 14 }}>
        <div className="row-between">
          <div className="muted">{t(prefs.lang, 'members')}</div>
          {currentLimit > 0 ? <div className="pill small">{members.length}/{currentLimit}</div> : null}
        </div>
        {currentLimit > 0 ? (
          <div className="muted small" style={{ marginTop: 6 }}>
            {t(prefs.lang, 'trustedPeopleLimitHint', { count: members.length, limit: currentLimit })}
          </div>
        ) : null}
        <div className="members" style={{ marginTop: 12 }}>
          {members.length === 0 ? (
            <div className="muted small">
              {prefs.lang === 'el' ? 'Δεν έχεις προσθέσει άτομα ακόμη.' : "You haven't added anyone yet."}
            </div>
          ) : (
            members.map((m) => {
              const display = m.name || m.email;
              const phone = (m.phone || '').trim();
              const canCall = phone.length > 4;
              const callHref = canCall ? `tel:${phone}` : undefined;
              const msgHref = canCall ? `sms:${phone}` : `mailto:${m.email}`;

              return (
                <div key={m.id} className="member">
                  <div className="avatar lg">
                    <span>{display.slice(0, 1).toUpperCase()}</span>
                  </div>
                  <div className="member-meta">
                    <div className="member-name">{display}</div>
                    <div className="muted small">{canCall ? phone : m.email}</div>
                  </div>
                  <div className="member-actions">
                    <a className={canCall ? 'mini' : 'mini disabled'} href={callHref} aria-disabled={!canCall}>
                      <PhoneCall size={18} />
                    </a>
                    <a className="mini" href={msgHref}>
                      <MessageSquare size={18} />
                    </a>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="glass neon-outline card" style={{ marginTop: 14 }}>
        <div className="row-between">
          <div className="muted">{t(prefs.lang, 'invite')}</div>
          {canInvite ? (
            <button className="btn btn-grad" onClick={createInvite} disabled={busy}>
              <LinkIcon size={18} /> {t(prefs.lang, 'invite')}
            </button>
          ) : (
            <div className="pill small">🔒</div>
          )}
        </div>

        {!canInvite ? (
          <div className="upgrade-box" style={{ marginTop: 12 }}>
            <div className="muted small">{t(prefs.lang, 'trustedPeopleLimitReached')}</div>
            <div className="btn-row" style={{ marginTop: 10 }}>
              <button className="btn btn-grad" onClick={() => (window.location.href = '/settings')}>
                {t(prefs.lang, 'upgrade')}
              </button>
            </div>
          </div>
        ) : inviteLink ? (
          <div style={{ marginTop: 12 }}>
            <div className="invite-link">{inviteLink}</div>
            <div className="btn-row" style={{ marginTop: 10 }}>
              <button className="btn btn-secondary" onClick={copy}>
                {t(prefs.lang, 'copy')}
              </button>
            </div>
            <div className="qr" style={{ marginTop: 12 }}>
              <QRCodeCanvas
                value={inviteLink}
                size={160}
                bgColor={prefs.theme === 'clean' ? '#FFFFFF' : '#0B1020'}
                fgColor={prefs.theme === 'clean' ? '#0B1020' : '#EAF0FF'}
              />
            </div>
          </div>
        ) : (
          <div className="muted small" style={{ marginTop: 10 }}>
            —
          </div>
        )}
      </div>

      <div className="glass neon-outline card" style={{ marginTop: 14 }}>
        <div className="muted">{t(prefs.lang, 'alerts')}</div>
        <div className="feed" style={{ marginTop: 12 }}>
          {feedItems.length === 0 ? (
            <div className="muted small">—</div>
          ) : (
            feedItems.map((it) => {
              const who = it.name || it.email;
              const label = typeLabel(it.type, prefs.lang);
              const time = timeStr(it.created_at, prefs.lang);
              const mapUrl = it.lat && it.lng ? `https://maps.google.com/?q=${it.lat},${it.lng}` : null;
              let meta: any = null;
              if (it.meta_json) {
                try {
                  meta = JSON.parse(it.meta_json);
                } catch {
                  meta = null;
                }
              }
              const isAudio =
                it.type === 'audio_clip' ||
                it.type === 'AUDIO_CLIP' ||
                it.type === 'sos_audio_clip' ||
                it.type === 'SOS_AUDIO_CLIP' ||
                it.type === 'bullying_audio_clip' ||
                it.type === 'BULLYING_AUDIO_CLIP';
              const audioSrc = isAudio && meta?.clipId ? `/api/signals/audio-clip/${meta.clipId}` : null;

              const isVideo = it.type === 'bullying_video_clip' || it.type === 'BULLYING_VIDEO_CLIP';
              const videoSrc = isVideo && meta?.clipId ? `/api/signals/video-clip/${meta.clipId}` : null;
              return (
                <div key={it.id} className="feed-item">
                  <div className="feed-top">
                    <div className="feed-label">{label}</div>
                    <div className="muted small">{time}</div>
                  </div>
                  <div className="muted">{who}</div>
                  {mapUrl ? (
                    <a className="map" href={mapUrl} target="_blank" rel="noreferrer">
                      {prefs.lang === 'el' ? 'Άνοιγμα χάρτη' : 'Open map'}
                    </a>
                  ) : null}
                  {audioSrc ? (
                    <div style={{ marginTop: 10 }}>
                      {openAudioId === it.id ? (
                        <audio controls autoPlay preload="none" src={audioSrc} style={{ width: '100%' }} />
                      ) : (
                        <button className="btn btn-secondary" onClick={() => setOpenAudioId(it.id)}>
                          {prefs.lang === 'el' ? 'Αναπαραγωγή' : 'Play'}
                        </button>
                      )}
                    </div>
                  ) : null}

                  {videoSrc ? (
                    <div style={{ marginTop: 10 }}>
                      {openVideoId === it.id ? (
                        <video controls autoPlay preload="none" src={videoSrc} style={{ width: '100%' }} />
                      ) : (
                        <button className="btn btn-secondary" onClick={() => setOpenVideoId(it.id)}>
                          {prefs.lang === 'el' ? 'Προβολή' : 'View'}
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
