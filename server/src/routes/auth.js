const express = require('express');
const bcrypt = require('bcryptjs');

const { config } = require('../config');
const { getDb } = require('../db');
const { createUserIfNotExists } = require('../repo');
const { sendOtpEmail } = require('../email');
const { signToken, setAuthCookie, clearAuthCookie, parseAuthToken } = require('../auth');
const { syncUserSubscriptionPlanIfNeeded } = require('../billing');
const { getFreshUserWithEntitlements } = require('../entitlements');

const authRouter = express.Router();

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Brute-force / abuse protection
const OTP_MAX_ATTEMPTS = 5; // wrong tries allowed per issued code
const OTP_REQUEST_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const OTP_MAX_REQUESTS_PER_WINDOW = 5; // codes that can be requested per email/hour

authRouter.post('/request-otp', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const language = req.body?.language === 'en' ? 'en' : 'el';
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'INVALID_EMAIL' });
  }

  // Throttle how many codes an email can request per window (anti email-bombing / brute-force prep)
  const db0 = getDb();
  const recent = db0
    .prepare('SELECT COUNT(*) AS n FROM otp_codes WHERE email = ? AND created_at > ?')
    .get(email, Date.now() - OTP_REQUEST_WINDOW_MS);
  if (recent && recent.n >= OTP_MAX_REQUESTS_PER_WINDOW) {
    req.log?.warn({ email, count: recent.n }, 'OTP request throttled');
    return res.status(429).json({ error: 'OTP_TOO_MANY_REQUESTS' });
  }

  const code = generateOtp();
  const codeHash = await bcrypt.hash(code, 10);
  const now = Date.now();
  const expiresAt = now + 10 * 60 * 1000;

  const result = await sendOtpEmail({ to: email, code, locale: language });
  const allowDevFallback = config.env !== 'production' && config.allowDevOtpFallback;

  if (!result.delivered && !allowDevFallback) {
    req.log?.warn({ email, error: result.error, details: result.details }, 'OTP email not delivered');
    return res.status(503).json({ error: result.error || 'OTP_EMAIL_UNAVAILABLE' });
  }

  const db = getDb();
  db.prepare('INSERT INTO otp_codes (email, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?)').run(
    email,
    codeHash,
    expiresAt,
    now
  );

  const devCode = allowDevFallback && !result.delivered ? code : undefined;
  if (!result.delivered && devCode) {
    req.log?.warn({ email }, 'OTP email not delivered; using dev OTP fallback.');
  }

  res.json({ ok: true, devCode });
});

authRouter.post('/verify-otp', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const code = String(req.body?.code || '').trim();
  if (!isValidEmail(email) || code.length < 4) {
    return res.status(400).json({ error: 'INVALID_INPUT' });
  }

  const db = getDb();
  const row = db
    .prepare(
      `SELECT * FROM otp_codes
       WHERE email = ? AND expires_at > ?
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get(email, Date.now());

  if (!row) return res.status(400).json({ error: 'OTP_EXPIRED' });

  // Brute-force cap: too many wrong tries on this code → burn all codes, force re-request
  if ((row.attempts ?? 0) >= OTP_MAX_ATTEMPTS) {
    db.prepare('DELETE FROM otp_codes WHERE email = ?').run(email);
    req.log?.warn({ email }, 'OTP locked: too many attempts');
    return res.status(429).json({ error: 'OTP_TOO_MANY_ATTEMPTS' });
  }

  const ok = await bcrypt.compare(code, row.code_hash);
  if (!ok) {
    db.prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?').run(row.id);
    if ((row.attempts ?? 0) + 1 >= OTP_MAX_ATTEMPTS) {
      db.prepare('DELETE FROM otp_codes WHERE email = ?').run(email);
      return res.status(429).json({ error: 'OTP_TOO_MANY_ATTEMPTS' });
    }
    return res.status(400).json({ error: 'OTP_INVALID' });
  }

  // Consume: delete all otp rows for email
  db.prepare('DELETE FROM otp_codes WHERE email = ?').run(email);

  const user = createUserIfNotExists(email);
  const token = signToken({ userId: user.id });
  setAuthCookie(res, token);

  res.json({ ok: true, user });
});

authRouter.get('/me', async (req, res) => {
  const decoded = parseAuthToken(req);
  if (!decoded?.userId) return res.json({ user: null, entitlements: null });
  const repo = require('../repo');
  const dbUser = repo.getUserById(decoded.userId);
  if (!dbUser) return res.json({ user: null, entitlements: null });
  const fresh = await getFreshUserWithEntitlements(dbUser, req.log);
  res.json({ user: fresh.user, entitlements: fresh.entitlements });
});

authRouter.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

module.exports = { authRouter };
