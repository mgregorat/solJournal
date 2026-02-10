import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import { getBrowser } from '@/lib/browser';
import { fetchHoldings, fetchSOLBalance } from '@/lib/puppeteer-fetch';
import { Trade } from '@/lib/types';
import { Holding } from '@/lib/types';

// Helper function to fetch watchlist details (adapted from the original watchlist route)
async function getWatchlistDetails(userId: string) {
    const { data: watchlistItems, error } = await supabaseAdmin
        .from('watchlist')
        .select('token_address')
        .eq('user_id', userId);

    if (error) {
        console.error("Error fetching watchlist items:", error);
        return []; // Return empty array on error
    }

    const mints = watchlistItems.map(item => item.token_address);
    if (mints.length === 0) return [];

    const browser = await getBrowser();
    const page = await browser.newPage();
    const { PROXY_USERNAME, PROXY_PASSWORD } = process.env;
    if (PROXY_USERNAME && PROXY_PASSWORD) {
        await page.authenticate({ username: PROXY_USERNAME, password: PROXY_PASSWORD });
    }

    try {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        const allTokensData = await page.evaluate(async (mintsToFetch) => {
            const promises = mintsToFetch.map(mint =>
                fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`)
                    .then(res => res.ok ? res.json() : null)
                    .catch(() => null)
            );
            return Promise.all(promises);
        }, mints);
        
        return allTokensData.map((data, index) => {
            if (!data || !data.pairs || data.pairs.length === 0) return null;
            const pair = data.pairs[0];
            if (!pair || !pair.baseToken) return null;
            const priceChanges = {
                '5m': parseFloat(pair.priceChange?.m5 || '0'),
                '1h': parseFloat(pair.priceChange?.h1 || '0'),
                '6h': parseFloat(pair.priceChange?.h6 || '0'),
                '24h': parseFloat(pair.priceChange?.h24 || '0')
            };
            return {
                mint: mints[index], symbol: pair.baseToken.symbol, name: pair.baseToken.name,
                price: parseFloat(pair.priceUsd || '0'), volume: parseFloat(pair.volume?.h24 || '0'),
                priceChange: priceChanges['24h'], priceChanges, liquidity: parseFloat(pair.liquidity?.usd || '0'),
                marketCap: parseFloat(pair.marketCap || pair.fdv || '0'), imageUrl: pair.info?.imageUrl || null,
                pairAddress: pair.pairAddress, dexId: pair.dexId, url: pair.url,
                alerts: { priceChange: { percentage: 10, direction: 'up', isActive: false }, volumeSpike: { percentage: 50, isActive: false } }
            };
        }).filter(Boolean);
    } finally {
        await page.close();
    }
}

// Helper to get user's wallets
async function getWallets(userId: string) {
    const { data, error } = await supabaseAdmin
        .from('wallets')
        .select('*')
        .eq('user_id', userId);
    if (error) {
        console.error("Error fetching wallets:", error);
        return [];
    }
    return data;
}

// Helper to get user's trades
async function getTrades(userId: string, walletId?: number | null) {
    let query = supabaseAdmin
        .from('trades')
        .select('*')
        .eq('user_id', userId)
        .order('trade_date', { ascending: false });
    
    if (walletId !== undefined && walletId !== null) {
        query = query.eq('wallet_id', walletId);
    }
    
    const { data, error } = await query;

    if (error) {
        console.error("Error fetching trades:", error);
        return [];
    }
    return data;
}


export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const walletAddress = searchParams.get('walletAddress');
    const walletIdStr = searchParams.get('walletId');

    if (!userId) {
        return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    try {
        const wallets = await getWallets(userId);
        const parsedWalletId = walletIdStr ? parseInt(walletIdStr, 10) : null;

        let targetWallets: any[] = [];
        if (parsedWalletId !== null && !isNaN(parsedWalletId)) {
            targetWallets = wallets.filter((w: any) => w.id === parsedWalletId);
        } else if (walletAddress) {
            targetWallets = wallets.filter((w: any) => w.wallet_address === walletAddress);
            if (targetWallets.length === 0) {
                targetWallets = [{ id: null, wallet_address: walletAddress }];
            }
        } else {
            targetWallets = wallets;
        }

        const holdingsByWallet = await Promise.allSettled(
            targetWallets.map(async (wallet: any) => {
                const [holdingsResult, solBalanceResult] = await Promise.allSettled([
                    fetchHoldings(wallet.wallet_address),
                    fetchSOLBalance(wallet.wallet_address),
                ]);
                return { wallet, holdingsResult, solBalanceResult };
            })
        );

        const [watchlistResult, tradesResult] = await Promise.allSettled([
            getWatchlistDetails(userId),
            getTrades(userId, parsedWalletId !== null && !isNaN(parsedWalletId) ? parsedWalletId : null),
        ]);

        let enrichedHoldings: Holding[] = [];
        const mergedByMint = new Map<string, Holding>();

        for (const walletResult of holdingsByWallet) {
            if (walletResult.status !== 'fulfilled') {
                console.error('Failed to fetch holdings for wallet:', walletResult.reason);
                continue;
            }

            const { holdingsResult, solBalanceResult } = walletResult.value;

            if (holdingsResult.status === 'fulfilled') {
                const rawHoldings = holdingsResult.value?.data?.holdings;
                if (rawHoldings && Array.isArray(rawHoldings)) {
                    for (const h of rawHoldings) {
                        if (parseFloat(h.balance) <= 1e-9) continue;

                        const mint = h.token.address;
                        const amount = parseFloat(h.balance);
                        const decimals = h.token.decimals;
                        const symbol = h.token.symbol;
                        const name = h.token.name;
                        const logoURI = h.token.logo;
                        const currentPrice = parseFloat(h.price);
                        const currentValueUSD = parseFloat(h.usd_value);
                        const totalCostBasis = parseFloat(h.cost);
                        const unrealizedPnL = parseFloat(h.unrealized_profit);

                        const existing = mergedByMint.get(mint);
                        if (!existing) {
                            mergedByMint.set(mint, {
                                mint,
                                amount,
                                decimals,
                                symbol,
                                name,
                                logoURI,
                                currentPrice,
                                currentValueUSD,
                                avgEntryPrice: amount > 0 ? totalCostBasis / amount : 0,
                                totalCostBasis,
                                unrealizedPnL,
                                pnlPercentage: totalCostBasis > 0 ? (unrealizedPnL / totalCostBasis) * 100 : 0,
                            });
                        } else {
                            const nextAmount = (existing.amount || 0) + amount;
                            const nextCost = (existing.totalCostBasis || 0) + totalCostBasis;
                            const nextUnrealized = (existing.unrealizedPnL || 0) + unrealizedPnL;
                            const nextValue = (existing.currentValueUSD || 0) + currentValueUSD;
                            mergedByMint.set(mint, {
                                ...existing,
                                amount: nextAmount,
                                currentValueUSD: nextValue,
                                totalCostBasis: nextCost,
                                unrealizedPnL: nextUnrealized,
                                avgEntryPrice: nextAmount > 0 ? nextCost / nextAmount : 0,
                                pnlPercentage: nextCost > 0 ? (nextUnrealized / nextCost) * 100 : 0,
                                currentPrice,
                            });
                        }
                    }
                }
            }

            if (solBalanceResult.status === 'fulfilled' && solBalanceResult.value) {
                const sol = solBalanceResult.value;
                const solMint = 'So11111111111111111111111111111111111111112';
                const existingSol = mergedByMint.get(solMint);
                if (!existingSol) {
                    mergedByMint.set(solMint, {
                        mint: solMint,
                        amount: sol.sol_balance,
                        decimals: 9,
                        symbol: 'SOL',
                        name: 'Solana',
                        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
                        currentPrice: sol.price_per_sol,
                        currentValueUSD: sol.usd_value,
                        isNativeSOL: true,
                    });
                } else {
                    mergedByMint.set(solMint, {
                        ...existingSol,
                        amount: (existingSol.amount || 0) + sol.sol_balance,
                        currentValueUSD: (existingSol.currentValueUSD || 0) + sol.usd_value,
                        currentPrice: sol.price_per_sol,
                        isNativeSOL: true,
                    });
                }
            }
        }

        enrichedHoldings = Array.from(mergedByMint.values());
        const solIdx = enrichedHoldings.findIndex(h => h.mint === 'So11111111111111111111111111111111111111112');
        if (solIdx > 0) {
            const [sol] = enrichedHoldings.splice(solIdx, 1);
            enrichedHoldings.unshift(sol);
        }
        
        return NextResponse.json({
            holdings: enrichedHoldings,
            watchlist: watchlistResult.status === 'fulfilled' ? watchlistResult.value : [],
            wallets,
            trades: tradesResult.status === 'fulfilled' ? tradesResult.value : [],
        });

    } catch (error: any) {
        console.error('Master Dashboard API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
    }
} 
