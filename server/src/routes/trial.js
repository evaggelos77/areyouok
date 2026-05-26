const express = require('express');
const { requireAuth } = require('../auth');
const { updateUser } = require('../repo');
const { getFreshUserWithEntitlements } = require('../entitlements');

const trialRouter = express.Router();

trialRouter.post('/start', requireAuth, async (req, res) => {
  const fresh = await getFreshUserWithEntitlements(req.user, req.log);
  const currentEntitlements = fresh.entitlements;

  if (currentEntitlements.plan_source === 'stripe') {
    return res.status(409).json({ error: 'SUBSCRIPTION_ACTIVE' });
  }

  if (currentEntitlements.trial_used) {
    return res.status(409).json({ error: 'TRIAL_ALREADY_USED', message: 'Το trial έχει ήδη χρησιμοποιηθεί.' });
  }

  const now = Date.now();
  updateUser(req.user.id, {
    trial_used: 1,
    trial_expires_at: now + 24 * 60 * 60 * 1000,
    plan_source: 'trial',
    plan_interval: 'month',
    premium_current_period_end: now + 24 * 60 * 60 * 1000
  });

  const next = await getFreshUserWithEntitlements({ ...req.user, trial_used: 1, trial_expires_at: now + 24 * 60 * 60 * 1000, plan_source: 'trial', plan_interval: 'month', premium_current_period_end: now + 24 * 60 * 60 * 1000 }, req.log);

  res.json({ ok: true, entitlements: next.entitlements });
});

module.exports = { trialRouter };
