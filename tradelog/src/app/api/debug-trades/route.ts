import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import { requireInternalRequest } from '@/app/lib/authorization';
import { throwHttp, withTiming } from '@/app/lib/http';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withTiming<{
    message?: string;
    count?: number;
    trades?: Record<string, unknown>[] | null;
    error?: unknown;
    targetUserId?: string;
    tradeCount?: number;
    walletCount?: number;
    wallets?: Record<string, unknown>[] | null;
    tradesSample?: Record<string, unknown>[] | null;
  }>(request, async () => {
    requireInternalRequest(request);
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('targetUserId');

    if (!targetUserId) {
        // If no targetUserId, just fetch the last 10 trades globally to see if ANYTHING exists
        const { data: globalTrades, error: globalError } = await supabaseAdmin
            .from('trades')
            .select('*')
            .limit(10);
        
        return { 
            data: {
            message: "No targetUserId provided. Showing last 10 global trades.", 
            count: globalTrades?.length, 
            trades: globalTrades, 
            error: globalError 
            },
        };
    }

    // Fetch trades for specific user
    const { data: userTrades, error: userTradesError } = await supabaseAdmin
        .from('trades')
        .select('*')
        .eq('user_id', targetUserId);

    // Fetch wallets for specific user
    const { data: userWallets, error: userWalletsError } = await supabaseAdmin
        .from('wallets')
        .select('*')
        .eq('user_id', targetUserId);

    if (userTradesError || userWalletsError) {
      throwHttp("internal_error", "Failed to fetch debug trades", 500);
    }

    return {
      data: {
        targetUserId,
        tradeCount: userTrades?.length,
        walletCount: userWallets?.length,
        wallets: userWallets,
        tradesSample: userTrades?.slice(0, 5), // Show first 5
      },
    };
  });
}
