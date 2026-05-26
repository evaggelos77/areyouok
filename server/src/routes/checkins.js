const express = require('express');

const { requireAuth } = require('../auth');
const {
  createCheckin,
  getCheckinById,
  respondToCheckin,
  ensureCircleForOwner,
  getCircleByOwner,
  addSignal,
  listCircleMembers,
  updateUser,
  listCheckinSchedules,
  createCheckinSchedule,
  updateCheckinScheduleForUser,
  deleteCheckinSchedule,
  countCheckinsLastHour,
  countCheckinSchedulesForUser,
  logUsageEvent
} = require('../repo');
const { sendPushToUser } = require('../push');
const { t } = require('../i18n');
const { getEffectiveCheckinsPerHour } = require('../entitlements');

const checkinsRouter = express.Router();

async function notifyCircle({ circleId, excludeUserId, payloadForLang, logger }) {
  const members = listCircleMembers(circleId);
  const targets = members.filter((m) => m.id !== excludeUserId);
  for (const m of targets) {
    await sendPushToUser(m.id, payloadForLang(m.language || 'en'), logger);
  }
  return targets.length;
}

async function sendCheckinPush({ user, checkin, kind, logger }) {
  const lang = user.language || 'en';
  const isReminder = kind === 'reminder';
  const payload = {
    title: isReminder ? t(lang, 'checkinReminderTitle') : t(lang, 'checkinTitle'),
    body: isReminder ? t(lang, 'checkinReminderBody') : t(lang, 'checkinBody'),
    url: `/checkin?cid=${checkin.id}`,
    tag: `checkin-${checkin.id}`,
    data: { type: 'checkin', checkinId: checkin.id, url: `/checkin?cid=${checkin.id}` },
    actions: [
      { action: 'ok', title: t(lang, 'notifOkAction') },
      { action: 'call_me', title: t(lang, 'notifCallMeAction') },
      { action: 'need_help', title: t(lang, 'notifHelpAction') }
    ],
    actionMap: {
      ok: { endpoint: '/api/checkins/respond', payload: { checkinId: checkin.id, response: 'ok' } },
      call_me: { endpoint: '/api/checkins/respond', payload: { checkinId: checkin.id, response: 'call_me' } },
      need_help: { endpoint: '/api/checkins/respond', payload: { checkinId: checkin.id, response: 'need_help' } }
    },
    requireInteraction: !isReminder
  };
  await sendPushToUser(user.id, payload, logger);
}

checkinsRouter.post('/send-now', requireAuth, async (req, res) => {
  const user = req.user;

  // Anti-spam
  const count = countCheckinsLastHour(user.id);
  const maxPerHour = getEffectiveCheckinsPerHour(user);
  if (count >= maxPerHour) {
    return res.status(429).json({ error: 'MAX_PER_HOUR', maxPerHour, upgradeTo: 'premium' });
  }

  const circle = getCircleByOwner(user.id) || ensureCircleForOwner(user.id);
  const checkin = createCheckin({ userId: user.id, circleId: circle?.id, source: 'manual' });
  logUsageEvent({ userId: user.id, eventType: 'check_sent' });
  await sendCheckinPush({ user, checkin, kind: 'initial', logger: req.log });
  res.json({ ok: true, checkin });
});

