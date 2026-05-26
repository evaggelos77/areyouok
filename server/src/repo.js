const { getDb } = require('./db');

function now() {
  return Date.now();
}

function createUserIfNotExists(email) {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (existing) return existing;
  const ts = now();
  const info = db
    .prepare(
      `INSERT INTO users (email, created_at, updated_at)
       VALUES (?, ?, ?)`
    )
    .run(email, ts, ts);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
}

function getUserByEmail(email) {
  return getDb().prepare('SELECT * FROM users WHERE email = ?').get(email);
}

function getUserById(id) {
  return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function getUserByStripeCustomerId(customerId) {
  return getDb().prepare('SELECT * FROM users WHERE stripe_customer_id = ?').get(customerId);
}

function getUserByStripeSubscriptionId(subId) {
  return getDb().prepare('SELECT * FROM users WHERE stripe_subscription_id = ?').get(subId);
}

function updateUser(id, patch) {
  const db = getDb();
  const fields = Object.keys(patch);
  if (fields.length === 0) return getUserById(id);
  const sets = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => patch[f]);
  values.push(now());
  values.push(id);
  db.prepare(`UPDATE users SET ${sets}, updated_at = ? WHERE id = ?`).run(...values);
  return getUserById(id);
}

// Circle helpers
function getCircleByOwner(ownerUserId) {
  return getDb().prepare('SELECT * FROM circles WHERE owner_user_id = ?').get(ownerUserId);
}

function getCircleById(id) {
  return getDb().prepare('SELECT * FROM circles WHERE id = ?').get(id);
}

function listCirclesForUser(userId) {
  const db = getDb();
  return db
    .prepare(
      `SELECT c.*
       FROM circle_members cm
       JOIN circles c ON c.id = cm.circle_id
       WHERE cm.user_id = ?
       ORDER BY c.created_at DESC`
    )
    .all(userId);
}

function ensureCircleForOwner(ownerUserId) {
  const db = getDb();
  const existing = getCircleByOwner(ownerUserId);
  if (existing) return existing;
  const ts = now();
  const info = db
    .prepare('INSERT INTO circles (owner_user_id, created_at) VALUES (?, ?)')
    .run(ownerUserId, ts);
  // owner is also a member
  db.prepare('INSERT OR IGNORE INTO circle_members (circle_id, user_id, created_at) VALUES (?, ?, ?)').run(
    info.lastInsertRowid,
    ownerUserId,
    ts
  );
  return getCircleById(info.lastInsertRowid);
}

function listCircleMembers(circleId) {
  const db = getDb();
  return db
    .prepare(
      `SELECT u.id, u.email, u.name, u.avatar, u.phone, u.role, u.language
       FROM circle_members cm
       JOIN users u ON u.id = cm.user_id
       WHERE cm.circle_id = ?
       ORDER BY cm.created_at ASC`
    )
    .all(circleId);
}

function countCircleMembers(circleId) {
  const db = getDb();
  return db.prepare('SELECT COUNT(*) as c FROM circle_members WHERE circle_id = ?').get(circleId).c;
}

function addMemberToCircle(circleId, userId, limit = 5) {
  const db = getDb();
  const ts = now();
  const count = countCircleMembers(circleId);
  if (count >= limit) {
    const err = new Error('CIRCLE_LIMIT_REACHED');
    err.code = 'CIRCLE_LIMIT_REACHED';
    err.limit = limit;
    throw err;
  }
  db.prepare('INSERT OR IGNORE INTO circle_members (circle_id, user_id, created_at) VALUES (?, ?, ?)').run(
    circleId,
    userId,
    ts
  );
}

function removeMemberFromCircle(circleId, userId) {
  const db = getDb();
  db.prepare('DELETE FROM circle_members WHERE circle_id = ? AND user_id = ?').run(circleId, userId);
}

function createInvite(circleId, token, expiresAt) {
  const db = getDb();
  const ts = now();
  db.prepare('INSERT INTO invites (circle_id, token, expires_at, created_at) VALUES (?, ?, ?, ?)').run(
    circleId,
    token,
    expiresAt ?? null,
    ts
  );
}

function getInviteByToken(token) {
  return getDb().prepare('SELECT * FROM invites WHERE token = ?').get(token);
}

