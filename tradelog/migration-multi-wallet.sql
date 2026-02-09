BEGIN TRANSACTION;

-- Step 1: Add nullable BIGINT wallet_id columns if they don't exist
ALTER TABLE trades ADD COLUMN IF NOT EXISTS wallet_id BIGINT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS wallet_id BIGINT;

-- Step 2: Insert missing wallets from DISTINCT wallet_address values in trades
INSERT INTO wallets (user_id, wallet_address)
SELECT DISTINCT user_id, wallet_address FROM trades
WHERE user_id IS NOT NULL AND wallet_address IS NOT NULL
ON CONFLICT DO NOTHING;

-- Step 3: Backfill trades.wallet_id where it is currently NULL
UPDATE trades t
SET wallet_id = w.id
FROM wallets w
WHERE t.user_id = w.user_id AND t.wallet_address = w.wallet_address AND t.wallet_id IS NULL;

-- Step 4: Backfill journal_entries.wallet_id via trades table where it is currently NULL
UPDATE journal_entries je
SET wallet_id = t.wallet_id
FROM trades t
WHERE je.tx_hash = t.transaction_hash AND je.wallet_id IS NULL;

-- Step 5: Safety checks - abort if any wallet_id still remains NULL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM trades WHERE wallet_id IS NULL AND user_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Found NULL wallet_id in trades table after backfill';
  END IF;
  IF EXISTS (SELECT 1 FROM journal_entries WHERE wallet_id IS NULL AND user_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Found NULL wallet_id in journal_entries table after backfill';
  END IF;
END $$;

-- Step 6: Add uniquely named foreign keys
ALTER TABLE trades ADD CONSTRAINT trades_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES wallets(id);
ALTER TABLE journal_entries ADD CONSTRAINT journal_entries_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES wallets(id);

-- Step 7: Set wallet_id to NOT NULL
ALTER TABLE trades ALTER COLUMN wallet_id SET NOT NULL;
ALTER TABLE journal_entries ALTER COLUMN wallet_id SET NOT NULL;

-- Step 8: Add unique(wallet_id, transaction_hash) constraint
ALTER TABLE trades ADD CONSTRAINT unique_wallet_transaction UNIQUE (wallet_id, transaction_hash);

COMMIT;
