import { NextRequest, NextResponse } from 'next/server';
import { Helius } from 'helius-sdk';

const heliusApiKey = process.env.HELIUS_API_KEY;

if (!heliusApiKey) {
    // This will be caught by the server and should provide a clear message.
    throw new Error("Helius API key is not configured. Please set HELIUS_API_KEY in your .env.local file.");
}

const helius = new Helius(heliusApiKey);

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
        return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    try {
        const response = await helius.rpc.getTokenBalances({ owner: walletAddress });
        return NextResponse.json(response);

    } catch (error: any) {
        console.error(`Error fetching token balances from Helius for ${walletAddress}:`, error);
        return NextResponse.json({ error: 'Failed to fetch token balances.' }, { status: 500 });
    }
} 