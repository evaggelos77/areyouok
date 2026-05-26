const path = require('path');
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const pinoHttp = require('pino-http');

const { config } = require('./config');
const { createLogger } = require('./logger');
const { initDb } = require('./db');
const { configureWebPush } = require('./push');
const { startBackgroundJobs } = require('./jobs');

const { authRouter } = require('./routes/auth');
const { profileRouter } = require('./routes/profile');
const { pushRouter } = require('./routes/push');
const { circleRouter } = require('./routes/circle');
const { signalsRouter } = require('./routes/signals');
const { checkinsRouter } = require('./routes/checkins');
const { safewalkRouter } = require('./routes/safewalk');
const { stripeRouter, stripeWebhookHandler } = require('./routes/stripe');
const { meRouter } = require('./routes/me');
const { trialRouter } = require('./routes/trial');

const logger = createLogger();

initDb();
configureWebPush();

const app = express();
app.disable('x-powered-by');
app.use(
  pinoHttp({
    logger,
    customSuccessMessage: function (req, res) {
      if (res.statusCode === 404) return 'resource not found';
      return `${req.method} ${req.url} -> ${res.statusCode}`;
    }
  })
);

// Stripe webhook needs raw body. Mount BEFORE json parser.
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

if (config.env !== 'production') {
  app.use(
    cors({
      origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true
    })
  );
}

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/push', pushRouter);
app.use('/api/circle', circleRouter);
app.use('/api/signals', signalsRouter);
app.use('/api/checkins', checkinsRouter);
app.use('/api/safewalk', safewalkRouter);
app.use('/api/stripe', stripeRouter);
app.use('/api/me', meRouter);
app.use('/api/trial', trialRouter);

// Unknown API routes must NOT fall through to the SPA catch-all — return JSON 404
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', path: req.path });
});

// In production, serve the built SPA
if (config.env === 'production') {
  const distPath = path.join(__dirname, '../../client/dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Error handler
app.use((err, req, res, next) => {
  req.log?.error({ err: String(err), stack: err?.stack }, 'Unhandled error');
  res.status(500).json({
    error: 'SERVER_ERROR',
    message:
      config.env === 'production'
        ? 'Κάτι πήγε στραβά. Δοκίμασε ξανά.'
        : String(err)
  });
});

app.listen(config.port, () => {
  logger.info(`AreYouOK server running on :${config.port} (${config.env})`);
  startBackgroundJobs(logger);
});
