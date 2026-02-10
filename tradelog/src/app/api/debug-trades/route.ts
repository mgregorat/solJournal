import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        // If no userId, just fetch the last 10 trades globally to see if ANYTHING exists
        const { data: globalTrades, error: globalError } = await supabaseAdmin
            .from('trades')
            .select('*')
            .limit(10);
        
        return NextResponse.json({ 
            message: "No userId provided. Showing last 10 global trades.", 
            count: globalTrades?.length, 
            trades: globalTrades, 
            error: globalError 
        });
    }

    // Fetch trades for specific user
    const { data: userTrades, error: userTradesError } = await supabaseAdmin
        .from('trades')
        .select('*')
        .eq('user_id', userId);

    // Fetch wallets for specific user
    const { data: userWallets, error: userWalletsError } = await supabaseAdmin
        .from('wallets')
        .select('*')
        .eq('user_id', userId);

    return NextResponse.json({
        userId,
        tradeCount: userTrades?.length,
        walletCount: userWallets?.length,
        wallets: userWallets,
        tradesSample: userTrades?.slice(0, 5), // Show first 5
        tradesError: userTradesError,
        walletsError: userWalletsError
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
