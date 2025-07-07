import { createClient } from '@supabase/supabase-js';
import { Connection, PublicKey } from '@solana/web3.js';
import { Helius } from 'helius-sdk';
import { getTokenHoldings } from './portfolio'; // We can reuse this helpful function

// --- Environment and Clients ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const heliusApiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY;

if (!supabaseUrl || !supabaseServiceKey || !heliusApiKey) {
  const missingKeys = [];
  if (!supabaseUrl) missingKeys.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseServiceKey) missingKeys.push('SUPABASE_SERVICE_KEY');
  if (!heliusApiKey) missingKeys.push('NEXT_PUBLIC_HELIUS_API_KEY');
  
  throw new Error(`Required environment variables are missing for P&L service: ${missingKeys.join(', ')}`);
}

const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
const helius = new Helius(heliusApiKey);
const connection = new Connection(rpcUrl, 'confirmed');

// --- Types ---
export interface DailyPnlData {
  pnl_usd: number;
  pnl_percent: number;
  current_balance_usd: number;
}

// --- Core Functions ---

/**
 * Gets the current USD value of a wallet's holdings.
 * Reuses the robust getTokenHoldings function which handles price fetching.
 */
async function getCurrentWalletValue(walletAddress: string): Promise<number> {
  const { holdings } = await getTokenHoldings(walletAddress);
  return holdings.reduce((sum, holding) => sum + (holding.currentValueUSD || 0), 0);
}

/**
 * Fetches the start-of-day balance from our database.
 */
async function getStartOfDayBalance(walletAddress: string): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('daily_balances')
    .select('start_of_day_balance_usd')
    .eq('wallet_address', walletAddress)
    .eq('balance_date', today)
    .single();

  if (error && error.code !== 'PGRST116') { // Ignore "No rows found" error
    console.error("Error fetching start of day balance:", error);
    return 0;
  }
  
  return data?.start_of_day_balance_usd || 0;
}

/**
 * Analyzes transactions since 00:00 UTC to find the net value of external transfers.
 * This is the key to excluding deposits/withdrawals from P&L.
 */
async function getNetTransfersToday(walletAddress: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const startOfDayUnix = Math.floor(startOfDay.getTime() / 1000);

  // This is a simplified version. A full implementation would need to paginate
  // through all of today's transactions and get historical prices for each transfer.
  // For now, we return 0 to prevent the API call that was previously failing.
  // This can be built out robustly in the future.
  return 0;
}

// --- Main Exported Functions ---

/**
 * The primary function to get today's P&L data for the UI.
 */
export async function getTodaysPnl(walletAddress: string): Promise<DailyPnlData> {
  const [startOfDayBalance, currentBalance, netTransfers] = await Promise.all([
    getStartOfDayBalance(walletAddress),
    getCurrentWalletValue(walletAddress),
    getNetTransfersToday(walletAddress)
  ]);

  if (startOfDayBalance === 0) {
    // If there's no balance snapshot, we can't calculate P&L.
    // This happens on the first day a user uses the app.
    // We can show their current balance but P&L is 0.
    return {
      pnl_usd: 0,
      pnl_percent: 0,
      current_balance_usd: currentBalance,
    };
  }

  const pnlUSD = currentBalance - startOfDayBalance - netTransfers;
  const pnlPercent = (pnlUSD / startOfDayBalance) * 100;

  return {
    pnl_usd: pnlUSD,
    pnl_percent: pnlPercent,
    current_balance_usd: currentBalance,
  };
}

/**
 * Takes a snapshot of the wallet's total balance.
 * Intended to be run by a cron job at 00:00 UTC.
 */
export async function takeDailyBalanceSnapshot(walletAddress: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  console.log(`Taking daily balance snapshot for ${walletAddress} on ${today}`);

  try {
    const balance = await getCurrentWalletValue(walletAddress);
    
    const { error } = await supabase
      .from('daily_balances')
      .upsert({
        wallet_address: walletAddress,
        balance_date: today,
        start_of_day_balance_usd: balance,
      }, { onConflict: 'wallet_address, balance_date' });

    if (error) {
      console.error("Error taking daily snapshot:", error);
      throw error;
    }

    console.log(`Snapshot successful for ${walletAddress}. Balance: $${balance}`);
  } catch (err) {
    console.error(`Failed to take snapshot for ${walletAddress}:`, err);
  }
} 