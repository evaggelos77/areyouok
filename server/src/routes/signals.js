const express = require('express');
const { requireAuth } = require('../auth');
const {
  ensureCircleForOwner,
  getCircleByOwner,
  listCircleMembers,
  addSignal,
  updateUser,
  addAudioClip,
  getAudioClipById,
  addVideoClip,
  getVideoClipById,
  isUserInCircle,
  logUsageEvent
} = require('../repo');
const { sendPushToUser } = require('../push');
const { t } = require('../i18n');
const { isVoiceKeywordsEnabled } = require('../entitlements');

const signalsRouter = express.Router();

async function notifyCircle({ circleId, excludeUserId, payloadForLang, logger }) {
  const members = listCircleMembers(circleId);
  const targets = members.filter((m) => m.id !== excludeUserId);
  for (const m of targets) {
    await sendPushToUser(m.id, payloadForLang(m.language || 'en'), logger);
  }
  return targets.length;
}

async function notifyAndTrack({ userId, ...rest }) {
  const notifiedCount = await notifyCircle(rest);
  logUsageEvent({ userId, eventType: 'alert_sent' });
  if (notifiedCount > 0) {
    logUsageEvent({ userId, eventType: 'trusted_people_notified', value: notifiedCount });
  }
  return notifiedCount;
}

function extractLocation(body) {
  const lat = typeof body?.lat === 'number' ? body.lat : null;
  const lng = typeof body?.lng === 'number' ? body.lng : null;
  const accuracy = typeof body?.accuracy === 'number' ? body.accuracy : null;
  if (lat === null || lng === null) return null;
  return { lat, lng, accuracy };
}

signalsRouter.post('/ok', requireAuth, async (req, res) => {
  const user = req.user;
  const circle = getCircleByOwner(user.id) || ensureCircleForOwner(user.id);

  const battery = typeof req.body?.battery === 'number' ? req.body.battery : null;
  // OK does NOT include location by default (privacy-first)

  updateUser(user.id, {
    last_signal_at: Date.now(),
    ...(battery !== null ? { last_battery: battery } : {})
  });

  const signal = addSignal({ circleId: circle.id, userId: user.id, type: 'OK', message: 'OK', battery });

  await notifyAndTrack({
    userId: user.id,
    circleId: circle.id,
    excludeUserId: user.id,
    payloadForLang: (lang) => ({
      title: t(lang, 'okSignalTitle', { name: user.name || user.email }),
      body: t(lang, 'okSignalBody'),
      url: '/circle',
      tag: `ok-${signal.id}`,
      data: { type: 'signal', signalType: 'OK', signalId: signal.id, url: '/circle' }
    }),
    logger: req.log
  });

  res.json({ ok: true, signal });
});

signalsRouter.post('/call-me', requireAuth, async (req, res) => {
  const user = req.user;
  const circle = getCircleByOwner(user.id) || ensureCircleForOwner(user.id);

  const battery = typeof req.body?.battery === 'number' ? req.body.battery : null;

  updateUser(user.id, {
    last_signal_at: Date.now(),
    ...(battery !== null ? { last_battery: battery } : {})
  });

  const signal = addSignal({ circleId: circle.id, userId: user.id, type: 'CALL_ME', message: 'CALL_ME', battery });

  await notifyAndTrack({
    userId: user.id,
    circleId: circle.id,
    excludeUserId: user.id,
    payloadForLang: (lang) => ({
      title: t(lang, 'callMeSignalTitle', { name: user.name || user.email }),
      body: t(lang, 'callMeSignalBody'),
      url: '/circle',
      tag: `callme-${signal.id}`,
      requireInteraction: true,
      data: { type: 'signal', signalType: 'CALL_ME', signalId: signal.id, url: '/circle' }
    }),
    logger: req.log
  });

  res.json({ ok: true, signal });
});

