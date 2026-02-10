-- Phase 1 wallet naming support
-- Safe to run multiple times.

ALTER TABLE wallets
ADD COLUMN IF NOT EXISTS label TEXT;
