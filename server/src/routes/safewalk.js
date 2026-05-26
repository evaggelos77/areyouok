const express = require('express');
const { requireAuth } = require('../auth');
const {
  createSafeWalkSession,
  getActiveSafeWalkSession,
  endSafeWalkSession,
  ensureCircleForOwner,
  getCircleByOwner,
  addSignal,
  listCircleMembers,
  updateUser,
  countSafeWalkSessionsLast24h,
  logUsageEvent
} = require('../repo');
const { sendPushToUser } = require('../push');
const { getEntitlementsFromUser } = require('../entitlements');

const safewalkRouter = express.Router();

function extractLocation(body) {
  const lat = typeof body?.lat === 'number' ? body.lat : null;
  const lng = typeof body?.lng === 'number' ? body.lng : null;
  const accuracy = typeof body?.accuracy === 'number' ? body.accuracy : null;
  if (lat === null || lng === null) return null;
  return { lat, lng, accuracy };
}

async function notifyCircle({ circleId, excludeUserId, payloadForLang, logger }) {
  const members = listCircleMembers(circleId);
  const targets = members.filter((m) => m.id !== excludeUserId);
  for (const m of targets) {
    await sendPushToUser(m.id, payloadForLang(m.language || 'en'), logger);
  }
  return targets.length;
}

safewalkRouter.get('/active', requireAuth, (req, res) => {
  const session = getActiveSafeWalkSession(req.user.id);
  res.json({ session });
});

safewalkRouter.post('/start', requireAuth, async (req, res) => {
  const durationMinutes = Number(req.body?.durationMinutes);
  const intervalMinutes = Number(req.body?.intervalMinutes);

  const dur = [10, 15, 20, 30].includes(durationMinutes) ? durationMinutes : 10;
  const interval = [5, 10].includes(intervalMinutes) ? intervalMinutes : 10;

  const entitlements = req.entitlements || getEntitlementsFromUser(req.user);
  const limit = entitlements.limits?.safewalk_limit ?? 2;
  const usedToday = countSafeWalkSessionsLast24h(req.user.id);
  if (usedToday >= limit) {
    return res.status(402).json({ error: 'SAFEWALK_LIMIT_REACHED', limit, usedToday, upgradeTo: 'premium' });
  }

  const existing = getActiveSafeWalkSession(req.user.id);
  if (existing) endSafeWalkSession(existing.id);

  const circle = getCircleByOwner(req.user.id) || ensureCircleForOwner(req.user.id);

  const battery = typeof req.body?.battery === 'number' ? req.body.battery : null;
  const loc = extractLocation(req.body);

  // SafeWalk start updates last known location (privacy-first: allowed)
  updateUser(req.user.id, {
    last_signal_at: Date.now(),
    ...(battery !== null ? { last_battery: battery } : {}),
    ...(loc ? { last_lat: loc.lat, last_lng: loc.lng, last_accuracy: loc.accuracy } : {})
  });

  const session = createSafeWalkSession({
    userId: req.user.id,
    circleId: circle?.id,
    durationMinutes: dur,
    intervalMinutes: interval
  });
  logUsageEvent({ userId: req.user.id, eventType: 'safewalk_started' });

  // Optional: notify circle that SafeWalk started
  const signal = addSignal({
    circleId: circle.id,
    userId: req.user.id,
    type: 'SAFEWALK_START',
    message: `SAFEWALK_START:${dur}:${interval}`,
    battery,
    lat: loc?.lat,
    lng: loc?.lng,
    accuracy: loc?.accuracy,
    meta: { durationMinutes: dur, intervalMinutes: interval }
  });

  const notifiedCount = await notifyCircle({
    circleId: circle.id,
    excludeUserId: req.user.id,
    payloadForLang: (lang) => ({
      title: lang === 'el' ? `SafeWalk: Ξεκίνησε` : 'SafeWalk: Started',
      body:
        lang === 'el'
          ? `${req.user.name || req.user.email} ξεκίνησε SafeWalk (${dur}′).`
          : `${req.user.name || req.user.email} started SafeWalk (${dur}m).`,
      url: '/circle',
      tag: `safewalk-start-${signal.id}`,
      data: { type: 'signal', signalType: 'SAFEWALK_START', signalId: signal.id, url: '/circle' }
    }),
    logger: req.log
  });
  logUsageEvent({ userId: req.user.id, eventType: 'alert_sent' });
  if (notifiedCount > 0) logUsageEvent({ userId: req.user.id, eventType: 'trusted_people_notified', value: notifiedCount });

  res.json({ ok: true, session, usedToday: usedToday + 1, limit });
});

safewalkRouter.post('/stop', requireAuth, (req, res) => {
  const existing = getActiveSafeWalkSession(req.user.id);
  if (existing) endSafeWalkSession(existing.id);
  res.json({ ok: true });
});

module.exports = { safewalkRouter };
