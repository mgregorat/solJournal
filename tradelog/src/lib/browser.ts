import 'server-only';
import puppeteer, { Browser } from 'puppeteer-core';
import { executablePath } from 'puppeteer';

// To share a single browser instance across serverless function invocations,
// we attach it to the `global` object. This is a best-practice for
// resource management in a Next.js/Vercel/Railway serverless environment.
declare global {
    var _browser: Browser | null;
}

const getLaunchOptions = () => {
    const isProduction = process.env.NODE_ENV === 'production';
    const baseOptions = {
        headless: true,
        protocolTimeout: 90000,
    };
    
    const args = isProduction 
        ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] 
        : [];

    // --- PROXY CONFIGURATION ---
    const { PROXY_HOST, PROXY_PORT } = process.env;
    if (PROXY_HOST && PROXY_PORT) {
        console.log(`🚀 Using proxy server: ${PROXY_HOST}:${PROXY_PORT}`);
        args.push(`--proxy-server=${PROXY_HOST}:${PROXY_PORT}`);
    }

    if (isProduction) {
        return {
            ...baseOptions,
            executablePath: '/usr/bin/chromium-browser',
            args,
        };
    }
    return { ...baseOptions, executablePath: executablePath(), args };
};

async function isBrowserHealthy(browser: Browser): Promise<boolean> {
    try {
        // A simple check: can we open a new page?
        const page = await browser.newPage();
        await page.close();
        return true;
    } catch (e) {
        console.warn("Browser health check failed.", e);
        return false;
    }
}

export async function getBrowser(): Promise<Browser> {
    if (global._browser && global._browser.isConnected()) {
        // Add a health check before returning the cached instance
        if (await isBrowserHealthy(global._browser)) {
            return global._browser;
        }
        console.log("Browser failed health check. Closing and relaunching.");
        try {
            await global._browser.close();
        } catch (e) {
            console.error("Error closing unhealthy browser instance:", e);
        }
        global._browser = null;
    }
    
    // If we're here, we need a new browser
    console.log("🚀 Launching new GLOBAL browser instance...");
    try {
        global._browser = await puppeteer.launch(getLaunchOptions());
        console.log("✅ Global browser launched successfully.");

        global._browser.on('disconnected', () => {
            console.log("Browser disconnected. Cleaning up global instance.");
            global._browser = null;
        });

        return global._browser;
    } catch (error) {
        console.error("Failed to launch browser:", error);
        global._browser = null;
        throw new Error("Could not initialize browser instance.");
    }
} 