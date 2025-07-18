const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { executablePath } = require('puppeteer-core');

puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3001;

const GMGN_API_URL = 'https://gmgn.ai/vas/api/v1/wallet_activity/sol?type=buy&type=sell&device_id=797ada39-37b1-46c2-8e8a-f813ac27ebad&client_id=gmgn_web_20250703-726-a45f941&from_app=gmgn&app_ver=20250703-726-a45f941&tz_name=America%2FNew_York&tz_offset=-14400&app_lang=en-US&fp_did=ffaa653dc5d83387b22ee019166ad927&os=web&limit=50&cost=10';

app.get('/scrape', async (req, res) => {
    const { walletAddress } = req.query;

    if (!walletAddress) {
        return res.status(400).json({ error: 'walletAddress is required' });
    }

    console.log(`Received request to scrape for wallet: ${walletAddress}`);

    let browser;
    try {
        console.log('Launching browser with puppeteer-extra...');
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        console.log(`Navigating to gmgn.ai wallet page for ${walletAddress}...`);
        await page.goto(`https://gmgn.ai/sol/wallet/${walletAddress}`, {
            waitUntil: 'networkidle2',
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
        res.json(jsonData);

    } catch (error) {
        console.error('An error occurred during scraping:', error);
        res.status(500).json({ error: 'Failed to scrape data', details: error.message });
    } finally {
        if (browser) {
            console.log('Closing browser.');
            await browser.close();
        }
    }
});

app.listen(PORT, () => {
    console.log(`Scraper server listening on port ${PORT}`);
}); 