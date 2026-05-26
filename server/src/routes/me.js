const express = require('express');
const { requireAuth } = require('../auth');
const { getFreshUserWithEntitlements } = require('../entitlements');

const meRouter = express.Router();

meRouter.get('/entitlements', requireAuth, async (req, res) => {
  const { user, entitlements } = await getFreshUserWithEntitlements(req.user, req.log);
  req.user = user;
  req.entitlements = entitlements;
  res.json(entitlements);
});

module.exports = { meRouter };
