import { NextRequest } from 'next/server';
import { takeDailyBalanceSnapshot } from '@/lib/pnl';
import { requireInternalRequest } from '@/app/lib/authorization';
import { throwHttp, withTiming } from '@/app/lib/http';

export const dynamic = 'force-dynamic';

// This endpoint is for a cron job to call at 00:00 UTC
export async function POST(req: NextRequest) {
  return withTiming(req, async () => {
    requireInternalRequest(req);
    const { walletAddress } = await req.json();

    if (!walletAddress) {
      throwHttp("bad_request", "Wallet address is required", 400);
    }

    await takeDailyBalanceSnapshot(walletAddress);

    return { success: true, message: `Snapshot taken for ${walletAddress}` };
  });
} 
