const path = require('path');
const dotenv = require('dotenv');

// Load server/.env if present
dotenv.config({ path: path.join(__dirname, '../.env') });

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

function optional(name, def = undefined) {
  const v = process.env[name];
  return v ?? def;
}

const config = {
  env: optional('NODE_ENV', 'development'),
  port: Number(optional('PORT', '8080')),
  publicBaseUrl: optional('PUBLIC_BASE_URL', 'http://localhost:8080'),

  jwtSecret: optional('JWT_SECRET', 'dev_only_change_me'),

  stripeSecretKey: optional('STRIPE_SECRET_KEY', ''),
  stripeWebhookSecret: optional('STRIPE_WEBHOOK_SECRET', ''),
  priceIdMonthly: optional('PRICE_ID_MONTHLY', ''),
  priceIdYearly: optional('PRICE_ID_YEARLY', ''),

  vapidPublicKey: optional('VAPID_PUBLIC_KEY', ''),
  vapidPrivateKey: optional('VAPID_PRIVATE_KEY', ''),
  vapidSubject: optional('VAPID_SUBJECT', ''),

  smtpHost: optional('SMTP_HOST', ''),
  smtpPort: Number(optional('SMTP_PORT', '587')),
  smtpSecure: ['1', 'true', 'yes'].includes(String(optional('SMTP_SECURE', '')).toLowerCase()),
  smtpRequireTls: ['1', 'true', 'yes'].includes(String(optional('SMTP_REQUIRE_TLS', '')).toLowerCase()),
  smtpUser: optional('SMTP_USER', ''),
  smtpPass: optional('SMTP_PASS', ''),
  smtpFrom: optional('SMTP_FROM', 'AreYouOK <no-reply@areyouok.gr>'),
  smtpReplyTo: optional('SMTP_REPLY_TO', ''),
  allowDevOtpFallback: ['1', 'true', 'yes'].includes(String(optional('ALLOW_DEV_OTP_FALLBACK', '0')).toLowerCase()),

  dbPath: optional('DB_PATH', path.join(__dirname, '../data/areyouok.db'))
};

// Safety: never run in production with the placeholder/weak JWT secret.
if (
  config.env === 'production' &&
  (!process.env.JWT_SECRET ||
    config.jwtSecret === 'dev_only_change_me' ||
    config.jwtSecret.length < 16)
) {
  throw new Error(
    'SECURITY: JWT_SECRET must be set to a strong value (>=16 chars) in production. Refusing to start.'
  );
}

module.exports = { config, required };
