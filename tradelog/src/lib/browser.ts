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

    if (isProduction) {
        return {
            ...baseOptions,
            executablePath: '/usr/bin/chromium-browser',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        };
    }
    return { ...baseOptions, executablePath: executablePath() };
};

export async function getBrowser(): Promise<Browser> {
    // Use the cached browser instance if it exists and is connected.
    if (global._browser && global._browser.isConnected()) {
        return global._browser;
    }

    console.log("🚀 Launching new GLOBAL browser instance...");
    try {
        // Launch a new browser and cache it on the global object.
        global._browser = await puppeteer.launch(getLaunchOptions());
        console.log("✅ Global browser launched successfully.");

        global._browser.on('disconnected', () => {
            console.log("Browser disconnected. Cleaning up global instance.");
            global._browser = null;
        });

        return global._browser;
    } catch (error) {
        console.error("Failed to launch browser:", error);
        global._browser = null; // Clean up on failure
        throw new Error("Could not initialize browser instance.");
    }
} 