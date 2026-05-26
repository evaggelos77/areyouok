const Database = require('better-sqlite3');
const { config } = require('./config');

let db;

function getDb() {
  if (!db) {
    db = new Database(config.dbPath);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

function initDb() {
  const db = getDb();

  // Users
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      avatar TEXT,
      phone TEXT,
      mode TEXT DEFAULT 'teen',
      role TEXT DEFAULT 'user',
      language TEXT DEFAULT 'el',
      theme TEXT DEFAULT 'neon',
      snooze_until INTEGER,
      max_checkins_per_hour INTEGER DEFAULT 6,
      premium INTEGER DEFAULT 0,
      subscription_plan TEXT DEFAULT 'free',
      trial_used INTEGER DEFAULT 0,
      trial_expires_at INTEGER,
      plan_source TEXT DEFAULT 'free',
      plan_interval TEXT DEFAULT 'free',
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      premium_current_period_end INTEGER,
      last_signal_at INTEGER,
      last_battery REAL,
      last_lat REAL,
      last_lng REAL,
      last_accuracy REAL,
      onboarded INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  try {
    db.exec('ALTER TABLE users ADD COLUMN phone TEXT');
  } catch (_) {
    // ignore
  }

  try {
    db.exec('ALTER TABLE users ADD COLUMN onboarded INTEGER DEFAULT 0');
  } catch (_) {
    // ignore
  }

  try {
    db.exec("ALTER TABLE users ADD COLUMN subscription_plan TEXT DEFAULT 'free'");
  } catch (_) {
    // ignore
  }

  try {
    db.exec('ALTER TABLE users ADD COLUMN trial_used INTEGER DEFAULT 0');
  } catch (_) {
    // ignore
  }

  try {
    db.exec('ALTER TABLE users ADD COLUMN trial_expires_at INTEGER');
  } catch (_) {
    // ignore
  }

  try {
    db.exec("ALTER TABLE users ADD COLUMN plan_source TEXT DEFAULT 'free'");
  } catch (_) {
    // ignore
  }

  try {
    db.exec("ALTER TABLE users ADD COLUMN plan_interval TEXT DEFAULT 'free'");
  } catch (_) {
    // ignore
  }

  // OTP
  db.exec(`
    CREATE TABLE IF NOT EXISTS otp_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      attempts INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes(email);
  `);

  // Backward compatible: add attempts column if DB already exists (brute-force cap)
  try {
    db.exec('ALTER TABLE otp_codes ADD COLUMN attempts INTEGER DEFAULT 0');
  } catch (_) {
    // ignore if already exists
  }

  // Circles
  db.exec(`
    CREATE TABLE IF NOT EXISTS circles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_user_id INTEGER NOT NULL,
      name TEXT DEFAULT 'Άτομα Εμπιστοσύνης',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (owner_user_id) REFERENCES users(id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS circle_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      circle_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(circle_id, user_id),
      FOREIGN KEY (circle_id) REFERENCES circles(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Invites
  db.exec(`
    CREATE TABLE IF NOT EXISTS invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      circle_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (circle_id) REFERENCES circles(id)
    );
    CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token);
  `);

  // Push subscriptions
  db.exec(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      data_json TEXT,
      created_at INTEGER NOT NULL,
      UNIQUE(user_id, endpoint),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Signals
  db.exec(`
    CREATE TABLE IF NOT EXISTS signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      circle_id INTEGER,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      message TEXT,
      created_at INTEGER NOT NULL,
      lat REAL,
      lng REAL,
      accuracy REAL,
      battery REAL,
      meta_json TEXT,
      FOREIGN KEY (circle_id) REFERENCES circles(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_signals_circle ON signals(circle_id);
    CREATE INDEX IF NOT EXISTS idx_signals_user ON signals(user_id);
  `);

  // Audio clips (MVP attachments)
  db.exec(`
    CREATE TABLE IF NOT EXISTS audio_clips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      circle_id INTEGER,
      user_id INTEGER NOT NULL,
      mime_type TEXT NOT NULL,
      data BLOB NOT NULL,
      duration_ms INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (circle_id) REFERENCES circles(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_audio_clips_circle ON audio_clips(circle_id);
    CREATE INDEX IF NOT EXISTS idx_audio_clips_user ON audio_clips(user_id);
  `);

  // Video clips (attachments)
  db.exec(`
    CREATE TABLE IF NOT EXISTS video_clips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      circle_id INTEGER,
      user_id INTEGER NOT NULL,
      mime_type TEXT NOT NULL,
      data BLOB NOT NULL,
      duration_ms INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (circle_id) REFERENCES circles(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_video_clips_circle ON video_clips(circle_id);
    CREATE INDEX IF NOT EXISTS idx_video_clips_user ON video_clips(user_id);
  `);

  // Check-in schedules
  db.exec(`
    CREATE TABLE IF NOT EXISTS checkin_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      days_of_week TEXT NOT NULL,
      time_hhmm TEXT NOT NULL,
      timezone TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      last_sent_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_checkin_schedules_user ON checkin_schedules(user_id);
  `);

  // Backward compatible: add column if DB already exists
  try {
    db.exec('ALTER TABLE checkin_schedules ADD COLUMN last_sent_at INTEGER');
  } catch (_) {
    // ignore if already exists
  }


  // Usage counters / recap events
  db.exec(`
    CREATE TABLE IF NOT EXISTS usage_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      value INTEGER DEFAULT 1,
      meta_json TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_usage_events_user_type_time ON usage_events(user_id, event_type, created_at);
  `);

  // Check-ins
  db.exec(`
    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      circle_id INTEGER,
      source TEXT NOT NULL,
      sent_at INTEGER NOT NULL,
      responded_at INTEGER,
      response TEXT,
      reminder_sent_at INTEGER,
      escalated_at INTEGER,
      escalation_meta_json TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (circle_id) REFERENCES circles(id)
    );
    CREATE INDEX IF NOT EXISTS idx_checkins_user ON checkins(user_id);
    CREATE INDEX IF NOT EXISTS idx_checkins_pending ON checkins(responded_at, escalated_at);
  `);

  // SafeWalk sessions
  db.exec(`
    CREATE TABLE IF NOT EXISTS safewalk_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      circle_id INTEGER,
      duration_minutes INTEGER NOT NULL,
      interval_minutes INTEGER NOT NULL,
      started_at INTEGER NOT NULL,
      ends_at INTEGER NOT NULL,
      next_checkin_at INTEGER NOT NULL,
      status TEXT DEFAULT 'active',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_safewalk_user ON safewalk_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_safewalk_status ON safewalk_sessions(status);
  `);

  return db;
}

module.exports = { getDb, initDb };
