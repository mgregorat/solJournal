-- Migration to make journal entries unique per user, wallet, and transaction.

-- Step 1: Drop the old unique constraint.
ALTER TABLE journal_entries DROP CONSTRAINT IF EXISTS journal_entries_user_id_tx_hash_key;

-- Step 2: Add the new, more specific unique constraint.
ALTER TABLE journal_entries ADD CONSTRAINT journal_entries_user_id_wallet_id_tx_hash_key UNIQUE (user_id, wallet_id, tx_hash);
