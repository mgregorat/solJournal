# Phantom-Style P&L Tracker Setup Guide

This guide details how to set up the Phantom-style daily P&L tracker.

## 1. Environment Variables

Ensure your `.env.local` file contains the following variables. The `CRON_SECRET` is a password of your choice to protect the snapshot endpoint.

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key

# Solana
NEXT_PUBLIC_RPC_URL=your_helius_or_quicknode_rpc_url

# Services
HELIUS_API_KEY=your_helius_api_key
CRON_SECRET=a_very_secure_secret_password
```

## 2. Database Schema

Run the following SQL in your Supabase SQL Editor to create the necessary tables. The `IF NOT EXISTS` clauses make the script safe to run multiple times.

```sql
-- Stores the total wallet value at the start of each day (00:00 UTC)
CREATE TABLE IF NOT EXISTS daily_balances (
    id SERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    balance_date DATE NOT NULL,
    start_of_day_balance_usd DECIMAL(20, 8) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(wallet_address, balance_date)
);

-- (Optional but Recommended) Stores hourly token prices for resilience
CREATE TABLE IF NOT EXISTS price_snapshots (
    id SERIAL PRIMARY KEY,
    token_address TEXT NOT NULL,
    price_usd DECIMAL(20, 8) NOT NULL,
    snapshot_hour TIMESTAMP WITH TIME ZONE NOT NULL,
    source TEXT, -- e.g., 'dexscreener', 'coingecko'
    UNIQUE(token_address, snapshot_hour)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_balances_wallet_date ON daily_balances(wallet_address, balance_date);
CREATE INDEX IF NOT EXISTS idx_price_snapshots_token_hour ON price_snapshots(token_address, snapshot_hour);
```

## 3. Daily Cron Job (CRITICAL)

To calculate daily P&L, you **must** set up a cron job to take a snapshot of your wallet's balance at 00:00 UTC every day.

You can use a service like [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs) or [Supabase Scheduled Functions](https://supabase.com/docs/guides/functions/schedule-functions).

**Configuration:**
- **Schedule:** `0 0 * * *` (every day at midnight UTC)
- **Endpoint:** `https://your-app-url.com/api/pnl/snapshot`
- **Method:** `POST`
- **Body:**
  ```json
  {
    "walletAddress": "YOUR_WALLET_ADDRESS_HERE",
    "cronSecret": "the_very_secure_secret_password_from_your_env_file"
  }
  ```
  *Note: For a multi-user app, you would need a more advanced system to trigger this for all active wallets.*

## How It Works
1.  **Daily Snapshot:** At 00:00 UTC, the cron job calls the `/api/pnl/snapshot` endpoint. This calculates the total USD value of your wallet and saves it as `start_of_day_balance_usd` for the new day.
2.  **UI Display:** When you open the app, the "P&L" tab calls `/api/pnl/today`.
3.  **P&L Calculation:** This endpoint fetches the `start_of_day_balance_usd` and compares it to your wallet's current real-time value. It then calculates the P&L percentage and USD change for the day.
4.  **Excluding Transfers:** The logic is designed to ignore external deposits and withdrawals, ensuring the P&L reflects only your trading performance and market changes. (Note: This part is a work-in-progress and currently disabled to prevent errors).

Once these steps are complete, your P&L tracker is ready! 