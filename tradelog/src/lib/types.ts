export type Trade = {
  id: number;
  user_id: string;
  wallet_address: string;
  token_symbol: string;
  token_address: string;
  trade_type: "buy" | "sell";
  amount: number;
  price: number;
  total_value: number;
  trade_date: string;
  notes?: string;
  emotion_tags?: string[];
  setup_id?: number;
  source?: string;
  transaction_hash?: string;
  created_at: string;
  updated_at?: string;
};

export interface Setup {
    id: number;
    user_id: string;
    name: string;
    description: string;
    created_at: string;
}

export interface Metrics {
    walletValue: number;
    allTimePnl: number;
    dailyPnl: number;
    dailyPnlPercentage: number;
}

export interface Holding {
    mint: string;
    amount: number;
    decimals: number;
    symbol?: string;
    name?: string;
    logoURI?: string;
    currentPrice?: number;
    currentValueUSD?: number;
    currentValueSOL?: number;
    avgEntryPrice?: number;
    totalCostBasis?: number;
    firstBuyDate?: string;
    unrealizedPnL?: number;
    pnlPercentage?: number;
    sparklineData?: number[];
    isNativeSOL?: boolean;
    historicalValueUSD?: number;
}

export interface User {
    id: string;
    email?: string;
    created_at: string;
    updated_at?: string;
}

export interface Wallet {
    id: number;
    user_id: string;
    wallet_address: string;
    created_at: string;
    updated_at?: string;
}

export interface WatchlistItem {
    id: number;
    user_id: string;
    token_address: string;
    created_at: string;
}

export interface TokenDetails {
    mint: string;
    symbol: string;
    name: string;
    price: number;
    volume: number;
    priceChange: number;
    priceChanges: {
        '5m': number;
        '1h': number;
        '6h': number;
        '24h': number;
    };
    liquidity: number;
    marketCap: number;
    imageUrl?: string | null;
    pairAddress?: string;
    dexId?: string;
    url?: string;
    alerts?: {
        priceChange: { percentage: number; direction: string; isActive: boolean };
        volumeSpike: { percentage: number; isActive: boolean };
    };
}

export interface DailySnapshot {
    id?: number;
    wallet_address: string;
    snapshot_date: string;
    start_balance_usd: number;
    end_balance_usd?: number;
    pnl_percent?: number;
    notes?: string;
    created_at?: string;
    updated_at?: string;
}

export interface TransactionClassification {
    id?: number;
    wallet_address: string;
    transaction_signature: string;
    transaction_type: 'trade' | 'transfer_in' | 'transfer_out' | 'mint' | 'burn' | 'airdrop';
    affects_pnl: boolean;
    token_mint?: string;
    amount?: number;
    usd_value?: number;
    transaction_date: string;
    classification_notes?: string;
} 