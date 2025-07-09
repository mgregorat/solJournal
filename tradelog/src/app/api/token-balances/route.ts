import { NextRequest, NextResponse } from 'next/server';
import { Helius } from 'helius-sdk';

let helius: Helius | null = null;

function getHeliusClient() {
    if (helius) {
        return helius;
    }

    const heliusApiKey = process.env.HELIUS_API_KEY;

    if (!heliusApiKey) {
        throw new Error("Helius API key is not configured. Please set HELIUS_API_KEY in your .env.local file.");
    }

    helius = new Helius(heliusApiKey);
    return helius;
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
        return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    try {
        const heliusClient = getHeliusClient();
        const response = await heliusClient.rpc.getAssetsByOwner({ ownerAddress: walletAddress, page: 1 });
        return NextResponse.json(response);

    } catch (error: any) {
        console.error(`Error fetching token balances from Helius for ${walletAddress}:`, error);
        return NextResponse.json({ error: 'Failed to fetch token balances.' }, { status: 500 });
    }
} 