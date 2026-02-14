import { NextRequest } from 'next/server';
import { connect } from 'puppeteer-real-browser';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import fs from 'fs';
import path from 'path';
import { requireOwnedWallet, requireUser } from '@/app/lib/authorization';
import { throwHttp, withTiming } from '@/app/lib/http';

function getGmgnConfig() {
  const configPath = path.join(process.cwd(), 'tradelog', 'gmgn_config.json');
  if (fs.existsSync(configPath)) {
    const rawData = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(rawData);
    return config;
  }
  return {
    app_ver: '20250717-1241-47bc674',
    client_id: 'gmgn_web_20250717-1241-47bc674',
    device_id: '797ada39-37b1-46c2-8e8a-f813ac27ebad',
    fp_did: 'ffaa653dc5d83387b22ee019166ad927',
  };
}

export async function POST(request: NextRequest) {
  return withTiming(request, async () => {
    const dbUser = await requireUser(request);
    const body = await request.json();
    const { walletId: walletIdRaw, walletAddress: walletAddressRaw, force } = body;

    const parsedWalletId =
      walletIdRaw !== undefined && walletIdRaw !== null && walletIdRaw !== ''
        ? parseInt(String(walletIdRaw), 10)
        : null;
    if (walletIdRaw !== undefined && walletIdRaw !== null && isNaN(parsedWalletId as number)) {
      throwHttp("bad_request", "Invalid walletId format", 400);
    }

    const ownedWallet = await requireOwnedWallet(
      request,
      dbUser,
      parsedWalletId,
      walletAddressRaw
    );
    const walletId = ownedWallet.id;
    const walletAddress = ownedWallet.wallet_address;

    // Step 1: Check the last sync time for the wallet
    const { data: walletData, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('last_synced_at')
      .eq('id', walletId)
      .single();

    if (walletError && walletError.code !== 'PGRST116') {
      throwHttp("internal_error", "Failed to fetch wallet sync time", 500);
    }

    let lastSyncedAt: Date | null = null;
    if (walletData?.last_synced_at) {
      lastSyncedAt = new Date(walletData.last_synced_at as string);
    }
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    if (!force && lastSyncedAt && lastSyncedAt > fiveMinutesAgo) {
      return {
        message: 'Sync skipped, data is fresh.',
        synced: 0,
        skipped: true,
        walletId,
        last_synced_at: walletData?.last_synced_at ?? null,
      };
    }


    const config = getGmgnConfig();
    const scraperUrl = `https://gmgn.ai/vas/api/v1/wallet_activity/sol?type=buy&type=sell&device_id=${config.device_id}&client_id=${config.client_id}&from_app=gmgn&app_ver=${config.app_ver}&tz_name=America%2FNew_York&tz_offset=-14400&app_lang=en-US&fp_did=${config.fp_did}&os=web&wallet=${walletAddress}&limit=50&cost=10`;

    let browser;
    try {
      const { page, browser: browserInstance } = await connect({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        turnstile: true,
      });
      browser = browserInstance;

      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
      );

      await page.goto(`https://gmgn.ai/sol/wallet/${walletAddress}`, {
        waitUntil: 'networkidle2',
      });
      
      await new Promise(r => setTimeout(r, 2000));

      let allTrades: any[] = [];
      let nextCursor: string | null = null;

      do {
        const urlWithCursor: string = nextCursor ? `${scraperUrl}&cursor=${nextCursor}` : scraperUrl;
        const jsonData: any = await page.evaluate(async (url) => {
          try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
          } catch (e: any) {
            return { error: e.message };
          }
        }, urlWithCursor);

        if (jsonData.error) {
             break;
        }

        const trades = jsonData?.data?.activities || [];
        if (trades.length > 0) {
          allTrades = allTrades.concat(trades);
        }
        
        nextCursor = jsonData?.data?.next;

      } while (nextCursor);

      if (allTrades.length === 0) {
        return { message: 'No new trades found on gmgn.ai.', synced: 0 };
      }
      
      const toNum = (v: unknown): number => {
        const n = typeof v === 'number' ? v : Number(v);
        return Number.isFinite(n) ? n : 0;
      };

      const recordsToInsert = allTrades
        .map((trade: any) => {
          const amount = toNum(trade.token_amount);
          const totalValue = toNum(trade.cost_usd);
          const directPrice = toNum(trade.price_usd);
          const derivedPrice = amount > 0 ? totalValue / amount : 0;
          const price = directPrice > 0 ? directPrice : derivedPrice;
          const eventType = trade.event_type === 'sell' ? 'sell' : 'buy';
          const tokenAddress = trade?.token?.address;
          const tokenSymbol = trade?.token?.symbol || 'UNKNOWN';
          const txHash = trade?.tx_hash;

          // Keep DB inserts clean: drop rows missing required identifiers.
          if (!txHash || !tokenAddress) {
            return null;
          }

          return {
            user_id: dbUser.id,
            wallet_id: walletId,
            wallet_address: walletAddress,
            transaction_hash: txHash,
            trade_date: new Date(trade.timestamp * 1000),
            trade_type: eventType,
            token_address: tokenAddress,
            token_symbol: tokenSymbol,
            amount,
            price,
            total_value: totalValue,
            source: 'gmgn.ai',
          };
        })
        .filter(Boolean);

      if (recordsToInsert.length === 0) {
        return { message: 'No valid trades found to sync.', synced: 0 };
      }
      const { data, error } = await supabaseAdmin
        .from('trades')
        .upsert(recordsToInsert, { onConflict: 'transaction_hash', ignoreDuplicates: true })
        .select();

      if (error) {
        throwHttp("internal_error", "Failed to sync trade data", 500);
      }

      // Step 4: Update the last_synced_at timestamp for the wallet
      const { error: updateError } = await supabaseAdmin
        .from('wallets')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', walletId);
      
      if (updateError) {
        throwHttp("internal_error", "Failed to update wallet sync timestamp", 500);
      }

      return { message: 'Sync successful.', synced: data ? data.length : 0 };

    } catch (err: any) {
      throwHttp("internal_error", "Failed to sync trade data", 500);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  });
} 
