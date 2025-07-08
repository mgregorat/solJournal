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