signalsRouter.post('/need-help', requireAuth, async (req, res) => {
  const user = req.user;
  const circle = getCircleByOwner(user.id) || ensureCircleForOwner(user.id);

  const battery = typeof req.body?.battery === 'number' ? req.body.battery : null;
  const loc = extractLocation(req.body);

  updateUser(user.id, {
    last_signal_at: Date.now(),
    ...(battery !== null ? { last_battery: battery } : {}),
    ...(loc ? { last_lat: loc.lat, last_lng: loc.lng, last_accuracy: loc.accuracy } : {})
  });

  const signal = addSignal({
    circleId: circle.id,
    userId: user.id,
    type: 'NEED_HELP',
    message: 'NEED_HELP',
    battery,
    lat: loc?.lat,
    lng: loc?.lng,
    accuracy: loc?.accuracy,
    meta: { via: 'manual' }
  });

  await notifyAndTrack({
    userId: user.id,
    circleId: circle.id,
    excludeUserId: user.id,
    payloadForLang: (lang) => ({
      title: t(lang, 'needHelpSignalTitle', { name: user.name || user.email }),
      body: t(lang, 'needHelpSignalBody'),
      url: '/circle',
      tag: `help-${signal.id}`,
      requireInteraction: true,
      data: { type: 'signal', signalType: 'NEED_HELP', signalId: signal.id, url: '/circle' }
    }),
    logger: req.log
  });

  res.json({ ok: true, signal });
});


signalsRouter.post('/voice-help', requireAuth, async (req, res) => {
  const user = req.user;
  if (!isVoiceKeywordsEnabled(user)) {
    return res.status(402).json({ error: 'YEARLY_REQUIRED', upgradeTo: 'yearly' });
  }

  const circle = getCircleByOwner(user.id) || ensureCircleForOwner(user.id);

  const battery = typeof req.body?.battery === 'number' ? req.body.battery : null;
  const loc = extractLocation(req.body);
  const keywordRaw = String(req.body?.keyword || '').trim();
  const keyword = keywordRaw ? keywordRaw.slice(0, 120) : null;

  updateUser(user.id, {
    last_signal_at: Date.now(),
    ...(battery !== null ? { last_battery: battery } : {}),
    ...(loc ? { last_lat: loc.lat, last_lng: loc.lng, last_accuracy: loc.accuracy } : {})
  });

  const signal = addSignal({
    circleId: circle.id,
    userId: user.id,
    type: 'VOICE_HELP',
    message: keyword ? `VOICE_HELP:${keyword}` : 'VOICE_HELP',
    battery,
    lat: loc?.lat,
    lng: loc?.lng,
    accuracy: loc?.accuracy,
    meta: { via: 'voice_keywords', ...(keyword ? { keyword } : {}) }
  });

  await notifyAndTrack({
    userId: user.id,
    circleId: circle.id,
    excludeUserId: user.id,
    payloadForLang: (lang) => ({
      title: t(lang, 'voiceHelpSignalTitle', { name: user.name || user.email }),
      body: t(lang, 'voiceHelpSignalBody'),
      url: '/circle',
      tag: `voice-help-${signal.id}`,
      requireInteraction: true,
      data: { type: 'signal', signalType: 'VOICE_HELP', signalId: signal.id, url: '/circle' }
    }),
    logger: req.log
  });

  res.json({ ok: true, signal });
});

signalsRouter.post('/pick-me-up', requireAuth, async (req, res) => {
  const user = req.user;
  const circle = getCircleByOwner(user.id) || ensureCircleForOwner(user.id);

  const battery = typeof req.body?.battery === 'number' ? req.body.battery : null;
  const loc = extractLocation(req.body);

  updateUser(user.id, {
    last_signal_at: Date.now(),
    ...(battery !== null ? { last_battery: battery } : {}),
    ...(loc ? { last_lat: loc.lat, last_lng: loc.lng, last_accuracy: loc.accuracy } : {})
  });

  const signal = addSignal({
    circleId: circle.id,
    userId: user.id,
    type: 'PICK_ME_UP',
    message: 'PICK_ME_UP',
    battery,
    lat: loc?.lat,
    lng: loc?.lng,
    accuracy: loc?.accuracy
  });

  await notifyAndTrack({
    userId: user.id,
    circleId: circle.id,
    excludeUserId: user.id,
    payloadForLang: (lang) => ({
      title: t(lang, 'pickMeUpSignalTitle', { name: user.name || user.email }),
      body: t(lang, 'pickMeUpSignalBody'),
      url: '/circle',
      tag: `pickup-${signal.id}`,
      requireInteraction: true,
      data: { type: 'signal', signalType: 'PICK_ME_UP', signalId: signal.id, url: '/circle' }
    }),
    logger: req.log
  });

  res.json({ ok: true, signal });
});

