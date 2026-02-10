import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
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

    return NextResponse.json({
        users,
        wallets,
        tradesCount,
        tradesSample: trades,
        errors: { usersError, walletsError, tradesError }
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
