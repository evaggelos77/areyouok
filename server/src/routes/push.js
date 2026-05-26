const express = require('express');
const { requireAuth } = require('../auth');
const { config } = require('../config');
const { upsertPushSubscription, deletePushSubscription } = require('../repo');
const { isPushConfigured } = require('../push');

const pushRouter = express.Router();

pushRouter.get('/config', (req, res) => {
  res.json({
    pushConfigured: isPushConfigured(),
    vapidPublicKey: config.vapidPublicKey || null
  });
});

pushRouter.post('/subscribe', requireAuth, (req, res) => {
  const sub = req.body;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return res.status(400).json({ error: 'INVALID_SUBSCRIPTION' });
  }
  upsertPushSubscription(req.user.id, sub);
  res.json({ ok: true });
});

pushRouter.post('/unsubscribe', requireAuth, (req, res) => {
  const endpoint = req.body?.endpoint;
  if (!endpoint) return res.status(400).json({ error: 'INVALID_INPUT' });
  deletePushSubscription(req.user.id, endpoint);
  res.json({ ok: true });
});

module.exports = { pushRouter };