// Push subscriptions
function upsertPushSubscription(userId, sub) {
  const db = getDb();
  const ts = now();
  db.prepare(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, data_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, endpoint)
     DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, data_json = excluded.data_json`
  ).run(userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth, JSON.stringify(sub), ts);
}

function deletePushSubscription(userId, endpoint) {
  const db = getDb();
  db.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?').run(userId, endpoint);
}

function listPushSubscriptions(userId) {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(userId);
  return rows.map((r) => ({ ...r, data: r.data_json ? JSON.parse(r.data_json) : null }));
}

// Signals
function addSignal({ circleId, userId, type, message, lat, lng, accuracy, battery, meta }) {
  const db = getDb();
  const ts = now();
  const info = db
    .prepare(
      `INSERT INTO signals (circle_id, user_id, type, message, created_at, lat, lng, accuracy, battery, meta_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      circleId ?? null,
      userId,
      type,
      message ?? null,
      ts,
      lat ?? null,
      lng ?? null,
      accuracy ?? null,
      battery ?? null,
      meta ? JSON.stringify(meta) : null
    );
  return db.prepare('SELECT * FROM signals WHERE id = ?').get(info.lastInsertRowid);
}

function listSignalsForCircle(circleId, limit = 50) {
  const db = getDb();
  return db
    .prepare(
      `SELECT s.*, u.name, u.email, u.avatar
       FROM signals s
       JOIN users u ON u.id = s.user_id
       WHERE s.circle_id = ?
       ORDER BY s.created_at DESC
       LIMIT ?`
    )
    .all(circleId, limit);
}

