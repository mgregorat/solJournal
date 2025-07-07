import { createClient } from '@supabase/supabase-js';
import { getTokenHoldings } from './portfolio';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase URL and Service Key are required for P&L operations. Check your .env.local file.');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

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

export interface PortfolioHoldingHistory {
  id?: number;
  wallet_address: string;
  token_mint: string;
  amount: number;
  price_usd: number;
  total_value_usd: number;
  snapshot_timestamp: string;
}

/**
 * Classifies a transaction based on Helius data
 */
export function classifyTransaction(transaction: any, walletAddress: string): TransactionClassification {
  const signature = transaction.signature;
  const timestamp = new Date(transaction.timestamp * 1000).toISOString();
  
  // Default classification
  let classification: TransactionClassification = {
    wallet_address: walletAddress,
    transaction_signature: signature,
    transaction_type: 'transfer_out',
    affects_pnl: false,
    transaction_date: timestamp,
  };

  // Check for swap/trade patterns
  if (transaction.description?.toLowerCase().includes('swap') || 
      transaction.type === 'SWAP' ||
      transaction.events?.swap) {
    classification.transaction_type = 'trade';
    classification.affects_pnl = true;
    classification.classification_notes = 'Detected as DEX swap/trade';
    return classification;
  }

  // Check for token transfers
  if (transaction.tokenTransfers && transaction.tokenTransfers.length > 0) {
    const transfers = transaction.tokenTransfers;
    const hasIncoming = transfers.some((t: any) => t.toUserAccount === walletAddress);
    const hasOutgoing = transfers.some((t: any) => t.fromUserAccount === walletAddress);

    if (hasIncoming && !hasOutgoing) {
      classification.transaction_type = 'transfer_in';
      classification.affects_pnl = false;
      classification.classification_notes = 'Incoming token transfer';
    } else if (hasOutgoing && !hasIncoming) {
      classification.transaction_type = 'transfer_out';
      classification.affects_pnl = false;
      classification.classification_notes = 'Outgoing token transfer';
    } else if (hasIncoming && hasOutgoing) {
      // Could be a swap or complex transaction
      classification.transaction_type = 'trade';
      classification.affects_pnl = true;
      classification.classification_notes = 'Complex transaction with both incoming and outgoing transfers';
    }
  }

  // Check for SOL transfers
  if (transaction.nativeTransfers && transaction.nativeTransfers.length > 0) {
    const nativeTransfers = transaction.nativeTransfers;
    const hasIncoming = nativeTransfers.some((t: any) => t.toUserAccount === walletAddress);
    const hasOutgoing = nativeTransfers.some((t: any) => t.fromUserAccount === walletAddress);

    if (hasIncoming && !hasOutgoing && !transaction.tokenTransfers?.length) {
      classification.transaction_type = 'transfer_in';
      classification.affects_pnl = false;
      classification.classification_notes = 'Incoming SOL transfer';
    } else if (hasOutgoing && !hasIncoming && !transaction.tokenTransfers?.length) {
      classification.transaction_type = 'transfer_out';
      classification.affects_pnl = false;
      classification.classification_notes = 'Outgoing SOL transfer';
    }
  }

  return classification;
}

/**
 * Fetches and classifies recent transactions for a wallet
 */
