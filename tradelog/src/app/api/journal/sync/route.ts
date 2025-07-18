import { NextResponse } from 'next/server';
import { connect } from 'puppeteer-real-browser';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import fs from 'fs';
import path from 'path';

function getGmgnConfig() {
  const configPath = path.join(process.cwd(), 'tradelog', 'gmgn_config.json');
  if (fs.existsSync(configPath)) {
    console.log('✅ Found gmgn_config.json. Using fresh credentials.');
    const rawData = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(rawData);
    console.log('Loaded config for sync:', config); // Log the loaded config
    return config;
  }
  // Fallback to default values if the config file doesn't exist.
  console.warn('⚠️ gmgn_config.json not found. Using fallback default values.');
  return {
    app_ver: '20250717-1241-47bc674',
    client_id: 'gmgn_web_20250717-1241-47bc674',
    device_id: '797ada39-37b1-46c2-8e8a-f813ac27ebad',
    fp_did: 'ffaa653dc5d83387b22ee019166ad927',
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Received request body:', body); // Added for detailed logging
    const { userId, walletAddress } = body;

    if (!userId || !walletAddress) {
      console.error('Validation Error: userId or walletAddress missing.', { userId, walletAddress });
      return NextResponse.json({ error: 'userId and walletAddress are required' }, { status: 400 });
    }

    // Step 1: Check the last sync time for the wallet
    const { data: walletData, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('last_synced_at')
      .eq('user_id', userId)
      .eq('wallet_address', walletAddress)
      .single();

    if (walletError) {
      console.error('Error fetching wallet sync time:', walletError);
      // If the wallet isn't found, we can proceed, but it's good to be aware.
    }

    let lastSyncedAt: Date | null = null;
    if (walletData?.last_synced_at) {
      lastSyncedAt = new Date(walletData.last_synced_at as string);
    }
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    if (lastSyncedAt && lastSyncedAt > fiveMinutesAgo) {
      console.log(`CACHE HIT: Wallet ${walletAddress} was synced recently. Skipping scrape.`);
      return NextResponse.json({ message: 'Sync skipped, data is fresh.', synced: 0 });
    }
    console.log(`CACHE MISS: Wallet ${walletAddress} needs syncing. Proceeding...`);


    const config = getGmgnConfig();
    const scraperUrl = `https://gmgn.ai/vas/api/v1/wallet_activity/sol?type=buy&type=sell&device_id=${config.device_id}&client_id=${config.client_id}&from_app=gmgn&app_ver=${config.app_ver}&tz_name=America%2FNew_York&tz_offset=-14400&app_lang=en-US&fp_did=${config.fp_did}&os=web&wallet=${walletAddress}&limit=50&cost=10`;

    console.log('Constructed Scraper URL:', scraperUrl);

    let browser;
    try {
      console.log('✅ Launching browser...');
      const { page, browser: browserInstance } = await connect({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        turnstile: true,
      });
      browser = browserInstance;

      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
      );

      console.log('✅ Navigating to establish context...');
      await page.goto(`https://gmgn.ai/sol/wallet/${walletAddress}`, {
        waitUntil: 'domcontentloaded',
      });
      
      console.log('✅ Fetching all trade data from gmgn.ai with pagination...');
      let allTrades: any[] = [];
      let nextCursor: string | null = null;

      do {
        const urlWithCursor: string = nextCursor ? `${scraperUrl}&cursor=${nextCursor}` : scraperUrl;
        console.log(`Fetching page with cursor: ${nextCursor || 'initial'}`);

        const jsonData: any = await page.evaluate(async (url) => {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return await res.json();
        }, urlWithCursor);

        const trades = jsonData?.data?.activities || [];
        if (trades.length > 0) {
          allTrades = allTrades.concat(trades);
        }
        
        nextCursor = jsonData?.data?.next;

      } while (nextCursor);

      if (allTrades.length === 0) {
        return NextResponse.json({ message: 'No new trades found on gmgn.ai.', synced: 0 });
      }

      console.log(`✅ Found a total of ${allTrades.length} trades across all pages. Syncing to database...`);
      
      const recordsToInsert = allTrades.map((trade: any) => ({
        user_id: userId,
        wallet_address: walletAddress,
        tx_hash: trade.tx_hash,
        trade_date: new Date(trade.timestamp * 1000), // Convert from seconds to ms
        event_type: trade.event_type,
        token_address: trade.token.address,
        token_symbol: trade.token.symbol,
        token_logo: trade.token.logo,
        token_amount: parseFloat(trade.token_amount),
        quote_token_address: trade.quote_token.token_address,
        quote_token_symbol: trade.quote_token.symbol,
        quote_amount: parseFloat(trade.quote_amount),
        cost_usd: parseFloat(trade.cost_usd),
        price_usd: parseFloat(trade.price_usd),
        gas_usd: parseFloat(trade.gas_usd),
        source: 'gmgn.ai',
        raw_data: trade,
      }));

      const { data, error } = await supabaseAdmin
        .from('synced_trades')
        .upsert(recordsToInsert, { onConflict: 'tx_hash', ignoreDuplicates: true })
        .select();

      if (error) {
        console.error('❌ Supabase error:', error);
        throw new Error(`Failed to insert trades: ${error.message}`);
      }

      // Step 4: Update the last_synced_at timestamp for the wallet
      const { error: updateError } = await supabaseAdmin
        .from('wallets')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('wallet_address', walletAddress);
      
      if (updateError) {
        console.error('Failed to update last_synced_at:', updateError);
        // Not a fatal error, but should be logged.
      }

      console.log('✅ Sync complete. Inserted records:', data);
      console.log('Successfully fetched from URL:', scraperUrl);
      return NextResponse.json({ message: 'Sync successful.', synced: data ? data.length : 0 });

    } catch (err: any) {
      console.error('❌ Scraper/DB error:', err.message);
      return NextResponse.json({ error: 'Failed to sync trade data', details: err.message }, { status: 500 });
    } finally {
      if (browser) {
        console.log('✅ Closing browser...');
        await browser.close();
      }
    }
  } catch (error) {
    console.error('Error reading request body:', error);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
} 