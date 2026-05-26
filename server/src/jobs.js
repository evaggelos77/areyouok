const {
  listAllEnabledCheckinSchedules,
  markCheckinScheduleLastSent,
  createCheckin,
  getUserById,
  getCircleByOwner,
  ensureCircleForOwner,
  listCircleMembers,
  addSignal,
  listPendingCheckinsForReminders,
  listPendingCheckinsForEscalation,
  markReminderSent,
  markEscalated,
  countCheckinsLastHour,
  listDueSafeWalkSessions,
  bumpSafeWalkNextCheckin,
  endSafeWalkSession,
  logUsageEvent,
  countCheckinSchedulesForUser
} = require('./repo');
const { sendPushToUser } = require('./push');
const { t } = require('./i18n');
const { getEffectiveCheckinsPerHour, getEntitlementsFromUser } = require('./entitlements');

function getLocalParts(ts, timeZone) {
  const d = new Date(ts);
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
  const parts = dtf.formatToParts(d);
  const obj = {};
  for (const p of parts) {
    if (p.type !== 'literal') obj[p.type] = p.value;
  }
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const ymd = `${obj.year}-${obj.month}-${obj.day}`;
  const hhmm = `${obj.hour}:${obj.minute}`;
  const dow = weekdayMap[obj.weekday] ?? 0;
  return { ymd, hhmm, dow };
}

function parseDays(daysOfWeekStr) {
  return new Set(
    String(daysOfWeekStr)
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => Number(x))
  );
}