// Audio clips
function addAudioClip({ circleId, userId, mimeType, data, durationMs }) {
  const db = getDb();
  const ts = now();
  const info = db
    .prepare(
      `INSERT INTO audio_clips (circle_id, user_id, mime_type, data, duration_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(circleId ?? null, userId, mimeType, data, durationMs ?? null, ts);
  return db.prepare('SELECT * FROM audio_clips WHERE id = ?').get(info.lastInsertRowid);
}

function getAudioClipById(id) {
  return getDb().prepare('SELECT * FROM audio_clips WHERE id = ?').get(id);
}

// Video clips
function addVideoClip({ circleId, userId, mimeType, data, durationMs }) {
  const db = getDb();
  const ts = now();
  const info = db
    .prepare(
      `INSERT INTO video_clips (circle_id, user_id, mime_type, data, duration_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(circleId ?? null, userId, mimeType, data, durationMs ?? null, ts);
  return db.prepare('SELECT * FROM video_clips WHERE id = ?').get(info.lastInsertRowid);
}

function getVideoClipById(id) {
  return getDb().prepare('SELECT * FROM video_clips WHERE id = ?').get(id);
}

function isUserInCircle(userId, circleId) {
  const db = getDb();
  const row = db
    .prepare('SELECT 1 as ok FROM circle_members WHERE circle_id = ? AND user_id = ?')
    .get(circleId, userId);
  return Boolean(row);
}

function logUsageEvent({ userId, eventType, value = 1, meta = null }) {
  const db = getDb();
  const ts = now();
  db.prepare(
    `INSERT INTO usage_events (user_id, event_type, value, meta_json, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(userId, eventType, Math.max(0, Math.round(Number(value) || 0)), meta ? JSON.stringify(meta) : null, ts);
}

function sumUsageEventLast24h(userId, eventType) {
  const db = getDb();
  const since = now() - 24 * 60 * 60 * 1000;
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(value), 0) as total
       FROM usage_events
       WHERE user_id = ? AND event_type = ? AND created_at >= ?`
    )
    .get(userId, eventType, since);
  return Number(row?.total || 0);
}

function countCheckinsLast24h(userId) {
  const db = getDb();
  const since = now() - 24 * 60 * 60 * 1000;
  return db.prepare('SELECT COUNT(*) as c FROM checkins WHERE user_id = ? AND sent_at >= ?').get(userId, since).c;
}

function countSafeWalkSessionsLast24h(userId) {
  const db = getDb();
  const since = now() - 24 * 60 * 60 * 1000;
  return db
    .prepare('SELECT COUNT(*) as c FROM safewalk_sessions WHERE user_id = ? AND created_at >= ?')
    .get(userId, since).c;
}

function countCheckinSchedulesForUser(userId) {
  const db = getDb();
  return db.prepare('SELECT COUNT(*) as c FROM checkin_schedules WHERE user_id = ?').get(userId).c;
}

function getUsageSummaryLast24h(userId) {
  return {
    checks_sent_last_24h: sumUsageEventLast24h(userId, 'check_sent') || countCheckinsLast24h(userId),
    safewalk_sessions_last_24h:
      sumUsageEventLast24h(userId, 'safewalk_started') || countSafeWalkSessionsLast24h(userId),
    alerts_sent_last_24h: sumUsageEventLast24h(userId, 'alert_sent'),
    trusted_people_notified_last_24h: sumUsageEventLast24h(userId, 'trusted_people_notified')
  };
}

// Check-ins
function createCheckin({ userId, circleId, source }) {
  const db = getDb();
  const ts = now();
  const info = db
    .prepare(
      `INSERT INTO checkins (user_id, circle_id, source, sent_at)
       VALUES (?, ?, ?, ?)`
    )
    .run(userId, circleId ?? null, source, ts);
  return db.prepare('SELECT * FROM checkins WHERE id = ?').get(info.lastInsertRowid);
}

function countCheckinsLastHour(userId) {
  const db = getDb();
  const since = now() - 60 * 60 * 1000;
  return db
    .prepare('SELECT COUNT(*) as c FROM checkins WHERE user_id = ? AND sent_at >= ?')
    .get(userId, since).c;
}

function getCheckinById(id) {
  return getDb().prepare('SELECT * FROM checkins WHERE id = ?').get(id);
}

function respondToCheckin({ id, response }) {
  const db = getDb();
  const ts = now();
  db.prepare(
    `UPDATE checkins
     SET responded_at = ?, response = ?
     WHERE id = ? AND responded_at IS NULL`
  ).run(ts, response, id);
  return getCheckinById(id);
}

function markReminderSent(id) {
  const db = getDb();
  db.prepare('UPDATE checkins SET reminder_sent_at = ? WHERE id = ?').run(now(), id);
}

function markEscalated(id, meta) {
  const db = getDb();
  db.prepare('UPDATE checkins SET escalated_at = ?, escalation_meta_json = ? WHERE id = ?').run(
    now(),
    JSON.stringify(meta ?? {}),
    id
  );
}

function listPendingCheckinsForReminders() {
  const db = getDb();
  const ts = now();
  const oneMinAgo = ts - 60 * 1000;
  return db
    .prepare(
      `SELECT * FROM checkins
       WHERE responded_at IS NULL
         AND reminder_sent_at IS NULL
         AND sent_at <= ?
       ORDER BY sent_at ASC
       LIMIT 50`
    )
    .all(oneMinAgo);
}

function listPendingCheckinsForEscalation() {
  const db = getDb();
  const ts = now();
  const threeMinAgo = ts - 3 * 60 * 1000;
  return db
    .prepare(
      `SELECT * FROM checkins
       WHERE responded_at IS NULL
         AND escalated_at IS NULL
         AND sent_at <= ?
       ORDER BY sent_at ASC
       LIMIT 50`
    )
    .all(threeMinAgo);
}

function listCheckinSchedules(userId) {
  const db = getDb();
  return db
    .prepare('SELECT * FROM checkin_schedules WHERE user_id = ? ORDER BY id DESC')
    .all(userId);
}

function listAllEnabledCheckinSchedules() {
  const db = getDb();
  return db.prepare('SELECT * FROM checkin_schedules WHERE enabled = 1').all();
}

function markCheckinScheduleLastSent(id, ts) {
  const db = getDb();
  db.prepare('UPDATE checkin_schedules SET last_sent_at = ?, updated_at = ? WHERE id = ?').run(ts, ts, id);
}

function createCheckinSchedule({ userId, daysOfWeek, timeHHMM, timezone }) {
  const db = getDb();
  const ts = now();
  const info = db
    .prepare(
      `INSERT INTO checkin_schedules (user_id, days_of_week, time_hhmm, timezone, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`
    )
    .run(userId, daysOfWeek, timeHHMM, timezone, ts, ts);
  return db.prepare('SELECT * FROM checkin_schedules WHERE id = ?').get(info.lastInsertRowid);
}

function getCheckinScheduleById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM checkin_schedules WHERE id = ?').get(id);
}

function updateCheckinSchedule(id, patch) {
  const db = getDb();
  const fields = Object.keys(patch);
  if (!fields.length) return db.prepare('SELECT * FROM checkin_schedules WHERE id = ?').get(id);
  const sets = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => patch[f]);
  values.push(now());
  values.push(id);
  db.prepare(`UPDATE checkin_schedules SET ${sets}, updated_at = ? WHERE id = ?`).run(...values);
  return db.prepare('SELECT * FROM checkin_schedules WHERE id = ?').get(id);
}

