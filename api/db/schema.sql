-- =============================================
-- SplitKesh Database Schema
-- Run: psql -U postgres -d splitkesh -f db/schema.sql
-- =============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── USERS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  phone         VARCHAR(25),
  password_hash VARCHAR(255) NOT NULL,
  avatar_url    TEXT,
  initials      VARCHAR(5),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- ── REFRESH TOKENS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ── GROUPS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS groups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL,
  icon       VARCHAR(10)  DEFAULT '💰',
  icon_color VARCHAR(50)  DEFAULT 'group-icon-purple',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ── GROUP MEMBERS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS group_members (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id  UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  role      VARCHAR(20) DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- ── EXPENSES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID REFERENCES groups(id) ON DELETE CASCADE,
  description VARCHAR(255) NOT NULL,
  amount      DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  paid_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  category    VARCHAR(50)  DEFAULT 'Other',
  emoji       VARCHAR(10)  DEFAULT '📦',
  split_type  VARCHAR(20)  DEFAULT 'equal',
  date        DATE         DEFAULT CURRENT_DATE,
  receipt_url TEXT,
  notes       TEXT,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- ── EXPENSE SPLITS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expense_splits (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  amount     DECIMAL(12,2) NOT NULL,
  UNIQUE(expense_id, user_id)
);

-- ── SETTLEMENTS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settlements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  to_user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  amount         DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  group_id       UUID REFERENCES groups(id) ON DELETE SET NULL,
  status         VARCHAR(20) DEFAULT 'pending',
  payment_method VARCHAR(50),
  notes          TEXT,
  paid_at        TIMESTAMP,
  created_at     TIMESTAMP DEFAULT NOW()
);

-- ── INDEXES ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_group_members_group   ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user    ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_group        ON expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_expenses_paid_by      ON expenses(paid_by);
CREATE INDEX IF NOT EXISTS idx_expense_splits_expense ON expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_user   ON expense_splits(user_id);
CREATE INDEX IF NOT EXISTS idx_settlements_from      ON settlements(from_user_id);
CREATE INDEX IF NOT EXISTS idx_settlements_to        ON settlements(to_user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user   ON refresh_tokens(user_id);

-- =============================================
-- Feature additions (see db/migrations/001_features.sql)
-- =============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin       BOOLEAN  DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN  DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences    JSONB    DEFAULT '{}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at  TIMESTAMP;

CREATE TABLE IF NOT EXISTS email_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  type       VARCHAR(20) NOT NULL,
  expires_at TIMESTAMP   NOT NULL,
  used_at    TIMESTAMP,
  created_at TIMESTAMP   DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_tokens_hash ON email_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_email_tokens_user ON email_tokens(user_id);

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(40) NOT NULL,
  title      VARCHAR(140) NOT NULL,
  body       TEXT,
  data       JSONB DEFAULT '{}'::jsonb,
  read_at    TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;

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

-- =============================================
-- Usernames (see db/migrations/002_username.sql)
-- =============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(30);
UPDATE users
   SET username = LOWER(REGEXP_REPLACE(SPLIT_PART(email, '@', 1), '[^a-z0-9_]', '_', 'g'))
 WHERE username IS NULL OR username = '';
UPDATE users u
   SET username = u.username || SUBSTR(REPLACE(u.id::text, '-', ''), 1, 4)
 WHERE EXISTS (SELECT 1 FROM users u2 WHERE LOWER(u2.username) = LOWER(u.username) AND u2.id < u.id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username));

-- =============================================
-- Partial settlements & disputes (migration 003)
-- =============================================
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(80);
UPDATE settlements SET status = 'confirmed' WHERE status = 'paid';
CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements(status);
CREATE INDEX IF NOT EXISTS idx_settlements_group  ON settlements(group_id);

CREATE TABLE IF NOT EXISTS disputes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID REFERENCES settlements(id) ON DELETE CASCADE,
  raised_by     UUID REFERENCES users(id)  ON DELETE CASCADE,
  against_user  UUID REFERENCES users(id)  ON DELETE CASCADE,
  group_id      UUID REFERENCES groups(id) ON DELETE SET NULL,
  amount        DECIMAL(12,2),
  reason        VARCHAR(40) NOT NULL,
  note          TEXT,
  status        VARCHAR(20) DEFAULT 'open',
  created_at    TIMESTAMP DEFAULT NOW(),
  resolved_at   TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_disputes_raised  ON disputes(raised_by);
CREATE INDEX IF NOT EXISTS idx_disputes_against ON disputes(against_user);
CREATE INDEX IF NOT EXISTS idx_disputes_status  ON disputes(status);