async function sendCheckinNotification({ user, checkin, kind, logger }) {
  const lang = user.language || 'en';
  const isReminder = kind === 'reminder';
  const payload = {
    title: isReminder ? t(lang, 'checkinReminderTitle') : t(lang, 'checkinTitle'),
    body: isReminder ? t(lang, 'checkinReminderBody') : t(lang, 'checkinBody'),
    url: `/checkin?cid=${checkin.id}`,
    tag: `checkin-${checkin.id}`,
    data: {
      type: 'checkin',
      checkinId: checkin.id,
      url: `/checkin?cid=${checkin.id}`
    },
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

async function notifyCircleMembers({ circleId, excludeUserId, buildPayloadForLang, logger }) {
  const members = listCircleMembers(circleId);
  const targets = members.filter((m) => m.id !== excludeUserId);
  for (const m of targets) {
    const payload = buildPayloadForLang(m.language || 'en');
    await sendPushToUser(m.id, payload, logger);
  }
  return targets.length;
}

async function runScheduleScan(logger) {
  const schedules = listAllEnabledCheckinSchedules();
  const ts = Date.now();
  for (const s of schedules) {
    try {
      const user = getUserById(s.user_id);
      if (!user) continue;
      if (user.snooze_until && user.snooze_until > ts) continue;

      const local = getLocalParts(ts, s.timezone);
      const days = parseDays(s.days_of_week);
      if (!days.has(local.dow)) continue;
      if (local.hhmm !== s.time_hhmm) continue;

      if (s.last_sent_at) {
        const lastLocal = getLocalParts(s.last_sent_at, s.timezone);
        if (lastLocal.ymd === local.ymd) continue;
      }

      const entitlements = getEntitlementsFromUser(user);
      if ((entitlements.limits?.checkin_schedules_limit ?? 0) <= 0) {
        markCheckinScheduleLastSent(s.id, ts);
        continue;
      }

      // Anti-spam: max per hour
      const count = countCheckinsLastHour(user.id);
      const maxPerHour = getEffectiveCheckinsPerHour(user);
      if (count >= maxPerHour) {
        logger.warn({ userId: user.id, count, maxPerHour }, 'Check-in skipped due to max/hour');
        markCheckinScheduleLastSent(s.id, ts); // still mark to avoid repeated firing
        continue;
      }

      const circle = getCircleByOwner(user.id) || ensureCircleForOwner(user.id);
      const checkin = createCheckin({ userId: user.id, circleId: circle?.id, source: 'schedule' });
      logUsageEvent({ userId: user.id, eventType: 'check_sent' });
      await sendCheckinNotification({ user, checkin, kind: 'initial', logger });

      markCheckinScheduleLastSent(s.id, ts);
      logger.info({ scheduleId: s.id, userId: user.id, checkinId: checkin.id }, 'Scheduled check-in sent');
    } catch (e) {
      logger.error({ err: String(e), scheduleId: s.id }, 'Schedule scan error');
    }
  }
}

async function runReminderScan(logger) {
  const due = listPendingCheckinsForReminders();
  for (const c of due) {
    try {
      const user = getUserById(c.user_id);
      if (!user) continue;
      await sendCheckinNotification({ user, checkin: c, kind: 'reminder', logger });
      markReminderSent(c.id);
      logger.info({ checkinId: c.id }, 'Check-in reminder sent');
    } catch (e) {
      logger.error({ err: String(e), checkinId: c.id }, 'Reminder scan error');
    }
  }
}

async function runEscalationScan(logger) {
  const due = listPendingCheckinsForEscalation();
  const ts = Date.now();
  for (const c of due) {
    try {
      const user = getUserById(c.user_id);
      if (!user) continue;
      const circleId = c.circle_id;
      if (!circleId) {
        markEscalated(c.id, { reason: 'no_circle' });
        continue;
      }

      const meta = {
        lastSignalAt: user.last_signal_at ?? null,
        lastBattery: user.last_battery ?? null,
        lastLocation:
          user.last_lat && user.last_lng
            ? { lat: user.last_lat, lng: user.last_lng, accuracy: user.last_accuracy }
            : null
      };

      markEscalated(c.id, meta);

      addSignal({
        circleId,
        userId: user.id,
        type: 'NO_RESPONSE',
        message: 'NO_RESPONSE_CHECKIN',
        lat: meta.lastLocation?.lat,
        lng: meta.lastLocation?.lng,
        accuracy: meta.lastLocation?.accuracy,
        battery: meta.lastBattery,
        meta
      });

      const notifiedCount = await notifyCircleMembers({
        circleId,
        excludeUserId: user.id,
        buildPayloadForLang: (lang) => ({
          title: t(lang, 'circleNoResponseTitle'),
          body: t(lang, 'circleNoResponseBody', { name: user.name || user.email }),
          url: `/circle`,
          tag: `no-response-${c.id}`,
          data: {
            type: 'no_response',
            checkinId: c.id,
            userId: user.id,
            url: '/circle'
          },
          requireInteraction: true
        }),
        logger
      });
      logUsageEvent({ userId: user.id, eventType: 'alert_sent' });
      if (notifiedCount > 0) logUsageEvent({ userId: user.id, eventType: 'trusted_people_notified', value: notifiedCount });

      logger.info({ checkinId: c.id, userId: user.id }, 'Check-in escalated to circle');
    } catch (e) {
      logger.error({ err: String(e), checkinId: c.id }, 'Escalation scan error');
    }
  }
}

async function runSafeWalkScan(logger) {
  const sessions = listDueSafeWalkSessions();
  const ts = Date.now();
  for (const s of sessions) {
    try {
      if (s.status !== 'active') continue;
      if (ts >= s.ends_at) {
        endSafeWalkSession(s.id);
        continue;
      }

      const user = getUserById(s.user_id);
      if (!user) {
        endSafeWalkSession(s.id);
        continue;
      }

      const checkin = createCheckin({ userId: user.id, circleId: s.circle_id, source: 'safewalk' });
      logUsageEvent({ userId: user.id, eventType: 'check_sent' });
      await sendCheckinNotification({ user, checkin, kind: 'initial', logger });

      const next = ts + s.interval_minutes * 60 * 1000;
      bumpSafeWalkNextCheckin(s.id, next);

      logger.info({ sessionId: s.id, checkinId: checkin.id }, 'SafeWalk check-in sent');
    } catch (e) {
      logger.error({ err: String(e), sessionId: s.id }, 'SafeWalk scan error');
    }
  }
}

function startBackgroundJobs(logger) {
  // Run once on start
  runScheduleScan(logger);
  runReminderScan(logger);
  runEscalationScan(logger);
  runSafeWalkScan(logger);

  setInterval(() => runScheduleScan(logger), 20 * 1000);
  setInterval(() => runReminderScan(logger), 15 * 1000);
  setInterval(() => runEscalationScan(logger), 15 * 1000);
  setInterval(() => runSafeWalkScan(logger), 20 * 1000);
}

module.exports = { startBackgroundJobs };
