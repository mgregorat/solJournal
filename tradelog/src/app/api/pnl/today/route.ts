import { NextRequest, NextResponse } from 'next/server';
import { getTodaysPnl } from '@/lib/pnl';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// This endpoint is for the UI to fetch the latest P&L data
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userIdStr = searchParams.get('userId');
    const walletIdStr = searchParams.get('walletId');
    const walletAddress = searchParams.get('walletAddress');

    // Backward compatibility path for older callers
    if (!userIdStr && walletAddress) {
      const pnlData = await getTodaysPnl(walletAddress);
      return NextResponse.json(pnlData);
    }

    if (!userIdStr) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const userId = parseInt(userIdStr, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid userId format' }, { status: 400 });
    }

    let walletsQuery = supabaseAdmin
      .from('wallets')
      .select('id, wallet_address')
      .eq('user_id', userId);

    if (walletIdStr !== null) {
      const walletId = parseInt(walletIdStr, 10);
      if (!isNaN(walletId)) {
        walletsQuery = walletsQuery.eq('id', walletId);
      }
    }

    const { data: wallets, error: walletsError } = await walletsQuery;
    if (walletsError) {
      throw new Error(`Failed to fetch wallets: ${walletsError.message}`);
    }

    if (!wallets || wallets.length === 0) {
      return NextResponse.json({
        pnl_usd: 0,
        pnl_percent: 0,
        current_balance_usd: 0,
      });
    }

    const walletPnls = await Promise.all(
      wallets.map((wallet) => getTodaysPnl(wallet.wallet_address))
    );

    const aggregate = walletPnls.reduce(
      (acc, pnl) => {
        acc.pnlUsd += pnl.pnl_usd;
        acc.currentBalance += pnl.current_balance_usd;
        acc.startBalance += (pnl.current_balance_usd - pnl.pnl_usd);
        return acc;
      },
      { pnlUsd: 0, currentBalance: 0, startBalance: 0 }
    );

    const pnlData = {
      pnl_usd: aggregate.pnlUsd,
      pnl_percent: aggregate.startBalance > 0 ? (aggregate.pnlUsd / aggregate.startBalance) * 100 : 0,
      current_balance_usd: aggregate.currentBalance,
    };

    return NextResponse.json(pnlData);

  } catch (error: any) {
    console.error('Today\'s P&L API Error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch today\'s P&L data.',
      details: error.message
    }, { status: 500 });
  }
} 
