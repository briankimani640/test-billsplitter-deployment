-- =============================================
-- Migration 001 — Admin, email verification,
-- password reset, notifications, preferences
-- Run: psql -U postgres -d splitkesh -f db/migrations/001_features.sql
-- (idempotent — safe to run multiple times)
-- =============================================

-- ── USERS: new columns ────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin       BOOLEAN  DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN  DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences    JSONB    DEFAULT '{}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at  TIMESTAMP;

-- ── EMAIL TOKENS (verification + password reset) ──────────
-- We store only a SHA-256 hash of the token, never the raw value.
CREATE TABLE IF NOT EXISTS email_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  type       VARCHAR(20) NOT NULL,            -- 'verify' | 'reset'
  expires_at TIMESTAMP   NOT NULL,
  used_at    TIMESTAMP,
  created_at TIMESTAMP   DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_tokens_hash ON email_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_email_tokens_user ON email_tokens(user_id);

-- ── NOTIFICATIONS (payment reminders + general) ───────────
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(40) NOT NULL,            -- 'payment_reminder' | 'expense_added' | 'settlement' | 'system'
  title      VARCHAR(140) NOT NULL,
  body       TEXT,
  data       JSONB DEFAULT '{}'::jsonb,       -- e.g. { settlementId, groupId, amount }
  read_at    TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;

-- ── REQUEST METRICS (lightweight app monitoring) ──────────
CREATE TABLE IF NOT EXISTS request_logs (
  id          BIGSERIAL PRIMARY KEY,
  method      VARCHAR(10),
  path        VARCHAR(255),
  status      INT,
  duration_ms INT,
  user_id     UUID,
  ip          VARCHAR(64),
  created_at  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_request_logs_created ON request_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_request_logs_status  ON request_logs(status);
