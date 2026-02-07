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
async function getTrades(userId: string) {
    const { data, error } = await supabaseAdmin
        .from('trades')
        .select('*')
        .eq('user_id', userId)
        .order('trade_date', { ascending: false });

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

    if (!userId || !walletAddress) {
        return NextResponse.json({ error: 'user_id and walletAddress are required' }, { status: 400 });
    }

    try {
        const [holdingsResult, solBalanceResult, watchlistResult, walletsResult, tradesResult] = await Promise.allSettled([
            fetchHoldings(walletAddress),
            fetchSOLBalance(walletAddress),
            getWatchlistDetails(userId),
            getWallets(userId),
            getTrades(userId),
        ]);

        let enrichedHoldings: Holding[] = [];
        if (holdingsResult.status === 'fulfilled') {
            console.log('Successfully fetched holdings data:', JSON.stringify(holdingsResult.value, null, 2));

            const rawHoldings = holdingsResult.value?.data?.holdings;
            if (rawHoldings && Array.isArray(rawHoldings)) {
                enrichedHoldings = rawHoldings
                    .filter((h: any) => parseFloat(h.balance) > 1e-9)
                    .map((h: any) => ({
                        mint: h.token.address, amount: parseFloat(h.balance), decimals: h.token.decimals,
                        symbol: h.token.symbol, name: h.token.name, logoURI: h.token.logo,
                        currentPrice: parseFloat(h.price), currentValueUSD: parseFloat(h.usd_value),
                        avgEntryPrice: parseFloat(h.avg_cost), totalCostBasis: parseFloat(h.cost),
                        unrealizedPnL: parseFloat(h.unrealized_profit), pnlPercentage: parseFloat(h.unrealized_pnl) * 100
                    }));
            } else {
                console.log('Holdings data is not in the expected format or is empty.');
            }
        } else {
            console.error('Failed to fetch holdings:', holdingsResult.reason);
        }
        if (solBalanceResult.status === 'fulfilled' && solBalanceResult.value) {
            enrichedHoldings.unshift({
                mint: 'So11111111111111111111111111111111111111112',
                amount: solBalanceResult.value.sol_balance, decimals: 9, symbol: 'SOL', name: 'Solana',
                logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
                currentPrice: solBalanceResult.value.price_per_sol, currentValueUSD: solBalanceResult.value.usd_value, isNativeSOL: true
            });
        }
        
        return NextResponse.json({
            holdings: enrichedHoldings,
            watchlist: watchlistResult.status === 'fulfilled' ? watchlistResult.value : [],
            wallets: walletsResult.status === 'fulfilled' ? walletsResult.value : [],
            trades: tradesResult.status === 'fulfilled' ? tradesResult.value : [],
        });

    } catch (error: any) {
        console.error('Master Dashboard API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
    }
} 