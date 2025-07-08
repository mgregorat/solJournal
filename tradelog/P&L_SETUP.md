# Daily P&L Tracking System Setup Guide

## Overview
This implementation provides a comprehensive daily P&L tracking system similar to Robinhood's approach, distinguishing between market movements/trades (which affect P&L) and transfers (which don't affect P&L).

## 🗄️ Database Setup

### 1. Run Database Schema Updates
Execute the new tables in your Supabase database by running the updated `database-schema.sql`:

```sql
-- Daily portfolio snapshots for P&L tracking
CREATE TABLE daily_snapshots (
    id SERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    snapshot_date DATE NOT NULL,
    start_balance_usd DECIMAL(20, 8) NOT NULL,
    end_balance_usd DECIMAL(20, 8),
    pnl_percent DECIMAL(10, 4),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(wallet_address, snapshot_date)
);

-- Transaction classifications for P&L calculation
CREATE TABLE transaction_classifications (
    id SERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    transaction_signature TEXT NOT NULL,
    transaction_type TEXT NOT NULL, -- 'trade', 'transfer_in', 'transfer_out', 'mint', 'burn', 'airdrop'
    affects_pnl BOOLEAN NOT NULL DEFAULT true,
    token_mint TEXT,
    amount DECIMAL(20, 8),
    usd_value DECIMAL(20, 8),
    transaction_date TIMESTAMP NOT NULL,
    classification_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(transaction_signature)
);

-- Portfolio holdings at specific timestamps
CREATE TABLE portfolio_holdings_history (
    id SERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    token_mint TEXT NOT NULL,
    amount DECIMAL(20, 8) NOT NULL,
    price_usd DECIMAL(20, 8) NOT NULL,
    total_value_usd DECIMAL(20, 8) NOT NULL,
    snapshot_timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_daily_snapshots_wallet_date ON daily_snapshots(wallet_address, snapshot_date);
CREATE INDEX idx_transaction_classifications_wallet ON transaction_classifications(wallet_address);
CREATE INDEX idx_transaction_classifications_date ON transaction_classifications(transaction_date);
CREATE INDEX idx_portfolio_holdings_history_wallet_timestamp ON portfolio_holdings_history(wallet_address, snapshot_timestamp);
```

## 🔑 Environment Variables

### 2. Add Helius API Key
Add your Helius API key to your `.env.local` file:

```env
HELIUS_API_KEY=your_helius_api_key_here
```

**Note**: Make sure you already have your Supabase environment variables configured:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
```

You can get a free Helius API key at: https://helius.xyz/

## 🚀 How to Use

### 3. Access the P&L Dashboard
1. Connect your wallet
2. Click on the "P&L" tab in the sidebar (TrendingUp icon)
3. The P&L Dashboard will load with the following features:

### 4. Database Setup (Required)
**IMPORTANT**: You need to manually create the database tables in Supabase:

1. **Go to your Supabase Dashboard** → SQL Editor
2. **Copy and run the SQL** from the `database-schema.sql` file (the new tables at the bottom)
3. **Or copy this SQL** and run it in Supabase:

```sql
-- Daily portfolio snapshots for P&L tracking
CREATE TABLE daily_snapshots (
    id SERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    snapshot_date DATE NOT NULL,
    start_balance_usd DECIMAL(20, 8) NOT NULL,
    end_balance_usd DECIMAL(20, 8),
    pnl_percent DECIMAL(10, 4),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(wallet_address, snapshot_date)
);

-- Transaction classifications for P&L calculation
CREATE TABLE transaction_classifications (
    id SERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    transaction_signature TEXT NOT NULL,
    transaction_type TEXT NOT NULL,
    affects_pnl BOOLEAN NOT NULL DEFAULT true,
    token_mint TEXT,
    amount DECIMAL(20, 8),
    usd_value DECIMAL(20, 8),
    transaction_date TIMESTAMP NOT NULL,
    classification_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(transaction_signature)
);

