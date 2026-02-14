import { getTokenHoldings } from "@/lib/portfolio";
import { NextRequest } from "next/server";
import { requireOwnedWallet, requireUser } from "@/app/lib/authorization";
import { throwHttp, withTiming } from "@/app/lib/http";

export const dynamic = "force-dynamic";

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
    const holdings = await getTokenHoldings(ownedWallet.wallet_address);
    return holdings;
  });
} 
