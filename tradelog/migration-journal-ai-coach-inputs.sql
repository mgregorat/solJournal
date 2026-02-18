-- Add AI coach input fields to journal_entries for richer trade coaching context.
ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS setup_tag TEXT,
  ADD COLUMN IF NOT EXISTS entry_reason TEXT,
  ADD COLUMN IF NOT EXISTS entry_delay_seconds NUMERIC,
  ADD COLUMN IF NOT EXISTS position_size_usd NUMERIC,
  ADD COLUMN IF NOT EXISTS position_size_sol NUMERIC,
  ADD COLUMN IF NOT EXISTS wallet_equity_usd_at_entry NUMERIC,
  ADD COLUMN IF NOT EXISTS risk_pct_of_wallet NUMERIC,
  ADD COLUMN IF NOT EXISTS mae_percent NUMERIC,
  ADD COLUMN IF NOT EXISTS mfe_percent NUMERIC,
  ADD COLUMN IF NOT EXISTS time_of_day_bucket TEXT,
  ADD COLUMN IF NOT EXISTS exit_plan TEXT,
  ADD COLUMN IF NOT EXISTS did_follow_plan BOOLEAN,
  ADD COLUMN IF NOT EXISTS stop_type TEXT,
  ADD COLUMN IF NOT EXISTS take_profit_rules TEXT;

-- Helpful indexes for analytics slicing.
CREATE INDEX IF NOT EXISTS idx_journal_entries_setup_tag ON journal_entries(setup_tag);
CREATE INDEX IF NOT EXISTS idx_journal_entries_time_of_day_bucket ON journal_entries(time_of_day_bucket);

NOTIFY pgrst, 'reload schema';