-- Portfolio holdings at specific timestamps
CREATE TABLE portfolio_holdings_history (
    id SERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    token_mint TEXT NOT NULL,
    amount DECIMAL(20, 8) NOT NULL,
    price_usd DECIMAL(20, 8) NOT NULL,
    total_value_usd DECIMAL(20, 8) NOT NULL,
    snapshot_timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_daily_snapshots_wallet_date ON daily_snapshots(wallet_address, snapshot_date);
CREATE INDEX idx_transaction_classifications_wallet ON transaction_classifications(wallet_address);
CREATE INDEX idx_transaction_classifications_date ON transaction_classifications(transaction_date);
CREATE INDEX idx_portfolio_holdings_history_wallet_timestamp ON portfolio_holdings_history(wallet_address, snapshot_timestamp);
```

### 5. Using the P&L System
After creating the tables:
1. **Test Database**: Visit the P&L tab - it will automatically test the database connection
2. **Classify Transactions**: Click "Classify Transactions" to analyze your recent transactions  
3. **Create Snapshot**: Click "Create Snapshot" to create your first daily portfolio snapshot

## 📊 Features

### Transaction Classification
The system automatically classifies transactions as:
- ✅ **Trades** (affects P&L): DEX swaps, token mints/burns, complex transactions
- ❌ **Transfers** (doesn't affect P&L): Simple SOL or token transfers in/out
- ❌ **Airdrops** (optional): Can be configured to affect P&L or not

### Daily Snapshots
- Captures portfolio value at start and end of each day
- Calculates P&L percentage: `((end_balance - start_balance) / start_balance) * 100`
- Tracks cumulative performance over time

### P&L Dashboard Components
1. **Summary Cards**: Current portfolio value, total P&L, tracking days
2. **Performance Chart**: Visual representation of daily P&L trends
3. **Recent Snapshots Table**: Detailed view of recent daily snapshots

## 🔧 API Endpoints

### Daily Snapshots
- `GET /api/pnl/daily-snapshot?walletAddress={address}&startDate={date}&endDate={date}`
- `POST /api/pnl/daily-snapshot` with actions: 'create', 'calculate', 'rebuild'

### Transaction Classification
- `POST /api/pnl/classify-transactions` - Fetches and classifies recent transactions

## 🛠️ Utility Functions

### Rebuild Snapshots
If you need to recalculate P&L for a specific date (e.g., due to price feed errors):

```typescript
await rebuildDailySnapshot(walletAddress, new Date('2024-01-15'));
```

### Manual Transaction Classification
You can manually adjust transaction classifications in the database if the automatic classification is incorrect.

## 📈 P&L Calculation Logic

### What Affects P&L:
- ✅ Market value changes of held tokens
- ✅ DEX trades and swaps
- ✅ Token mints and burns
- ✅ Complex transactions with both incoming/outgoing transfers

### What Doesn't Affect P&L:
- ❌ Simple SOL transfers in/out
- ❌ Simple token transfers in/out
- ❌ Deposits from external wallets
- ❌ Withdrawals to external wallets

## 🔄 Automated Daily Snapshots (Future Enhancement)

For production use, consider setting up a cron job or scheduled function to:
1. Create daily snapshots at 00:00 UTC
2. Update end-of-day values at 23:59 UTC
3. Calculate P&L for completed days

## 🐛 Troubleshooting

### Common Issues:
1. **No P&L data**: Make sure to create your first snapshot
2. **Incorrect classifications**: Check transaction details and manually adjust if needed
3. **API errors**: Verify Helius API key is correctly set
4. **Database errors**: Ensure all tables are created with proper permissions

### Debug Mode:
Check browser console and server logs for detailed error messages during API calls.

---

## 🎯 Next Steps

1. Run the database schema updates
2. Add your Helius API key
3. Connect your wallet and create your first snapshot
4. Start tracking your daily P&L performance!

The system is now ready to provide Robinhood-style P&L tracking that properly distinguishes between market movements and transfers. 