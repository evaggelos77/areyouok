const express = require('express');
const crypto = require('crypto');

const { requireAuth } = require('../auth');
const {
  ensureCircleForOwner,
  getCircleByOwner,
  listCircleMembers,
  createInvite,
  getInviteByToken,
  addMemberToCircle,
  listCirclesForUser,
  listSignalsForCircle,
  removeMemberFromCircle,
  countCircleMembers,
  getCircleById,
  getUserById
} = require('../repo');
const { config } = require('../config');
const { getEntitlementsFromUser } = require('../entitlements');

const circleRouter = express.Router();

function getPrimaryCircleForUser(userId) {
  // Prefer owned circle; otherwise first membership
  const owned = getCircleByOwner(userId);
  if (owned) return owned;
  const memberships = listCirclesForUser(userId);
  return memberships[0] || null;
}

circleRouter.get('/mine', requireAuth, (req, res) => {
  const circle = getPrimaryCircleForUser(req.user.id);
  res.json({ circle });
});

circleRouter.post('/create', requireAuth, (req, res) => {
  const circle = ensureCircleForOwner(req.user.id);
  res.json({ ok: true, circle });
});

circleRouter.get('/members', requireAuth, (req, res) => {
  const circle = getPrimaryCircleForUser(req.user.id);
  if (!circle) return res.json({ members: [], circle: null, limit: req.entitlements?.limits?.trusted_contacts_limit ?? 2 });
  const members = listCircleMembers(circle.id);
  const owner = getUserById(circle.owner_user_id);
  const limit = owner ? getEntitlementsFromUser(owner).limits.trusted_contacts_limit : 5;
  res.json({ circle, members, limit });
});

circleRouter.post('/invite', requireAuth, (req, res) => {
  const circle = ensureCircleForOwner(req.user.id);
  const limit = req.entitlements?.limits?.trusted_contacts_limit ?? 2;
  const currentCount = countCircleMembers(circle.id);
  if (currentCount >= limit) {
    return res.status(402).json({ error: 'TRUSTED_CONTACTS_LIMIT_REACHED', limit, upgradeTo: 'premium' });
  }
  const token = crypto.randomBytes(16).toString('base64url');
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  createInvite(circle.id, token, expiresAt);
  const link = `${config.publicBaseUrl.replace(/\/$/, '')}/join/${token}`;
  res.json({ ok: true, token, link, expiresAt, limit });
});

circleRouter.post('/join', requireAuth, (req, res) => {
  const token = String(req.body?.token || '').trim();
  if (!token) return res.status(400).json({ error: 'INVALID_TOKEN' });
  const invite = getInviteByToken(token);
  if (!invite) return res.status(404).json({ error: 'INVITE_NOT_FOUND' });
  if (invite.expires_at && invite.expires_at < Date.now()) {
    return res.status(410).json({ error: 'INVITE_EXPIRED' });
  }

  const circle = getCircleById(invite.circle_id);
  const owner = circle ? getUserById(circle.owner_user_id) : null;
  const limit = owner ? getEntitlementsFromUser(owner).limits.trusted_contacts_limit : 5;

  try {
    addMemberToCircle(invite.circle_id, req.user.id, limit);
  } catch (e) {
    if (e.code === 'CIRCLE_LIMIT_REACHED') {
      return res.status(402).json({ error: 'TRUSTED_CONTACTS_LIMIT_REACHED', limit, upgradeTo: 'premium' });
    }
    throw e;
  }
  res.json({ ok: true, circleId: invite.circle_id, limit });
});

circleRouter.get('/feed', requireAuth, (req, res) => {
  const circle = getPrimaryCircleForUser(req.user.id);
  if (!circle) return res.json({ circle: null, items: [] });
  const items = listSignalsForCircle(circle.id, 50);
  res.json({ circle, items });
});

circleRouter.post('/leave', requireAuth, (req, res) => {
  const circleId = Number(req.body?.circleId);
  if (!circleId) return res.status(400).json({ error: 'INVALID_INPUT' });
  // Owners can't leave their own circle (MVP)
  const owned = getCircleByOwner(req.user.id);
  if (owned?.id === circleId) return res.status(400).json({ error: 'OWNER_CANNOT_LEAVE' });
  removeMemberFromCircle(circleId, req.user.id);
  res.json({ ok: true });
});

module.exports = { circleRouter };
