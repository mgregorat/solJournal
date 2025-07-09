import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import puppeteer from 'puppeteer';

// Define types for the watchlist items
interface WatchlistItem {
    token_address: string;
}

const getLaunchOptions = () => {
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
        return {
            headless: true,
            executablePath: '/usr/bin/chromium-browser',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        };
    }
    // For local development
    return { headless: true };
};


async function fetchTokenDetails(mintAddress: string) {
    // This is the core logic from the watchlist-token-details route
    const browser = await puppeteer.launch(getLaunchOptions());
    const page = await browser.newPage();
    try {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        const dexScreenerUrl = `https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`;
        const data = await page.evaluate(async (url) => {
            const response = await fetch(url);
            if (!response.ok) return null;
            return await response.json();
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
        await browser.close();
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

        // Type assertion to ensure proper typing
        const typedWatchlistItems = watchlistItems as WatchlistItem[];

        // Fetch details for all tokens in parallel
        const detailedWatchlist = await Promise.all(
            typedWatchlistItems.map(item => fetchTokenDetails(item.token_address))
        );

        // Filter out any tokens for which details couldn't be fetched
        const successfulItems = detailedWatchlist.filter(Boolean);

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
