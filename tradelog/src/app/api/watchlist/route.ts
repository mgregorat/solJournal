import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import { getBrowser } from '@/lib/browser'; // Use the shared browser instance
import { requireUser } from '@/app/lib/authorization';
import { throwHttp, withTiming } from '@/app/lib/http';

// Define types for the watchlist items
interface WatchlistItem {
    token_address: string;
}

const getLaunchOptions = () => {
    const isProduction = process.env.NODE_ENV === 'production';
    const options = {
        headless: true,
        protocolTimeout: 90000, // Increase timeout to 90 seconds
    };

    if (isProduction) {
        return {
            ...options,
            executablePath: '/usr/bin/chromium-browser',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        };
    }
    
    return { headless: true };
};


// The fetchTokenDetails function is no longer needed, we'll do this in the GET handler.

// GET /api/watchlist (bearer-auth scoped)
export async function GET(request: NextRequest) {
    return withTiming(request, async () => {
        const dbUser = await requireUser(request);

        const { data: watchlistItems, error } = await supabaseAdmin
            .from('watchlist')
            .select('token_address')
            .eq('user_id', dbUser.id);

        if (error) {
            throwHttp("internal_error", "Failed to fetch watchlist", 500);
        }

        const typedWatchlistItems = watchlistItems as WatchlistItem[];
        const mints = typedWatchlistItems.map(item => item.token_address);
        
        if (mints.length === 0) {
            return [];
        }

        // --- HIGH-PERFORMANCE BROWSER FETCH ---
        // We create ONE page to handle all fetches in parallel inside the browser.
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
                        .catch(() => null) // Catch fetch errors for individual tokens
                );
                return Promise.all(promises);
            }, mints);
            
            // Now, process the results from the browser on our server
            const successfulItems = allTokensData.map((data, index) => {
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
                    mint: mints[index],
                    symbol: pair.baseToken.symbol || 'Unknown',
                    name: pair.baseToken.name || 'Unknown',
                    price: parseFloat(pair.priceUsd || '0'),
                    volume: parseFloat(pair.volume?.h24 || '0'),
                    priceChange: priceChanges['24h'],
                    priceChanges: priceChanges,
                    liquidity: parseFloat(pair.liquidity?.usd || '0'),
                    marketCap: parseFloat(pair.marketCap || pair.fdv || '0'),
                    imageUrl: pair.info?.imageUrl || null,
                    pairAddress: pair.pairAddress,
                    dexId: pair.dexId,
                    url: pair.url,
                    alerts: {
                        priceChange: { percentage: 10, direction: 'up', isActive: false },
                        volumeSpike: { percentage: 50, isActive: false },
                    }
                };
            }).filter(Boolean); // Filter out any nulls from failed fetches

            return successfulItems;

        } catch(e) {
            throwHttp("provider_unavailable", "Failed to fetch watchlist token data", 502);
        } finally {
            await page.close();
        }
    });
}

// POST /api/watchlist
export async function POST(request: NextRequest) {
  return withTiming(request, async () => {
    const dbUser = await requireUser(request);
    const { token_address } = await request.json();

    if (!token_address) {
      throwHttp("bad_request", "token_address is required", 400);
    }

    const { data, error } = await supabaseAdmin
      .from('watchlist')
      .insert({ user_id: dbUser.id, token_address })
      .select()
      .single();

    if (error) {
      // Handle unique constraint violation gracefully
      if (error.code === '23505') {
        throwHttp("conflict", "Token already in watchlist", 409);
      }
      throwHttp("internal_error", "Failed to add to watchlist", 500);
    }

    return data;
  });
}

// DELETE /api/watchlist
export async function DELETE(request: NextRequest) {
    return withTiming(request, async () => {
        const dbUser = await requireUser(request);
        const { token_address } = await request.json();

        if (!token_address) {
            throwHttp("bad_request", "token_address is required", 400);
        }

        const { error } = await supabaseAdmin
            .from('watchlist')
            .delete()
            .eq('user_id', dbUser.id)
            .eq('token_address', token_address);

        if (error) {
            throwHttp("internal_error", "Failed to remove from watchlist", 500);
        }

        return { success: true };
    });
}
