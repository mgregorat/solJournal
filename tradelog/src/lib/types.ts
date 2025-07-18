export interface Holding {
  mint: string;
  amount: number;
  decimals: number;
  symbol: string;
  name: string;
  logoURI?: string;
  currentPrice: number;
  currentValueUSD: number;
  avgEntryPrice?: number;
  totalCostBasis?: number;
  unrealizedPnL?: number;
  pnlPercentage?: number;
  isNativeSOL?: boolean;
}

export interface Trade {
  id?: number;
  user_id: string;
  wallet_address: string;
  tx_hash: string;
  trade_date: string;
  event_type: 'buy' | 'sell';
  token_address: string;
  token_symbol: string;
  token_logo?: string;
  token_amount: number;
  quote_token_address?: string;
  quote_token_symbol?: string;
  quote_amount: number;
  cost_usd: number;
  price_usd: number;
  gas_usd?: number;
  source: string;
  raw_data?: any;
}

export interface JournalEvent {
  id: string;
  status: 'CLOSED' | 'OPEN';
  token_symbol: string;
  token_logo?: string;
  token_address: string;
  date: string;
  sell_value_usd?: number;
  cost_basis_usd?: number;
  realized_pnl_usd?: number;
  realized_pnl_percent?: number;
  sell_tx_hash?: string;
  held_amount?: number;
  avg_buy_price?: number;
  total_cost?: number;
  current_price?: number;
  current_value_usd?: number;
  unrealized_pnl_usd?: number;
  unrealized_pnl_percent?: number;
  notes?: string | null;
  tags?: string[];
  is_flagged?: boolean;
}

export interface JournalPageProps {
  journalEvents: JournalEvent[];
  dbUser?: any;
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