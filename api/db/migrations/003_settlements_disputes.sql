-- =============================================
-- Migration 003 — Partial settlements & disputes
-- Run: psql -U <user> -d splitkesh -f db/migrations/003_settlements_disputes.sql
-- (idempotent — safe to run more than once)
-- =============================================

-- Payments can now carry a transaction reference, and are partial-friendly.
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(80);

-- New status model: pending -> confirmed | disputed
-- (migrate any legacy 'paid' rows to 'confirmed')
UPDATE settlements SET status = 'confirmed' WHERE status = 'paid';

CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements(status);
CREATE INDEX IF NOT EXISTS idx_settlements_group  ON settlements(group_id);

-- Disputes raised by the person who was owed, against the payer.
CREATE TABLE IF NOT EXISTS disputes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID REFERENCES settlements(id) ON DELETE CASCADE,
  raised_by     UUID REFERENCES users(id)  ON DELETE CASCADE,
  against_user  UUID REFERENCES users(id)  ON DELETE CASCADE,
  group_id      UUID REFERENCES groups(id) ON DELETE SET NULL,
  amount        DECIMAL(12,2),
  reason        VARCHAR(40) NOT NULL,  -- money_not_received | fake_transaction_id | incomplete_amount | other
  note          TEXT,
  status        VARCHAR(20) DEFAULT 'open',  -- open | resolved
  created_at    TIMESTAMP DEFAULT NOW(),
  resolved_at   TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_disputes_raised  ON disputes(raised_by);
CREATE INDEX IF NOT EXISTS idx_disputes_against ON disputes(against_user);
CREATE INDEX IF NOT EXISTS idx_disputes_status  ON disputes(status);
