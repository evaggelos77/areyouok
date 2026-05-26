const webpush = require('web-push');
const { config } = require('./config');
const { listPushSubscriptions, deletePushSubscription } = require('./repo');

function isPushConfigured() {
  return Boolean(config.vapidPublicKey && config.vapidPrivateKey && config.vapidSubject);
}

function configureWebPush() {
  if (!isPushConfigured()) return;
  webpush.setVapidDetails(config.vapidSubject, config.vapidPublicKey, config.vapidPrivateKey);
}

async function sendPushToUser(userId, payload, logger) {
  if (!isPushConfigured()) {
    logger?.warn({ userId }, 'Push not configured; skipping');
    return { sent: 0, skipped: true };
  }
  const subs = listPushSubscriptions(userId);
  let sent = 0;
  for (const s of subs) {
    const sub = s.data;
    if (!sub || !sub.endpoint) continue;
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload));
      sent += 1;
    } catch (err) {
      const statusCode = err?.statusCode;
      logger?.warn({ err: String(err), statusCode }, 'Push send failed');
      if (statusCode === 404 || statusCode === 410) {
        // subscription expired
        try {
          deletePushSubscription(userId, sub.endpoint);
        } catch (_) {}
      }
    }
  }
  return { sent };
}

module.exports = { configureWebPush, sendPushToUser, isPushConfigured };
