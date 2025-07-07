import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase URL and Service Key are required. Check your .env.local file.');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});


async function fetchTokenDetails(mintAddress: string) {
    try {
        const dexScreenerUrl = `https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`;
        const response = await fetch(dexScreenerUrl);

        if (!response.ok) {
            console.error(`DexScreener API request failed for ${mintAddress} with status: ${response.status}`);
            return null;
        }

        const data = await response.json();

        if (!data || !data.pairs || data.pairs.length === 0) {
            console.warn(`No pair data found for ${mintAddress}`);
            return null;
        }

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

        // Fetch details for all tokens in parallel
        const detailedWatchlist = await Promise.all(
            watchlistItems.map(item => fetchTokenDetails(item.token_address))
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
