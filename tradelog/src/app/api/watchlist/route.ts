import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import { getBrowser } from '@/lib/browser'; // Use the shared browser instance

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


async function fetchTokenDetails(mintAddress: string) {
    const browser = await getBrowser();
    const page = await browser.newPage(); // Use a new page from the shared browser

    const { PROXY_USERNAME, PROXY_PASSWORD } = process.env;
    if (PROXY_USERNAME && PROXY_PASSWORD) {
        await page.authenticate({ username: PROXY_USERNAME, password: PROXY_PASSWORD });
    }
    
    try {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        const dexScreenerUrl = `https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`;
        
        // Use page.evaluate to perform the fetch inside the browser context
        const data = await page.evaluate(async (url) => {
            try {
                const response = await fetch(url);
                if (!response.ok) return null;
                return await response.json();
            } catch (e) {
                // Errors inside evaluate don't bubble up well, so log them here
                console.error(`Error fetching from inside browser context for ${url}:`, e);
                return null;
            }
        }, dexScreenerUrl);

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
            mint: mintAddress,
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
    } catch (error) {
        console.error(`Error fetching details for ${mintAddress}:`, error);
        return null;
    } finally {
        await page.close(); // Close the page, not the browser
    }
}

// GET /api/watchlist?user_id=...
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const user_id = searchParams.get('user_id');

        if (!user_id) {
            return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
        }

        const { data: watchlistItems, error } = await supabaseAdmin
            .from('watchlist')
            .select('token_address')
            .eq('user_id', user_id);

        if (error) throw error;

        const typedWatchlistItems = watchlistItems as WatchlistItem[];
        
        // --- BATCH PROCESSING LOGIC ---
        // We process the tokens in small batches to avoid overwhelming the server
        // with too many concurrent Puppeteer pages.
        const BATCH_SIZE = 3;
        const allFetchedItems = [];

        console.log(`Fetching details for ${typedWatchlistItems.length} watchlist items in batches of ${BATCH_SIZE}...`);

        for (let i = 0; i < typedWatchlistItems.length; i += BATCH_SIZE) {
            const batch = typedWatchlistItems.slice(i, i + BATCH_SIZE);
            console.log(`Processing batch #${(i / BATCH_SIZE) + 1}...`);
            
            const batchPromises = batch.map(item => fetchTokenDetails(item.token_address));
            const batchResults = await Promise.all(batchPromises);
            
            allFetchedItems.push(...batchResults);
        }

        const successfulItems = allFetchedItems.filter(Boolean);

        return NextResponse.json(successfulItems);
    } catch (error: any) {
        console.error('Watchlist GET Error:', error);
        return NextResponse.json({ error: 'Failed to fetch watchlist' }, { status: 500 });
    }
}

// POST /api/watchlist
export async function POST(request: Request) {
  try {
    const { user_id, token_address } = await request.json();

    if (!user_id || !token_address) {
      return NextResponse.json({ error: 'user_id and token_address are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('watchlist')
      .insert({ user_id, token_address })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      // Handle unique constraint violation gracefully
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Token already in watchlist' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to add to watchlist' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Request error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

// DELETE /api/watchlist
export async function DELETE(request: Request) {
    try {
        const { user_id, token_address } = await request.json();

        if (!user_id || !token_address) {
            return NextResponse.json({ error: 'user_id and token_address are required' }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('watchlist')
            .delete()
            .eq('user_id', user_id)
            .eq('token_address', token_address);

        if (error) {
            console.error('Supabase error:', error);
            return NextResponse.json({ error: 'Failed to remove from watchlist' }, { status: 500 });
        }

        return NextResponse.json({ message: 'Successfully removed from watchlist' });
    } catch (error) {
        console.error('Request error:', error);
        return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
    }
}
