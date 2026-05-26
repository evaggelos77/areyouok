const express = require('express');
const { requireAuth } = require('../auth');
const { updateUser } = require('../repo');

const profileRouter = express.Router();

profileRouter.get('/', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

profileRouter.put('/', requireAuth, (req, res) => {
  const patch = {};
  const body = req.body || {};

  if (typeof body.name === 'string') patch.name = body.name.slice(0, 60);
  if (typeof body.avatar === 'string') patch.avatar = body.avatar.slice(0, 200);
  if (typeof body.phone === 'string') patch.phone = body.phone.slice(0, 40);

  if (body.mode === 'teen' || body.mode === 'adult' || body.mode === 'senior') patch.mode = body.mode;
  if (body.role === 'user' || body.role === 'circle') patch.role = body.role;
  if (body.language === 'el' || body.language === 'en') patch.language = body.language;

  if (body.theme === 'neon' || body.theme === 'clean' || body.theme === 'high_contrast') patch.theme = body.theme;

  if (typeof body.snoozeUntil === 'number') patch.snooze_until = body.snoozeUntil;
  if (typeof body.maxCheckinsPerHour === 'number') {
    const v = Math.max(1, Math.min(20, Math.floor(body.maxCheckinsPerHour)));
    patch.max_checkins_per_hour = v;
  }

  if (body.onboarded === true) patch.onboarded = 1;

  const user = updateUser(req.user.id, patch);
  res.json({ ok: true, user });
});

module.exports = { profileRouter };