signalsRouter.post('/sos', requireAuth, async (req, res) => {
  const user = req.user;
  const circle = getCircleByOwner(user.id) || ensureCircleForOwner(user.id);

  const number = String(req.body?.number || '').trim();
  const sendLocation = Boolean(req.body?.sendLocation);
  const battery = typeof req.body?.battery === 'number' ? req.body.battery : null;
  const loc = sendLocation ? extractLocation(req.body) : null;

  updateUser(user.id, {
    last_signal_at: Date.now(),
    ...(battery !== null ? { last_battery: battery } : {}),
    ...(loc ? { last_lat: loc.lat, last_lng: loc.lng, last_accuracy: loc.accuracy } : {})
  });

  const signal = addSignal({
    circleId: circle.id,
    userId: user.id,
    type: 'SOS',
    message: `SOS:${number}`,
    battery,
    lat: loc?.lat,
    lng: loc?.lng,
    accuracy: loc?.accuracy,
    meta: { number, sendLocation }
  });

  await notifyAndTrack({
    userId: user.id,
    circleId: circle.id,
    excludeUserId: user.id,
    payloadForLang: (lang) => ({
      title: t(lang, 'sosSignalTitle', { name: user.name || user.email }),
      body: sendLocation ? t(lang, 'sosSignalBodyWithLocation') : t(lang, 'sosSignalBodyNoLocation'),
      url: '/circle',
      tag: `sos-${signal.id}`,
      requireInteraction: true,
      data: { type: 'signal', signalType: 'SOS', signalId: signal.id, url: '/circle' }
    }),
    logger: req.log
  });

  res.json({ ok: true, signal });
});

signalsRouter.post('/bullying-alert', requireAuth, async (req, res) => {
  const user = req.user;
  const circle = getCircleByOwner(user.id) || ensureCircleForOwner(user.id);

  const battery = typeof req.body?.battery === 'number' ? req.body.battery : null;

  updateUser(user.id, {
    last_signal_at: Date.now(),
    ...(battery !== null ? { last_battery: battery } : {})
  });

  // Store the message as requested, but keep push localized.
  const message = 'Bullying alert — Χρειάζομαι βοήθεια τώρα.';
  const signal = addSignal({
    circleId: circle.id,
    userId: user.id,
    type: 'bullying_alert',
    message,
    battery
  });

  await notifyAndTrack({
    userId: user.id,
    circleId: circle.id,
    excludeUserId: user.id,
    payloadForLang: (lang) => ({
      title: lang === 'el' ? 'SOS Εκφοβισμού' : 'Bullying SOS',
      body:
        lang === 'el'
          ? `${user.name || user.email} — Χρειάζομαι βοήθεια τώρα.`
          : `${user.name || user.email} — Bullying alert: I need help now.`,
      url: '/circle',
      tag: `bullying-${signal.id}`,
      requireInteraction: true,
      data: { type: 'signal', signalType: 'bullying_alert', signalId: signal.id, url: '/circle' }
    }),
    logger: req.log
  });

  res.json({ ok: true, signal });
});



