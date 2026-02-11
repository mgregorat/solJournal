-- Wallet link nonces for Phantom signature verification.
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS wallet_link_nonces (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  wallet_address TEXT NOT NULL,
  nonce TEXT NOT NULL UNIQUE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  CONSTRAINT wallet_link_nonces_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS wallet_link_nonces_user_id_idx
  ON wallet_link_nonces(user_id);

CREATE INDEX IF NOT EXISTS wallet_link_nonces_wallet_address_idx
  ON wallet_link_nonces(wallet_address);

CREATE INDEX IF NOT EXISTS wallet_link_nonces_expires_at_idx
  ON wallet_link_nonces(expires_at);

-- Cleanup snippet (run periodically, e.g. cron/Supabase scheduled job):
-- DELETE FROM wallet_link_nonces
-- WHERE expires_at < NOW()
--    OR used_at IS NOT NULL;
