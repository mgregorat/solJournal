import 'server-only';
import { connect, Browser } from 'puppeteer-real-browser';

let browser: Browser | null = null;

export async function getBrowser() {
    if (process.env.NODE_ENV === 'production') {
        if (global.browser) {
            return global.browser;
        }

        try {
            console.log("Connecting to browser...");
            const remoteBrowser = await connect({
                headless: 'auto',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            global.browser = remoteBrowser;
            console.log("Browser connected.");
            return remoteBrowser;
        } catch (error) {
            console.error('Failed to connect to browser:', error);
            throw error;
        }
    }

    if (browser) {
        return browser;
    }

    try {
        console.log("Launching new browser instance...");
        const newBrowser = await connect({
            headless: 'auto',
        });
        browser = newBrowser;
        console.log("Browser launched.");
        return newBrowser;
    } catch (error) {
        console.error('Failed to launch browser:', error);
        throw error;
    }
}
