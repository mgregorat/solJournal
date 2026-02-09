-- TradeLog Database Schema v5 - Privy Auth
-- This schema uses a custom users table linked to Privy DIDs.

-- Drop existing tables with cascade to remove dependencies and ensure a clean slate.
DROP TABLE IF EXISTS trades CASCADE;
DROP TABLE IF EXISTS setups CASCADE;
DROP TABLE IF EXISTS tokens CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS wallets CASCADE;
DROP TABLE IF EXISTS watchlist CASCADE;
DROP TABLE IF EXISTS daily_balances CASCADE;
DROP TABLE IF EXISTS price_snapshots CASCADE;

-- Users Table
-- Stores user information, linked to their Privy DID.
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    privy_did TEXT NOT NULL UNIQUE,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Wallets Table
-- Stores wallet addresses linked to a user.
CREATE TABLE wallets (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_address TEXT NOT NULL UNIQUE,
    label TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Watchlist Table
-- Stores tokens that a user is watching.
CREATE TABLE watchlist (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_address TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, token_address)
);

-- Setups Table
-- Stores user-defined trading setups.
CREATE TABLE setups (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trades Table
-- Stores individual trades with links to users and setups.
CREATE TABLE trades (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    wallet_address TEXT NOT NULL, -- The specific wallet used for the trade
    token_symbol TEXT NOT NULL,
    token_address TEXT NOT NULL,
    trade_type TEXT NOT NULL CHECK (trade_type IN ('buy', 'sell')),
    amount DECIMAL NOT NULL,
    price DECIMAL NOT NULL,
    total_value DECIMAL NOT NULL,
    trade_date TIMESTAMP WITH TIME ZONE NOT NULL,
    notes TEXT,
    emotion_tags TEXT[], -- Array of strings for emotions
    setup_id BIGINT REFERENCES setups(id) ON DELETE SET NULL, -- Link to the setup used
    source TEXT, -- e.g., 'pump.fun', 'jupiter'
    transaction_hash TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tokens Table
CREATE TABLE tokens (
    id BIGSERIAL PRIMARY KEY,
    symbol TEXT UNIQUE NOT NULL,
    address TEXT UNIQUE NOT NULL,
    name TEXT,
    decimals INTEGER DEFAULT 9,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily Balances for Phantom-style P&L
-- Stores the total wallet value at the start of each day (00:00 UTC)
CREATE TABLE daily_balances (
    id SERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    balance_date DATE NOT NULL,
    start_of_day_balance_usd DECIMAL(20, 8) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(wallet_address, balance_date)
);

-- Hourly Price Snapshots for P&L calculation resilience
-- Stores the price of a token at a specific hour
CREATE TABLE price_snapshots (
    id SERIAL PRIMARY KEY,
    token_address TEXT NOT NULL,
    price_usd DECIMAL(20, 8) NOT NULL,
    snapshot_hour TIMESTAMP WITH TIME ZONE NOT NULL,
    source TEXT, -- e.g., 'dexscreener', 'coingecko'
    UNIQUE(token_address, snapshot_hour)
);

-- Indexes for performance
CREATE INDEX idx_daily_balances_wallet_date ON daily_balances(wallet_address, balance_date);
CREATE INDEX idx_price_snapshots_token_hour ON price_snapshots(token_address, snapshot_hour);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_trades_updated_at BEFORE UPDATE ON trades
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Journal Entries Table
-- Stores user-added notes, tags, and flags for trades.
CREATE TABLE journal_entries (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tx_hash TEXT NOT NULL,
    notes TEXT,
    tags TEXT[],
    is_flagged BOOLEAN DEFAULT FALSE,
    what_went_well TEXT,
    what_went_wrong TEXT,
    what_will_i_do_differently TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, wallet_id, tx_hash)
);

CREATE TRIGGER update_journal_entries_updated_at BEFORE UPDATE ON journal_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
-- Seed Data for Tokens
INSERT INTO tokens (symbol, address, name, decimals) VALUES
    ('BONK', 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', 'Bonk', 5),
    ('SAMO', '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', 'Samoyedcoin', 9),
    ('WIF', 'EKpQGSJtjMFqKZ1KQanSqYXRcF8fBopzLHYxdM65Qjm', 'dogwifhat', 6),
    ('POPCAT', '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', 'Popcat', 9),
    ('BOOK', '3FoNc3NwQfkuH5KHKqQqQqQqQqQqQqQqQqQqQqQqQqQq', 'Book of Meme', 9)
ON CONFLICT (symbol) DO NOTHING;

