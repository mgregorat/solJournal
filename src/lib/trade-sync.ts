// This file will house the core logic for fetching, processing, and saving trades.
// It will be used by both the interactive sync button and the background cron job.

import { supabaseAdmin } from './supabaseAdmin';

const SOL_MINT_ADDRESS = 'So11111111111111111111111111111111111111112';

const solPriceCache = new Map<string, number>();
export async function getSolPrice(date: string): Promise<number> {
  if (solPriceCache.has(date)) {
    return solPriceCache.get(date)!;
  }

  try {
    const url = `https://api.coingecko.com/api/v3/coins/solana/history?date=${date}`;
    const response = await fetch(url);
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Failed to fetch SOL price for date ${date}. Status: ${response.status}. Body: ${errorBody}`);
      return 0;
    }
    const data = await response.json();
    const price = data?.market_data?.current_price?.usd;
    if (price) {
      solPriceCache.set(date, price);
      return price;
    }
  } catch (e) {
    console.error(`Could not fetch SOL price for ${date}`, e);
  }
  return 0;
}

export async function getEnhancedTransactions(address: string) {
    const apiKey = process.env.HELIUS_API_KEY;
    if (!apiKey) {
      throw new Error("Helius API key is not configured");
    }
  
    const allNewTransactions: any[] = [];
    let lastSignature: string | undefined;
    
    // Fetch transactions in batches until we find one we've already saved
    while (true) {
        const url = `https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${apiKey}&limit=100&type=SWAP${lastSignature ? `&before=${lastSignature}` : ''}`;
        
        const response = await fetch(url);
    
        if (!response.ok) {
            const errorData = await response.json();
            console.error("Helius API Error:", errorData);
            throw new Error(`Failed to fetch transactions from Helius: ${errorData.error || response.statusText}`);
        }
    
        const transactions = await response.json();
        if (!transactions || transactions.length === 0) {
            break; // No more transactions
        }

        const signatures = transactions.map((tx: any) => tx.signature);
        const { data: existingTrades, error } = await supabaseAdmin
            .from('trades')
            .select('transaction_hash')
            .in('transaction_hash', signatures);

        if (error) {
            console.error("Error checking for existing trades:", error);
            throw new Error("Failed to check for existing trades in database.");
        }

        const existingSignatures = new Set(existingTrades.map((t:any) => t.transaction_hash));
        const newTransactionsInBatch = transactions.filter((tx: any) => !existingSignatures.has(tx.signature));
        
        allNewTransactions.push(...newTransactionsInBatch);

        if (newTransactionsInBatch.length < transactions.length) {
            console.log("Found existing trades, stopping sync to prevent duplicates.");
            break;
        }

        lastSignature = transactions[transactions.length - 1].signature;
    }

    if (allNewTransactions.length === 0) {
        return [];
    }

    return allNewTransactions.map((tx: any) => {
        let tokenSymbol = 'Unknown';
        if (tx.events.swap) {
            const swap = tx.events.swap;
            const tokenOutput = swap.tokenOutputs?.find((t: any) => t.mint !== SOL_MINT_ADDRESS);
            const tokenInput = swap.tokenInputs?.find((t: any) => t.mint !== SOL_MINT_ADDRESS);
            if (tokenOutput) {
            } else if (tokenInput) {
            }
        }
        if (tx.description) {
            const match = tx.description.match(/swapped \d+\.?\d* (\w+) for/);
            if (match && match[1] !== 'SOL') {
                tokenSymbol = match[1];
            } else {
                const match2 = tx.description.match(/for \d+\.?\d* (\w+)/);
                if (match2 && match2[1]) {
                    tokenSymbol = match2[1];
                }
            }
        }
        return { ...tx, tokenSymbol };
    });
}

// We'll move the functions here in the next steps. 