-- Ensure per-user wallet idempotency and duplicate prevention.
-- Solana base58 addresses are case-sensitive; this keeps exact-case uniqueness.

CREATE UNIQUE INDEX IF NOT EXISTS wallets_user_id_wallet_address_uidx
  ON wallets(user_id, wallet_address);

