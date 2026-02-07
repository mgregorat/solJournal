import 'server-only';
import { getBrowser } from './browser';

export async function fetchHoldings(walletAddress: string) {
    const URL = `https://gmgn.ai/pf/api/v1/wallet/sol/${walletAddress}/holdings?device_id=797ada39-37b1-46c2-8e8a-f813ac27ebad&fp_did=ffaa653dc5d83387b22ee019166ad927&client_id=gmgn_web_20260207-10838-e0410a3&from_app=gmgn&app_ver=20260207-10838-e0410a3&tz_name=America%2FNew_York&tz_offset=-18000&app_lang=en-US&os=web&worker=0&limit=50&order_by=last_active_timestamp&direction=desc&hide_airdrop=false&hide_abnormal=false&hide_closed=true&sellout=true&showsmall=true`;

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
        // First, navigate to a legitimate page on the domain.
        await page.goto('https://gmgn.ai/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        // Then, fetch the API data from within the browser context.
        const data = await page.evaluate(async (url) => {
            const res = await fetch(url);
            return await res.json();
        }, URL);
        return data;
    } catch (err: any) {
        console.error('❌ Error while fetching holdings JSON:', err.message);
        throw err;
    } finally {
        await page.close();
    }
}

export async function fetchSOLBalance(walletAddress: string) {
    const URL = `https://api-v2.solscan.io/v2/account?address=${walletAddress}&view_as=account`;

    const browser = await getBrowser();
    const page = await browser.newPage();

    const { PROXY_USERNAME, PROXY_PASSWORD } = process.env;
    if (PROXY_USERNAME && PROXY_PASSWORD) {
        await page.authenticate({ username: PROXY_USERNAME, password: PROXY_PASSWORD });
    }

    try {
        await page.setExtraHTTPHeaders({
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://solscan.io/',
            'Origin': 'https://solscan.io'
        });
        // First, navigate to the base Solscan site to establish context
        await page.goto('https://solscan.io/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        // Then, use evaluate to fetch the data from the API endpoint
        const data = await page.evaluate(async (url) => {
            const res = await fetch(url, { 
                headers: {
                    'Accept': 'application/json, text/plain, */*',
                }
            });
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return await res.json();
        }, URL);

        if (!data || !data.success || !data.data) {
            throw new Error('Invalid response structure from Solscan API');
        }

        const { lamports } = data.data;
        const solPrice = data.metadata?.tokens?.So11111111111111111111111111111111111111112?.price_usdt;

        if (typeof lamports !== 'number' || typeof solPrice !== 'number') {
            throw new Error('Invalid or missing lamports/price in Solscan response');
        }

        const solBalance = lamports / 1_000_000_000;
        const usdValue = solBalance * solPrice;

        return {
            address: walletAddress,
            sol_balance: solBalance,
            usd_value: usdValue,
            price_per_sol: solPrice,
        };

    } catch (err: any) {
        console.error(`❌ Error while fetching SOL balance for ${walletAddress}:`, err.message);
        throw new Error(`Failed to fetch SOL balance: ${err.message}`);
    } finally {
        await page.close();
    }
}
