import { NextResponse } from 'next/server';
import { getBrowser } from '@/lib/browser';
import { Trade } from '@/lib/types';

const GMGN_API_URL = 'https://gmgn.ai/vas/api/v1/wallet_activity/sol?type=buy&type=sell&device_id=797ada39-37b1-46c2-8e8a-f813ac27ebad&client_id=gmgn_web_20250703-726-a45f941&from_app=gmgn&app_ver=20250703-726-a45f941&tz_name=America%2FNew_York&tz_offset=-14400&app_lang=en-US&fp_did=ffaa653dc5d83387b22ee019166ad927&os=web&limit=50&cost=10';

async function scrapeGmgn(walletAddress: string) {
    const browser = await getBrowser();
    const page = await browser.newPage();

    const { PROXY_USERNAME, PROXY_PASSWORD } = process.env;
    if (PROXY_USERNAME && PROXY_PASSWORD) {
        await page.authenticate({ username: PROXY_USERNAME, password: PROXY_PASSWORD });
    }

    try {
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
        );
        
        console.log(`Navigating to gmgn.ai wallet page for ${walletAddress} to establish context...`);
        await page.goto(`https://gmgn.ai/sol/wallet/${walletAddress}`, {
            waitUntil: 'domcontentloaded',
        });
        
        await new Promise(resolve => setTimeout(resolve, 3000));

        console.log('Fetching wallet activity from gmgn.ai API...');
        const jsonData = await page.evaluate(async (url, wallet) => {
            const fullUrl = `${url}&wallet=${wallet}`;
            const res = await fetch(fullUrl);
            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`HTTP ${res.status} on ${fullUrl}. Body: ${errorText}`);
            }
            return await res.json();
        }, GMGN_API_URL, walletAddress);

        console.log('Successfully fetched data from gmgn.ai.');
        return jsonData;

    } catch (error) {
        console.error('An error occurred during scraping:', error);
        throw error;
    } finally {
        await page.close();
    }
}

function transformDataToTrades(data: any): Trade[] {
    if (!data || !data.data || !Array.isArray(data.data.list)) {
        return [];
    }

    return data.data.list.map((item: any) => {
        const token = item.token_list.find((t: any) => t.is_main_token);
        if (!token) return null;

        return {
            wallet_address: item.wallet,
            token_symbol: token.symbol,
            token_address: token.address,
            trade_type: item.type, // 'buy' or 'sell'
            amount: parseFloat(token.amount),
            price: parseFloat(item.price_in_sol),
            total_value: parseFloat(item.sol_amount),
            trade_date: new Date(item.timestamp * 1000).toISOString(),
            source: 'GMGN',
            transaction_hash: item.tx,
        };
    }).filter(Boolean);
}


export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
        return NextResponse.json({ error: 'walletAddress is required' }, { status: 400 });
    }

    try {
        const data = await scrapeGmgn(walletAddress);
        const trades = transformDataToTrades(data);
        return NextResponse.json(trades);
    } catch (error: any) {
        console.error(`Failed to scrape gmgn.ai for wallet ${walletAddress}:`, error);
        return NextResponse.json({ error: 'Failed to scrape data', details: error.message }, { status: 500 });
    }
} 