import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import { requireInternalRequest } from '@/app/lib/authorization';
import { throwHttp, withTiming } from '@/app/lib/http';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withTiming(request, async () => {
    requireInternalRequest(request);
    // 1. Get Users
    const { data: users, error: usersError } = await supabaseAdmin
        .from('users')
        .select('*');

    // 2. Get Wallets
    const { data: wallets, error: walletsError } = await supabaseAdmin
        .from('wallets')
        .select('*');

    // 3. Get Trades (limit 50)
    const { data: trades, error: tradesError } = await supabaseAdmin
        .from('trades')
        .select('id, user_id, wallet_id, wallet_address, transaction_hash, trade_date')
        .limit(50);

    // 4. Get Counts
    const { count: tradesCount } = await supabaseAdmin
        .from('trades')
        .select('*', { count: 'exact', head: true });

    if (usersError || walletsError || tradesError) {
      throwHttp("internal_error", "Failed to fetch debug database data", 500);
    }

    return {
      data: {
        users,
        wallets,
        tradesCount,
        tradesSample: trades,
      },
    };
  });
}
