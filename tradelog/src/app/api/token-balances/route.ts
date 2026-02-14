import { NextRequest } from 'next/server';
import { Helius } from 'helius-sdk';
import { requireOwnedWallet, requireUser } from '@/app/lib/authorization';
import { throwHttp, withTiming } from '@/app/lib/http';

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
    return withTiming(req, async () => {
        const { searchParams } = new URL(req.url);
        const walletIdParam = searchParams.get('walletId');
        const walletAddress = searchParams.get('walletAddress');
        const dbUser = await requireUser(req);
        let walletId: number | null = null;
        if (walletIdParam) {
            walletId = parseInt(walletIdParam, 10);
            if (isNaN(walletId)) {
                throwHttp("bad_request", "Invalid walletId format", 400);
            }
        }

        const ownedWallet = await requireOwnedWallet(req, dbUser, walletId, walletAddress);
        const resolvedWalletAddress = ownedWallet.wallet_address;

        const heliusClient = getHeliusClient();
        const response = await heliusClient.rpc.getAssetsByOwner({ ownerAddress: resolvedWalletAddress, page: 1 });
        return { provider: response };
    });
}
