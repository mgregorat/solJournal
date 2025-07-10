import 'server-only';
import puppeteer, { Browser } from 'puppeteer-core';
import { executablePath } from 'puppeteer';

let browser: Browser | null = null;

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
    if (browser && browser.isConnected()) {
        return browser;
    }

    console.log("🚀 Launching new browser instance...");
    try {
        browser = await puppeteer.launch(getLaunchOptions());
        console.log("✅ Browser launched successfully.");

        browser.on('disconnected', () => {
            console.log("Browser disconnected. Cleaning up.");
            browser = null;
        });

        return browser;
    } catch (error) {
        console.error("Failed to launch browser:", error);
        throw new Error("Could not initialize browser instance.");
    }
} 