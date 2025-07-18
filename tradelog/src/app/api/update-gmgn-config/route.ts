import { NextResponse } from 'next/server';
import { connect } from 'puppeteer-real-browser';
import fs from 'fs';
import path from 'path';

const WALLET_PAGE_URL = 'https://gmgn.ai/sol/wallet/AkhQJQCNSN1EnXfnW5adThK35mw9954SAPaGvTVo4mc5';
const API_URL_PREFIX = 'https://gmgn.ai/vas/api/v1/wallet_activity/sol';

// We write the file to the project root, so it's easily accessible.
const OUTPUT_FILE = path.join(process.cwd(), 'tradelog', 'gmgn_config.json');

async function getRequestUrl(page: any) {
  // This is a robust way to capture the request URL from within the browser context.
  const url = await page.evaluate((prefix: string) => {
    return new Promise((resolve) => {
      const originalFetch = window.fetch;
      window.fetch = (...args) => {
        const requestUrl = args[0].toString();
        if (requestUrl.startsWith(prefix)) {
          resolve(requestUrl);
        }
        return originalFetch(...args);
      };
    });
  }, API_URL_PREFIX);
  return url;
}

export async function GET() {
  console.log('🚀 Triggered GMGN config update...');
  let browser;
  try {
    const { page, browser: browserInstance } = await connect({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      turnstile: true,
    });
    browser = browserInstance;

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
    
    console.log(`🧭 Navigating to ${WALLET_PAGE_URL} to establish session...`);
    await page.goto(WALLET_PAGE_URL, { waitUntil: 'domcontentloaded' });
    
    console.log('✅ Session established. Capturing request URL...');
    const capturedUrl = await getRequestUrl(page);

    if (!capturedUrl) {
      throw new Error('Could not capture the target API request URL within the browser.');
    }

    const params = new URL(capturedUrl as string).searchParams;
    const config = {
      app_ver: params.get('app_ver'),
      client_id: params.get('client_id'),
      device_id: params.get('device_id'),
      fp_did: params.get('fp_did'),
      last_updated: new Date().toISOString(),
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(config, null, 2));
    console.log(`✅ Successfully saved config to ${OUTPUT_FILE}`);
    
    return NextResponse.json({ success: true, ...config });

  } catch (err: any) {
    console.error('❌ Config update error:', err.message);
    return NextResponse.json({ success: false, error: 'Failed to update config', details: err.message }, { status: 500 });
  } finally {
    if (browser) {
      console.log('✅ Closing browser...');
      await browser.close();
    }
  }
} 