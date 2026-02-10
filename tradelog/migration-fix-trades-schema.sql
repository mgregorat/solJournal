-- Fix trades table schema to match application code

-- 1. Rename columns
ALTER TABLE trades RENAME COLUMN amount TO token_amount;
ALTER TABLE trades RENAME COLUMN price TO price_usd;
ALTER TABLE trades RENAME COLUMN total_value TO cost_usd;
ALTER TABLE trades RENAME COLUMN trade_type TO event_type;

-- 2. Add missing columns
ALTER TABLE trades ADD COLUMN IF NOT EXISTS quote_token_address TEXT;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS quote_token_symbol TEXT;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS quote_amount DECIMAL;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS gas_usd DECIMAL;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS token_logo TEXT;

-- 3. Reload schema cache
NOTIFY pgrst, 'reload config';
