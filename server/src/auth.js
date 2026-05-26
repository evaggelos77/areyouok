const jwt = require('jsonwebtoken');
const { config } = require('./config');
const { getUserById } = require('./repo');
const { getEntitlementsFromUser } = require('./entitlements');

const COOKIE_NAME = 'ayok_token';

function signToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '30d' });
}

function setAuthCookie(res, token) {
  const isProd = config.env === 'production';
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 30 * 24 * 60 * 60 * 1000
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

function parseAuthToken(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch (_) {
    return null;
  }
}

function requireAuth(req, res, next) {
  const decoded = parseAuthToken(req);
  if (!decoded?.userId) return res.status(401).json({ error: 'UNAUTHENTICATED' });
  const user = getUserById(decoded.userId);
  if (!user) return res.status(401).json({ error: 'UNAUTHENTICATED' });
  req.user = user;
  req.entitlements = getEntitlementsFromUser(user);
  next();
}

module.exports = {
  COOKIE_NAME,
  signToken,
  setAuthCookie,
  clearAuthCookie,
  parseAuthToken,
  requireAuth
};