function updateCheckinScheduleForUser(id, userId, patch) {
  const db = getDb();
  const fields = Object.keys(patch);
  if (!fields.length) return getCheckinScheduleById(id);
  const sets = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => patch[f]);
  const ts = now();
  values.push(ts);
  values.push(id);
  values.push(userId);
  db.prepare(`UPDATE checkin_schedules SET ${sets}, updated_at = ? WHERE id = ? AND user_id = ?`).run(
    ...values
  );
  return getCheckinScheduleById(id);
}

function deleteCheckinSchedule(id, userId) {
  const db = getDb();
  db.prepare('DELETE FROM checkin_schedules WHERE id = ? AND user_id = ?').run(id, userId);
}

// SafeWalk
function createSafeWalkSession({ userId, circleId, durationMinutes, intervalMinutes }) {
  const db = getDb();
  const ts = now();
  const endsAt = ts + durationMinutes * 60 * 1000;
  const nextCheckinAt = ts + intervalMinutes * 60 * 1000;
  const info = db
    .prepare(
      `INSERT INTO safewalk_sessions (user_id, circle_id, duration_minutes, interval_minutes, started_at, ends_at, next_checkin_at, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`
    )
    .run(userId, circleId ?? null, durationMinutes, intervalMinutes, ts, endsAt, nextCheckinAt, ts);
  return db.prepare('SELECT * FROM safewalk_sessions WHERE id = ?').get(info.lastInsertRowid);
}

function getActiveSafeWalkSession(userId) {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM safewalk_sessions
       WHERE user_id = ? AND status = 'active'
       ORDER BY started_at DESC
       LIMIT 1`
    )
    .get(userId);
}

function listDueSafeWalkSessions() {
  const db = getDb();
  const ts = now();
  return db
    .prepare(
      `SELECT * FROM safewalk_sessions
       WHERE status = 'active'
         AND next_checkin_at <= ?
       ORDER BY next_checkin_at ASC
       LIMIT 50`
    )
    .all(ts);
}

function bumpSafeWalkNextCheckin(sessionId, nextCheckinAt) {
  const db = getDb();
  db.prepare('UPDATE safewalk_sessions SET next_checkin_at = ? WHERE id = ?').run(nextCheckinAt, sessionId);
}

function endSafeWalkSession(sessionId) {
  const db = getDb();
  db.prepare("UPDATE safewalk_sessions SET status = 'ended' WHERE id = ?").run(sessionId);
}

module.exports = {
  now,
  createUserIfNotExists,
  getUserByEmail,
  getUserById,
  getUserByStripeCustomerId,
  getUserByStripeSubscriptionId,
  updateUser,

  ensureCircleForOwner,
  getCircleByOwner,
  getCircleById,
  listCirclesForUser,
  listCircleMembers,
  countCircleMembers,
  addMemberToCircle,
  removeMemberFromCircle,
  createInvite,
  getInviteByToken,

  upsertPushSubscription,
  deletePushSubscription,
  listPushSubscriptions,

  addSignal,
  listSignalsForCircle,

  addAudioClip,
  getAudioClipById,
  addVideoClip,
  getVideoClipById,
  isUserInCircle,
  logUsageEvent,
  getUsageSummaryLast24h,
  countSafeWalkSessionsLast24h,
  countCheckinSchedulesForUser,

  createCheckin,
  countCheckinsLastHour,
  countCheckinsLast24h,
  getCheckinById,
  respondToCheckin,
  markReminderSent,
  markEscalated,
  listPendingCheckinsForReminders,
  listPendingCheckinsForEscalation,

  listCheckinSchedules,
  listAllEnabledCheckinSchedules,
  createCheckinSchedule,
  getCheckinScheduleById,
  updateCheckinSchedule,
  updateCheckinScheduleForUser,
  deleteCheckinSchedule,
  markCheckinScheduleLastSent,

  createSafeWalkSession,
  getActiveSafeWalkSession,
  listDueSafeWalkSessions,
  bumpSafeWalkNextCheckin,
  endSafeWalkSession
};
