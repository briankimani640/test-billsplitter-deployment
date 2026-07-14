-- =============================================
-- Migration 002 — Usernames
-- Adds a public @username used for finding people
-- (member search no longer exposes name/email).
-- Run: psql -U postgres -d splitkesh -f db/migrations/002_username.sql
-- (idempotent — safe to run multiple times)
-- =============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(30);

-- Backfill existing rows from the email local-part (sanitised)
UPDATE users
   SET username = LOWER(REGEXP_REPLACE(SPLIT_PART(email, '@', 1), '[^a-z0-9_]', '_', 'g'))
 WHERE username IS NULL OR username = '';

-- De-duplicate: keep the earliest row's handle, suffix the rest with 4 id chars
UPDATE users u
   SET username = u.username || SUBSTR(REPLACE(u.id::text, '-', ''), 1, 4)
 WHERE EXISTS (
   SELECT 1 FROM users u2
    WHERE LOWER(u2.username) = LOWER(u.username)
      AND u2.id < u.id
 );

-- Case-insensitive uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username));