// SOS recorded audio message (separate endpoint so the existing SOS and generic audio flows stay untouched)
signalsRouter.post(
  '/sos-audio-clip',
  requireAuth,
  express.raw({ type: () => true, limit: '10mb' }),
  async (req, res) => {
    const user = req.user;
    const circle = getCircleByOwner(user.id) || ensureCircleForOwner(user.id);

    const buf = Buffer.isBuffer(req.body) ? req.body : null;
    if (!buf || buf.length < 256) return res.status(400).json({ error: 'NO_AUDIO' });

    const ct = String(req.headers['content-type'] || 'application/octet-stream');
    const mimeType = ct.split(';')[0].trim() || 'application/octet-stream';
    if (!(mimeType.startsWith('audio/') || mimeType === 'application/octet-stream')) {
      return res.status(400).json({ error: 'INVALID_AUDIO_TYPE' });
    }

    const durationMsRaw = Number(req.headers['x-audio-duration-ms']);
    const durationMs = Number.isFinite(durationMsRaw) ? Math.max(0, Math.round(durationMsRaw)) : null;

    const batteryRaw = Number(req.headers['x-battery']);
    const battery = Number.isFinite(batteryRaw) ? batteryRaw : null;

    const parentSignalIdRaw = Number(req.headers['x-sos-signal-id']);
    const parentSignalId = Number.isFinite(parentSignalIdRaw) && parentSignalIdRaw > 0 ? Math.round(parentSignalIdRaw) : null;

    const emergencyNumberRaw = String(req.headers['x-emergency-number'] || '').trim();
    const emergencyNumber = /^\d{2,6}$/.test(emergencyNumberRaw) ? emergencyNumberRaw : null;

    updateUser(user.id, {
      last_signal_at: Date.now(),
      ...(battery !== null ? { last_battery: battery } : {})
    });

    const clip = addAudioClip({
      circleId: circle.id,
      userId: user.id,
      mimeType,
      data: buf,
      durationMs
    });

    const signal = addSignal({
      circleId: circle.id,
      userId: user.id,
      type: 'sos_audio_clip',
      message: emergencyNumber ? `SOS_AUDIO:${emergencyNumber}` : 'SOS_AUDIO',
      battery,
      meta: {
        clipId: clip.id,
        mimeType,
        durationMs,
        ...(parentSignalId ? { parentSignalId } : {}),
        ...(emergencyNumber ? { emergencyNumber } : {})
      }
    });

    await notifyAndTrack({
    userId: user.id,
      circleId: circle.id,
      excludeUserId: user.id,
      payloadForLang: (lang) => ({
        title: lang === 'el' ? 'Ηχητικό μήνυμα SOS' : 'SOS audio message',
        body:
          lang === 'el'
            ? `${user.name || user.email} έστειλε ηχητικό μήνυμα SOS.`
            : `${user.name || user.email} sent an SOS audio message.`,
        url: '/circle',
        tag: `sos-audio-${signal.id}`,
        requireInteraction: true,
        data: { type: 'signal', signalType: 'sos_audio_clip', signalId: signal.id, url: '/circle' }
      }),
      logger: req.log
    });

    res.json({ ok: true, signal, clipId: clip.id });
  }
);

// MVP: audio clip signal
signalsRouter.post(
  '/audio-clip',
  requireAuth,
  express.raw({ type: () => true, limit: '10mb' }),
  async (req, res) => {
    const user = req.user;
    const circle = getCircleByOwner(user.id) || ensureCircleForOwner(user.id);

    const buf = Buffer.isBuffer(req.body) ? req.body : null;
    if (!buf || buf.length === 0) return res.status(400).json({ error: 'NO_AUDIO' });

    const ct = String(req.headers['content-type'] || 'application/octet-stream');
    const mimeType = ct.split(';')[0].trim() || 'application/octet-stream';
    if (!(mimeType.startsWith('audio/') || mimeType === 'application/octet-stream')) {
      return res.status(400).json({ error: 'INVALID_AUDIO_TYPE' });
    }

    const durationMsRaw = Number(req.headers['x-audio-duration-ms']);
    const durationMs = Number.isFinite(durationMsRaw) ? Math.max(0, Math.round(durationMsRaw)) : null;

    const batteryRaw = Number(req.headers['x-battery']);
    const battery = Number.isFinite(batteryRaw) ? batteryRaw : null;

    updateUser(user.id, {
      last_signal_at: Date.now(),
      ...(battery !== null ? { last_battery: battery } : {})
    });

    const clip = addAudioClip({
      circleId: circle.id,
      userId: user.id,
      mimeType,
      data: buf,
      durationMs
    });

    const signal = addSignal({
      circleId: circle.id,
      userId: user.id,
      type: 'audio_clip',
      message: null,
      battery,
      meta: { clipId: clip.id, mimeType, durationMs }
    });

    await notifyAndTrack({
    userId: user.id,
      circleId: circle.id,
      excludeUserId: user.id,
      payloadForLang: (lang) => ({
        title: lang === 'el' ? 'Νέα ηχογράφηση' : 'New recording',
        body:
          lang === 'el'
            ? `${user.name || user.email} έστειλε ηχογράφηση.`
            : `${user.name || user.email} sent a recording.`,
        url: '/circle',
        tag: `audio-${signal.id}`,
        requireInteraction: true,
        data: { type: 'signal', signalType: 'audio_clip', signalId: signal.id, url: '/circle' }
      }),
      logger: req.log
    });

    res.json({ ok: true, signal, clipId: clip.id });
  }
);