checkinsRouter.post('/respond', requireAuth, async (req, res) => {
  const checkinId = Number(req.body?.checkinId);
  const response = String(req.body?.response || '').trim();
  if (!checkinId || !['ok', 'call_me', 'need_help'].includes(response)) {
    return res.status(400).json({ error: 'INVALID_INPUT' });
  }

  const checkin = getCheckinById(checkinId);
  if (!checkin) return res.status(404).json({ error: 'NOT_FOUND' });
  if (checkin.user_id !== req.user.id) {
    return res.status(403).json({ error: 'FORBIDDEN' });
  }

  const updated = respondToCheckin({ id: checkinId, response });

  // Update last signal time
  updateUser(req.user.id, { last_signal_at: Date.now() });

  // Notify circle depending on response
  const circleId = checkin.circle_id;
  if (circleId) {
    if (response === 'ok') {
      const signal = addSignal({
        circleId,
        userId: req.user.id,
        type: 'OK',
        message: 'OK_CHECKIN',
        meta: { via: 'checkin', checkinId }
      });
      const notifiedCount = await notifyCircle({
        circleId,
        excludeUserId: req.user.id,
        payloadForLang: (lang) => ({
          title: t(lang, 'okSignalTitle', { name: req.user.name || req.user.email }),
          body: t(lang, 'okSignalBody'),
          url: '/circle',
          tag: `ok-${signal.id}`,
          data: { type: 'signal', signalType: 'OK', signalId: signal.id, url: '/circle' }
        }),
        logger: req.log
      });
      logUsageEvent({ userId: req.user.id, eventType: 'alert_sent' });
      if (notifiedCount > 0) logUsageEvent({ userId: req.user.id, eventType: 'trusted_people_notified', value: notifiedCount });
    }

    if (response === 'call_me') {
      const signal = addSignal({
        circleId,
        userId: req.user.id,
        type: 'CALL_ME',
        message: 'CALL_ME_CHECKIN',
        meta: { via: 'checkin', checkinId }
      });
      const notifiedCount = await notifyCircle({
        circleId,
        excludeUserId: req.user.id,
        payloadForLang: (lang) => ({
          title: t(lang, 'callMeSignalTitle', { name: req.user.name || req.user.email }),
          body: t(lang, 'callMeSignalBody'),
          url: '/circle',
          tag: `callme-${signal.id}`,
          requireInteraction: true,
          data: { type: 'signal', signalType: 'CALL_ME', signalId: signal.id, url: '/circle' }
        }),
        logger: req.log
      });
      logUsageEvent({ userId: req.user.id, eventType: 'alert_sent' });
      if (notifiedCount > 0) logUsageEvent({ userId: req.user.id, eventType: 'trusted_people_notified', value: notifiedCount });
    }

    if (response === 'need_help') {
      const signal = addSignal({
        circleId,
        userId: req.user.id,
        type: 'NEED_HELP',
        message: 'NEED_HELP_CHECKIN',
        meta: { via: 'checkin', checkinId }
      });
      const notifiedCount = await notifyCircle({
        circleId,
        excludeUserId: req.user.id,
        payloadForLang: (lang) => ({
          title: t(lang, 'needHelpSignalTitle', { name: req.user.name || req.user.email }),
          body: t(lang, 'needHelpSignalBody'),
          url: '/circle',
          tag: `help-${signal.id}`,
          requireInteraction: true,
          data: { type: 'signal', signalType: 'NEED_HELP', signalId: signal.id, url: '/circle' }
        }),
        logger: req.log
      });
      logUsageEvent({ userId: req.user.id, eventType: 'alert_sent' });
      if (notifiedCount > 0) logUsageEvent({ userId: req.user.id, eventType: 'trusted_people_notified', value: notifiedCount });
    }
  }

  res.json({ ok: true, checkin: updated });
});

checkinsRouter.get('/schedules', requireAuth, (req, res) => {
  const schedules = listCheckinSchedules(req.user.id);
  res.json({ schedules });
});

checkinsRouter.post('/schedules', requireAuth, (req, res) => {
  const days = req.body?.daysOfWeek;
  const timeHHMM = String(req.body?.timeHHMM || '').trim();
  const timezone = String(req.body?.timezone || '').trim();
  const limit = req.entitlements?.limits?.checkin_schedules_limit ?? 0;

  if (limit <= 0) {
    return res.status(402).json({ error: 'CHECKIN_SCHEDULES_LOCKED', upgradeTo: 'premium' });
  }

  const existingCount = countCheckinSchedulesForUser(req.user.id);
  if (existingCount >= limit) {
    return res.status(409).json({ error: 'CHECKIN_SCHEDULE_LIMIT_REACHED', limit, upgradeTo: 'premium' });
  }

  if (!Array.isArray(days) || days.length === 0) return res.status(400).json({ error: 'INVALID_DAYS' });
  if (!/^\d{2}:\d{2}$/.test(timeHHMM)) return res.status(400).json({ error: 'INVALID_TIME' });
  if (!timezone) return res.status(400).json({ error: 'INVALID_TIMEZONE' });

  const daysStr = days.map((d) => Number(d)).filter((d) => d >= 0 && d <= 6).join(',');
  const schedule = createCheckinSchedule({ userId: req.user.id, daysOfWeek: daysStr, timeHHMM, timezone });
  res.json({ ok: true, schedule });
});

checkinsRouter.put('/schedules/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const patch = {};
  if (Array.isArray(req.body?.daysOfWeek)) {
    patch.days_of_week = req.body.daysOfWeek.map((d) => Number(d)).filter((d) => d >= 0 && d <= 6).join(',');
  }
  if (typeof req.body?.timeHHMM === 'string' && /^\d{2}:\d{2}$/.test(req.body.timeHHMM)) {
    patch.time_hhmm = req.body.timeHHMM;
  }
  if (typeof req.body?.timezone === 'string' && req.body.timezone) {
    patch.timezone = req.body.timezone;
  }
  if (typeof req.body?.enabled === 'boolean') {
    patch.enabled = req.body.enabled ? 1 : 0;
  }
  const schedule = updateCheckinScheduleForUser(id, req.user.id, patch);
  if (!schedule || schedule.user_id !== req.user.id) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json({ ok: true, schedule });
});

checkinsRouter.delete('/schedules/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  deleteCheckinSchedule(id, req.user.id);
  res.json({ ok: true });
});

module.exports = { checkinsRouter };
