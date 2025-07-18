const { connect } = require('puppeteer-real-browser');
const fs = require('fs');
const path = require('path');

const TARGET_URL = 'https://gmgn.ai/sol/address/AkhQJQCNSN1EnXfnW5adThK35mw9954SAPaGvTVo4mc5';
const TARGET_PATH = '/vas/api/v1/wallet_activity/sol';
const OUTPUT_FILE = path.join(process.cwd(), 'tradelog', 'gmgn_config.json');
const TIMEOUT = 30000; // 30 seconds

async function fetchGmgnConfig() {
  console.log('🚀 Launching a visible browser. This is required to bypass the site\'s security.');
  let browser;
  try {
    const { browser: browserInstance, page } = await connect({
      headless: false, // This is the essential change to make the script work.
      args: ['--start-maximized'],
    });
    browser = browserInstance;

    await page.setRequestInterception(true);
    
    const requestPromise = new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`❌ Timed out after ${TIMEOUT / 1000} seconds. The page may have been blocked.`));
      }, TIMEOUT);

      page.on('request', (request) => {
        const requestUrl = request.url();
        if (new URL(requestUrl).pathname === TARGET_PATH) {
          clearTimeout(timeoutId);
          console.log('✅ Intercepted target network request!');
          const params = new URL(requestUrl).searchParams;
          const config = {
            app_ver: params.get('app_ver'),
            client_id: params.get('client_id'),
            device_id: params.get('device_id'),
            fp_did: params.get('fp_did'),
            last_updated: new Date().toISOString(),
          };
          resolve(config);
        }
        if (!request.isInterceptResolutionHandled()) {
          request.continue();
        }
      });
    });

    console.log(`🧭 Navigating to ${TARGET_URL}. A browser window will open.`);
    await page.goto(TARGET_URL, { waitUntil: 'networkidle2' });

    const config = await requestPromise;

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(config, null, 2));
    console.log(`✅ Success! Fresh config saved to ${OUTPUT_FILE}`);
    console.log(JSON.stringify(config, null, 2));
    
  } catch (err) {
    console.error('❌ An error occurred:', err.message);
    throw err;
  } finally {
    if (browser) {
      console.log('✅ Closing browser...');
      await browser.close();
    }
  }
}

fetchGmgnConfig().catch(() => process.exit(1)); 