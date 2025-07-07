import 'server-only';
import puppeteer, { LaunchOptions } from 'puppeteer';

export async function fetchHoldings(walletAddress: string) {
  const URL = `https://gmgn.ai/api/v1/wallet_holdings/sol/${walletAddress}?device_id=797ada39-37b1-46c2-8e8a-f813ac27ebad&client_id=gmgn_web_20250630-556-4ee1d1a&from_app=gmgn&app_ver=20250630-556-4ee1d1a&tz_name=America%2FNew_York&tz_offset=-14400&app_lang=en-US&fp_did=ffaa653dc5d83387b22ee019166ad927&os=web&limit=50&orderby=last_active_timestamp&direction=desc&showsmall=true&sellout=true&hide_airdrop=false&tx30d=true`;

  const proxyHost = process.env.PROXY_HOST;
  const proxyPort = process.env.PROXY_PORT;
  const proxyUsername = process.env.PROXY_USERNAME;

  const launchOptions: LaunchOptions = { headless: true, args: ['--start-maximized'] };
  if (proxyHost && proxyPort) {
    if (!launchOptions.args) {
      launchOptions.args = [];
    }
    launchOptions.args.push(`--proxy-server=${proxyHost}:${proxyPort}`);
  }

  let browser;
  try {
    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    if (proxyUsername) {
        await page.authenticate({ username: proxyUsername, password: '' });
    }

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
    );

    await page.goto(URL, { waitUntil: 'domcontentloaded' });

    const data = await page.evaluate(async (url) => {
      const res = await fetch(url);
      return await res.json();
    }, URL);

    return data;
  } catch (err: any) {
    console.error('❌ Error while fetching JSON:', err.message);
    throw err;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export async function fetchSOLBalance(walletAddress: string) {
  const URL = `https://api-v2.solscan.io/v2/account?address=${walletAddress}&view_as=account`;

  const proxyHost = process.env.PROXY_HOST;
  const proxyPort = process.env.PROXY_PORT;
  const proxyUsername = process.env.PROXY_USERNAME;

  const launchOptions: LaunchOptions = { headless: true, args: ['--start-maximized'] };
  if (proxyHost && proxyPort) {
    if (!launchOptions.args) {
      launchOptions.args = [];
    }
    launchOptions.args.push(`--proxy-server=${proxyHost}:${proxyPort}`);
  }

  let browser;
  try {
    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    if (proxyUsername) {
        await page.authenticate({ username: proxyUsername, password: '' });
    }

    // Set headers to mimic a real browser request
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
    );

    await page.setExtraHTTPHeaders({
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://solscan.io/',
      'Origin': 'https://solscan.io'
    });

    await page.goto(URL, { waitUntil: 'domcontentloaded' });

    const data = await page.evaluate(async (url) => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return await res.json();
    }, URL);

    // Validate response structure
    if (!data || !data.success || !data.data) {
      throw new Error('Invalid response structure from Solscan API');
    }

    const { lamports } = data.data;
    const solPrice = data.metadata?.tokens?.So11111111111111111111111111111111111111111?.price_usdt;

    if (typeof lamports !== 'number') {
      throw new Error('Invalid lamports value in response');
    }

    if (typeof solPrice !== 'number') {
      throw new Error('SOL price not available in response');
    }

    // Convert lamports to SOL (1 SOL = 1,000,000,000 lamports)
    const solBalance = lamports / 1_000_000_000;
    const usdValue = solBalance * solPrice;

    return {
      address: walletAddress,
      sol_balance: solBalance,
      usd_value: usdValue,
      price_per_sol: solPrice,
      formatted: {
        sol: `${solBalance.toFixed(6)} SOL`,
        usd: `$${usdValue.toFixed(2)}`
      }
    };

  } catch (err: any) {
    console.error(`❌ Error while fetching SOL balance for ${walletAddress}:`, err.message);
    throw new Error(`Failed to fetch SOL balance: ${err.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export async function fetchTokenData(mintAddress: string) {
  const URL = `https://gmgn.ai/defi/quotation/v1/tokens/sol/${mintAddress}?device_id=797ada39-37b1-46c2-8e8a-f813ac27ebad&client_id=gmgn_web_20250630-556-4ee1d1a&from_app=gmgn&app_ver=20250630-556-4ee1d1a&tz_name=America%2FNew_York&tz_offset=-14400&app_lang=en-US&fp_did=ffaa653dc5d83387b22ee019166ad927&os=web`;

  const proxyHost = process.env.PROXY_HOST;
  const proxyPort = process.env.PROXY_PORT;
  const proxyUsername = process.env.PROXY_USERNAME;

  const launchOptions: LaunchOptions = { headless: true, args: ['--start-maximized'] };
  if (proxyHost && proxyPort) {
    if (!launchOptions.args) {
      launchOptions.args = [];
    }
    launchOptions.args.push(`--proxy-server=${proxyHost}:${proxyPort}`);
  }

  let browser;
  try {
    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    if (proxyUsername) {
        await page.authenticate({ username: proxyUsername, password: '' });
    }

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
    );

    await page.goto(URL, { waitUntil: 'domcontentloaded' });

    const data = await page.evaluate(async (url) => {
      const res = await fetch(url);
      return await res.json();
    }, URL);

    if (data.code !== 0) {
      throw new Error(`API returned error code ${data.code}: ${data.message}`);
    }

    return data.data;
  } catch (err: any) {
    console.error(`❌ Error while fetching token data for ${mintAddress}:`, err.message);
    throw err;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
} 