// Bullying evidence: audio clip (separate endpoint to keep existing audio flow untouched)
signalsRouter.post(
  '/bullying-audio-clip',
  requireAuth,
  express.raw({ type: () => true, limit: '10mb' }),
  async (req, res) => {
    const user = req.user;
    const circle = getCircleByOwner(user.id) || ensureCircleForOwner(user.id);

    const buf = Buffer.isBuffer(req.body) ? req.body : null;
    if (!buf || buf.length < 256) return res.status(400).json({ error: 'NO_AUDIO' });

    const ct = String(req.headers['content-type'] || 'application/octet-stream');
    const mimeType = ct.split(';')[0].trim() || 'application/octet-stream';
    if (!(mimeType.startsWith('audio/') || mimeType === 'application/octet-stream')) {
      return res.status(400).json({ error: 'INVALID_AUDIO_TYPE' });
    }

    const durationMsRaw = Number(req.headers['x-audio-duration-ms']);
    const durationMs = Number.isFinite(durationMsRaw) ? Math.max(0, Math.round(durationMsRaw)) : null;

    const batteryRaw = Number(req.headers['x-battery']);
    const battery = Number.isFinite(batteryRaw) ? batteryRaw : null;

    const eventIdRaw = Number(req.headers['x-bullying-event-id']);
    const eventId = Number.isFinite(eventIdRaw) && eventIdRaw > 0 ? Math.round(eventIdRaw) : null;

    updateUser(user.id, {
      last_signal_at: Date.now(),
      ...(battery !== null ? { last_battery: battery } : {})
    });

    const clip = addAudioClip({
      circleId: circle.id,
      userId: user.id,
      mimeType,
      data: buf,
      durationMs
    });

    const signal = addSignal({
      circleId: circle.id,
      userId: user.id,
      type: 'bullying_audio_clip',
      message: null,
      battery,
      meta: { clipId: clip.id, mimeType, durationMs, ...(eventId ? { eventId } : {}) }
    });

    await notifyAndTrack({
    userId: user.id,
      circleId: circle.id,
      excludeUserId: user.id,
      payloadForLang: (lang) => ({
        title: lang === 'el' ? 'Αποδεικτικό ήχου' : 'Audio evidence',
        body:
          lang === 'el'
            ? `${user.name || user.email} έστειλε αποδεικτικό ήχου.`
            : `${user.name || user.email} sent audio evidence.`,
        url: '/circle',
        tag: `bullying-audio-${signal.id}`,
        data: { type: 'signal', signalType: 'bullying_audio_clip', signalId: signal.id, url: '/circle' }
      }),
      logger: req.log
    });

    res.json({ ok: true, signal, clipId: clip.id });
  }
);

// Bullying evidence: video clip
signalsRouter.post(
  '/bullying-video-clip',
  requireAuth,
  express.raw({ type: () => true, limit: '25mb' }),
  async (req, res) => {
    const user = req.user;
    const circle = getCircleByOwner(user.id) || ensureCircleForOwner(user.id);

    const buf = Buffer.isBuffer(req.body) ? req.body : null;
    if (!buf || buf.length < 1024) return res.status(400).json({ error: 'NO_VIDEO' });

    const ct = String(req.headers['content-type'] || 'application/octet-stream');
    const mimeType = ct.split(';')[0].trim() || 'application/octet-stream';
    if (!(mimeType.startsWith('video/') || mimeType === 'application/octet-stream')) {
      return res.status(400).json({ error: 'INVALID_VIDEO_TYPE' });
    }

    const durationMsRaw = Number(req.headers['x-video-duration-ms']);
    const durationMs = Number.isFinite(durationMsRaw) ? Math.max(0, Math.round(durationMsRaw)) : null;

    const batteryRaw = Number(req.headers['x-battery']);
    const battery = Number.isFinite(batteryRaw) ? batteryRaw : null;

    const eventIdRaw = Number(req.headers['x-bullying-event-id']);
    const eventId = Number.isFinite(eventIdRaw) && eventIdRaw > 0 ? Math.round(eventIdRaw) : null;

    updateUser(user.id, {
      last_signal_at: Date.now(),
      ...(battery !== null ? { last_battery: battery } : {})
    });

    const clip = addVideoClip({
      circleId: circle.id,
      userId: user.id,
      mimeType,
      data: buf,
      durationMs
    });

    const signal = addSignal({
      circleId: circle.id,
      userId: user.id,
      type: 'bullying_video_clip',
      message: null,
      battery,
      meta: { clipId: clip.id, mimeType, durationMs, ...(eventId ? { eventId } : {}) }
    });

    await notifyAndTrack({
    userId: user.id,
      circleId: circle.id,
      excludeUserId: user.id,
      payloadForLang: (lang) => ({
        title: lang === 'el' ? 'Αποδεικτικό βίντεο' : 'Video evidence',
        body:
          lang === 'el'
            ? `${user.name || user.email} έστειλε αποδεικτικό βίντεο.`
            : `${user.name || user.email} sent video evidence.`,
        url: '/circle',
        tag: `bullying-video-${signal.id}`,
        data: { type: 'signal', signalType: 'bullying_video_clip', signalId: signal.id, url: '/circle' }
      }),
      logger: req.log
    });

    res.json({ ok: true, signal, clipId: clip.id });
  }
);

