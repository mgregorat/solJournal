# Simple P&L Calendar Setup

## 🎯 **What You Get**
A **Kraken-style P&L calendar** that automatically tracks your daily portfolio performance:

- ✅ **Today's P&L percentage** prominently displayed
- ✅ **Calendar view** showing daily P&L for each day
- ✅ **Automatic tracking** - no manual snapshots needed
- ✅ **Color-coded days** - green for gains, red for losses
- ✅ **Month navigation** to view historical performance

## 🚀 **Setup (One-Time)**

### 1. Create Database Tables
Run this SQL in your **Supabase Dashboard** → **SQL Editor**:

```sql
-- Only need the daily_snapshots table for simple P&L tracking
CREATE TABLE IF NOT EXISTS daily_snapshots (
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

CREATE INDEX IF NOT EXISTS idx_daily_snapshots_wallet_date ON daily_snapshots(wallet_address, snapshot_date);
```

### 2. That's It!
No other setup required. The system automatically:
- 📊 Calculates your portfolio value
- 📅 Creates daily snapshots 
- 📈 Computes P&L percentages
- 🎨 Updates the calendar view

## 📱 **How to Use**

1. **Connect your wallet**
2. **Click the P&L tab** (TrendingUp icon in sidebar)
3. **View today's performance** at the top
4. **Browse the calendar** to see historical daily P&L
5. **Navigate months** using the arrow buttons

## 🎨 **Calendar Features**

- **Today's P&L**: Large percentage display with trend arrow
- **Portfolio Value**: Current total value in USD
- **Color Coding**:
  - 🟢 Green background = Positive P&L
  - 🔴 Red background = Negative P&L  
  - ⚪ Gray background = No data
- **Today Highlight**: Blue ring around today's date
- **Percentage Display**: Shows exact P&L % for each day

## 🔄 **How It Works**

The system automatically:
1. **Tracks your portfolio value** each day
2. **Compares today vs yesterday** to calculate P&L
3. **Updates in real-time** when you visit the P&L tab
4. **Stores historical data** for the calendar view

## 🎯 **Key Benefits**

- ✅ **Zero manual work** - completely automatic
- ✅ **Intuitive interface** - just like Kraken
- ✅ **Real-time updates** - always current
- ✅ **Historical tracking** - see your trading performance over time
- ✅ **Visual feedback** - instant understanding of your P&L trends

---

## 🚀 **Ready to Use!**

After running the SQL above, your P&L calendar will be ready to use. Just connect your wallet and click the P&L tab to start tracking your daily performance!

The system will automatically start building your P&L history from the first day you use it. 