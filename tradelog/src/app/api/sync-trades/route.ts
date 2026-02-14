import { NextRequest } from "next/server";
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import { Trade } from '@/lib/types';
import { throwHttp, withTiming } from '@/app/lib/http';

export const dynamic = "force-dynamic";

interface TokenTransfer {
    mint: string;
    tokenAmount: number;
    fromUserAccount: string;
    toUserAccount: string;
}

interface HeliusTransaction {
    signature: string;
    timestamp: number;
    description?: string;
    tokenTransfers?: TokenTransfer[];
    tokenSymbol?: string;
    events?: {
        swap?: any;
    };
}

// Fetches the Jupiter strict token list and creates a map for easy lookups.
async function getTokenMap(): Promise<Map<string, { symbol: string; name: string; }>> {
    try {
        const response = await fetch('https://token.jup.ag/strict');
        if (!response.ok) {
            console.error("Failed to fetch token list from Jupiter, status:", response.status);
            return new Map();
        }
        const tokens = await response.json();
        const tokenMap = new Map();
        for (const token of tokens) {
            tokenMap.set(token.address, { symbol: token.symbol, name: token.name });
        }
        return tokenMap;
    } catch (e) {
        console.error("Failed to fetch or process token list from Jupiter", e);
        return new Map(); // Return empty map on failure
    }
}

const solPriceCache = new Map<string, number>();
async function getSolPrice(date: string): Promise<number> {
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

const SOL_MINT_ADDRESS = 'So11111111111111111111111111111111111111112';

const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;

export async function POST(req: NextRequest) {
  return withTiming(req, async () => {
    const { walletAddress } = await req.json();
    if (!walletAddress) {
      throwHttp("bad_request", "Wallet address is required", 400);
    }

    const tokenMap = await getTokenMap();
    const supabase = supabaseAdmin;

    const enhancedTransactions = await getEnhancedTransactions(walletAddress, tokenMap);

    if (!enhancedTransactions || enhancedTransactions.length === 0) {
        return { trades: [], message: "No new trades to sync." };
    }

    const tradesForDb = enhancedTransactions.map(trade => {
        let trade_type: 'buy' | 'sell' | undefined;
        let amount: number | null = null;
        let total_value: number | null = null; // This will be in SOL
        let token_address: string | undefined;
        let token_symbol: string | undefined;

        if (trade.tokenTransfers) {
            const solTransfer = trade.tokenTransfers.find((t: any) => t.mint === SOL_MINT_ADDRESS);
            const otherTokenTransfer = trade.tokenTransfers.find((t: any) => t.mint !== SOL_MINT_ADDRESS);

            if (solTransfer && otherTokenTransfer) {
                token_address = otherTokenTransfer.mint;
                token_symbol = trade.tokenSymbol; // Using the symbol we added in getEnhancedTransactions
                amount = otherTokenTransfer.tokenAmount;

                if (solTransfer.fromUserAccount === walletAddress) {
                    trade_type = 'buy';
                    total_value = solTransfer.tokenAmount;
                } else if (solTransfer.toUserAccount === walletAddress) {
                    trade_type = 'sell';
                    total_value = solTransfer.tokenAmount;
                }
            }
        }

        if (!trade_type || !token_address || amount === null || total_value === null) {
            return null; // Will be filtered out
        }

        const priceInSol = total_value > 0 && amount > 0 ? total_value / amount : 0;

        return {
            wallet_address: walletAddress,
            token_symbol: token_symbol,
            token_address: token_address,
            trade_type: trade_type,
            amount: amount,
            price: priceInSol, // Price of token in SOL
            total_value: total_value, // Total value in SOL
            trade_date: new Date(trade.timestamp * 1000).toISOString(),
            source: 'JUPITER',
            transaction_hash: trade.signature,
        };
    }).filter(Boolean) as Partial<Trade>[];

    if (tradesForDb.length === 0) {
        return { message: "No new valid trades to sync." };
    }

    // Fetch historical prices for all trades at once
    const uniqueDates = [...new Set(tradesForDb.map(t => {
        const tradeDate = t.trade_date;
        if (!tradeDate) return null;
        return new Date(tradeDate).toISOString().split('T')[0].split('-').reverse().join('-');
    }).filter(Boolean) as string[])];

    const pricePromises = uniqueDates.map(date => 
        getSolPrice(date).then(price => ({ date, price }))
    );
    const priceResults = await Promise.all(pricePromises);
    
    const priceMap = new Map<string, number>();
    priceResults.forEach(p => {
        priceMap.set(p.date, p.price);
    });

    const tradesWithUsdPrice = tradesForDb.map(trade => {
        const tradeDate = trade.trade_date;
        if (!tradeDate) return null;
        const date = new Date(tradeDate).toISOString().split('T')[0].split('-').reverse().join('-');
        const solPriceUsd = priceMap.get(date) ?? 0;

        const totalValueUsd = (trade.total_value || 0) * solPriceUsd;
        const priceUsd = (trade.price || 0) * solPriceUsd;

        return {
            ...trade,
            price: priceUsd,
            total_value: totalValueUsd,
        };
    }).filter(Boolean) as Partial<Trade>[];

    const { data, error } = await supabase
        .from('trades')
        .upsert(tradesWithUsdPrice, { onConflict: 'transaction_hash' })
        .select();

    if (error) {
        throwHttp("internal_error", "An error occurred while saving trades.", 500);
    }

    return { trades: data, message: "Trades synced successfully!" };
  });
}

// Helius Enhanced Transactions API - Get transactions for a specific address
async function getEnhancedTransactions(address: string, tokenMap: Map<string, { symbol: string; name: string; }>): Promise<HeliusTransaction[]> {
    const apiKey = process.env.HELIUS_API_KEY;
    if (!apiKey) {
      throw new Error("Helius API key is not configured");
    }
  
    const allNewTransactions: HeliusTransaction[] = [];
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

        const existingSignatures = new Set(existingTrades.map(t => t.transaction_hash));
        const newTransactionsInBatch = transactions.filter((tx: any) => !existingSignatures.has(tx.signature));
        
        allNewTransactions.push(...newTransactionsInBatch);

        // If the number of new transactions is less than the number fetched,
        // it means we found some old ones, so we can stop.
        if (newTransactionsInBatch.length < transactions.length) {
            break;
        }

        lastSignature = transactions[transactions.length - 1].signature;
    }

    if (allNewTransactions.length === 0) {
        return [];
    }

    // Add token symbols to each transaction for easier processing later
    return allNewTransactions.map((tx: any) => {
        let tokenSymbol = 'Unknown';

        // Find the non-SOL token transfer to identify the token mint
        if (tx.tokenTransfers) {
            const otherTokenTransfer = tx.tokenTransfers.find((t: any) => t.mint !== SOL_MINT_ADDRESS);
            if (otherTokenTransfer) {
                const tokenInfo = tokenMap.get(otherTokenTransfer.mint);
                if (tokenInfo) {
                    tokenSymbol = tokenInfo.symbol;
                }
            }
        }
        
        // Fallback to old parsing logic if the map fails
        if (tokenSymbol === 'Unknown' && tx.description) {
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