signalsRouter.get('/audio-clip/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'INVALID_ID' });
  const clip = getAudioClipById(id);
  if (!clip) return res.status(404).json({ error: 'NOT_FOUND' });
  if (!clip.circle_id) return res.status(404).json({ error: 'NOT_FOUND' });
  const ok = isUserInCircle(req.user.id, clip.circle_id);
  if (!ok) return res.status(403).json({ error: 'FORBIDDEN' });

  const data = clip.data;
  const mimeType = clip.mime_type || 'application/octet-stream';
  const total = data.length;

  res.setHeader('Accept-Ranges', 'bytes');

  const range = req.headers.range;
  if (range) {
    const m = String(range).match(/bytes=(\d+)-(\d+)?/);
    if (m) {
      const start = Number(m[1]);
      const end = m[2] ? Number(m[2]) : total - 1;
      if (!Number.isFinite(start) || start < 0 || start >= total) {
        res.status(416).setHeader('Content-Range', `bytes */${total}`);
        return res.end();
      }
      const safeEnd = Number.isFinite(end) ? Math.min(end, total - 1) : total - 1;
      const chunk = data.slice(start, safeEnd + 1);
      res.status(206);
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Range', `bytes ${start}-${safeEnd}/${total}`);
      res.setHeader('Content-Length', chunk.length);
      return res.end(chunk);
    }
  }

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Length', total);
  res.end(data);
});

signalsRouter.get('/video-clip/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'INVALID_ID' });
  const clip = getVideoClipById(id);
  if (!clip) return res.status(404).json({ error: 'NOT_FOUND' });
  if (!clip.circle_id) return res.status(404).json({ error: 'NOT_FOUND' });
  const ok = isUserInCircle(req.user.id, clip.circle_id);
  if (!ok) return res.status(403).json({ error: 'FORBIDDEN' });

  const data = clip.data;
  const mimeType = clip.mime_type || 'application/octet-stream';
  const total = data.length;

  res.setHeader('Accept-Ranges', 'bytes');

  const range = req.headers.range;
  if (range) {
    const m = String(range).match(/bytes=(\d+)-(\d+)?/);
    if (m) {
      const start = Number(m[1]);
      const end = m[2] ? Number(m[2]) : total - 1;
      if (!Number.isFinite(start) || start < 0 || start >= total) {
        res.status(416).setHeader('Content-Range', `bytes */${total}`);
        return res.end();
      }
      const safeEnd = Number.isFinite(end) ? Math.min(end, total - 1) : total - 1;
      const chunk = data.slice(start, safeEnd + 1);
      res.status(206);
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Range', `bytes ${start}-${safeEnd}/${total}`);
      res.setHeader('Content-Length', chunk.length);
      return res.end(chunk);
    }
  }

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Length', total);
  res.end(data);
});

signalsRouter.post('/location', requireAuth, (req, res) => {
  const user = req.user;
  const loc = extractLocation(req.body);
  const battery = typeof req.body?.battery === 'number' ? req.body.battery : null;
  if (!loc) return res.status(400).json({ error: 'NO_LOCATION' });

  updateUser(user.id, {
    ...(battery !== null ? { last_battery: battery } : {}),
    last_lat: loc.lat,
    last_lng: loc.lng,
    last_accuracy: loc.accuracy
  });

  res.json({ ok: true });
});

module.exports = { signalsRouter };