export async function fetchAndClassifyTransactions(walletAddress: string, limit: number = 100): Promise<TransactionClassification[]> {
  try {
    const response = await fetch(`https://api.helius.xyz/v0/addresses/${walletAddress}/transactions?api-key=${process.env.HELIUS_API_KEY}&limit=${limit}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch transactions from Helius');
    }

    const transactions = await response.json();
    const classifications: TransactionClassification[] = [];

    for (const tx of transactions) {
      const classification = classifyTransaction(tx, walletAddress);
      classifications.push(classification);
    }

    return classifications;
  } catch (error) {
    console.error('Error fetching and classifying transactions:', error);
    return [];
  }
}

/**
 * Saves transaction classifications to the database
 */
export async function saveTransactionClassifications(classifications: TransactionClassification[]): Promise<void> {
  try {
    const { error } = await supabase
      .from('transaction_classifications')
      .upsert(classifications, { 
        onConflict: 'transaction_signature',
        ignoreDuplicates: true 
      });

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error saving transaction classifications:', error);
    throw error;
  }
}

/**
 * Calculates portfolio value at a specific timestamp
 */
export async function calculatePortfolioValue(walletAddress: string, timestamp?: Date): Promise<number> {
  try {
    const { holdings } = await getTokenHoldings(walletAddress);
    let totalValue = 0;

    for (const holding of holdings) {
      totalValue += holding.currentValueUSD || 0;
    }

    return totalValue;
  } catch (error) {
    console.error('Error calculating portfolio value:', error);
    return 0;
  }
}

/**
 * Creates or updates a daily snapshot
 */
export async function createDailySnapshot(walletAddress: string, date: Date): Promise<DailySnapshot> {
  const dateString = date.toISOString().split('T')[0];
  
  try {
    // Calculate portfolio value
    const portfolioValue = await calculatePortfolioValue(walletAddress, date);
    
    // Check if snapshot already exists
    const { data: existingSnapshot } = await supabase
      .from('daily_snapshots')
      .select('*')
      .eq('wallet_address', walletAddress)
      .eq('snapshot_date', dateString)
      .single();

    if (existingSnapshot) {
      // Update existing snapshot
      const { data, error } = await supabase
        .from('daily_snapshots')
        .update({
          end_balance_usd: portfolioValue,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSnapshot.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      // Create new snapshot
      const { data, error } = await supabase
        .from('daily_snapshots')
        .insert({
          wallet_address: walletAddress,
          snapshot_date: dateString,
          start_balance_usd: portfolioValue,
          end_balance_usd: portfolioValue
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  } catch (error) {
    console.error('Error creating daily snapshot:', error);
    throw error;
  }
}

/**
 * Calculates and updates P&L for a specific date
 */
export async function calculateDailyPnL(walletAddress: string, date: Date): Promise<DailySnapshot | null> {
  const dateString = date.toISOString().split('T')[0];
  
  try {
    // Get the snapshot for this date
    const { data: snapshot, error } = await supabase
      .from('daily_snapshots')
      .select('*')
      .eq('wallet_address', walletAddress)
      .eq('snapshot_date', dateString)
      .single();

    if (error || !snapshot) {
      console.log('No snapshot found for date:', dateString);
      return null;
    }

    // Calculate P&L percentage
    const startBalance = snapshot.start_balance_usd;
    const endBalance = snapshot.end_balance_usd || startBalance;
    
    let pnlPercent = 0;
    if (startBalance > 0) {
      pnlPercent = ((endBalance - startBalance) / startBalance) * 100;
    }

    // Update the snapshot with P&L
    const { data: updatedSnapshot, error: updateError } = await supabase
      .from('daily_snapshots')
      .update({
        pnl_percent: pnlPercent,
        updated_at: new Date().toISOString()
      })
      .eq('id', snapshot.id)
      .select()
      .single();

    if (updateError) throw updateError;
    return updatedSnapshot;
  } catch (error) {
    console.error('Error calculating daily P&L:', error);
    return null;
  }
}

/**
 * Gets daily P&L data for a wallet over a date range
 */
export async function getDailyPnLData(walletAddress: string, startDate: Date, endDate: Date): Promise<DailySnapshot[]> {
  try {
    const { data, error } = await supabase
      .from('daily_snapshots')
      .select('*')
      .eq('wallet_address', walletAddress)
      .gte('snapshot_date', startDate.toISOString().split('T')[0])
      .lte('snapshot_date', endDate.toISOString().split('T')[0])
      .order('snapshot_date', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting daily P&L data:', error);
    return [];
  }
}

/**
 * Rebuilds P&L snapshots for a specific date (utility function)
 */
export async function rebuildDailySnapshot(walletAddress: string, date: Date): Promise<DailySnapshot | null> {
  try {
    // Delete existing snapshot
    await supabase
      .from('daily_snapshots')
      .delete()
      .eq('wallet_address', walletAddress)
      .eq('snapshot_date', date.toISOString().split('T')[0]);

    // Create new snapshot
    const newSnapshot = await createDailySnapshot(walletAddress, date);
    
    // Calculate P&L
    return await calculateDailyPnL(walletAddress, date);
  } catch (error) {
    console.error('Error rebuilding daily snapshot:', error);
    return null;
  }
} 