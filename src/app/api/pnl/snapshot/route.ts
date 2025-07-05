import { NextRequest, NextResponse } from 'next/server';
import { takeDailyBalanceSnapshot } from '@/lib/pnl';

export const dynamic = 'force-dynamic';

// This endpoint is for a cron job to call at 00:00 UTC
export async function POST(req: NextRequest) {
  try {
    const { walletAddress, cronSecret } = await req.json();

    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    await takeDailyBalanceSnapshot(walletAddress);

    return NextResponse.json({ success: true, message: `Snapshot taken for ${walletAddress}` });

  } catch (error: any) {
    console.error('P&L Snapshot API Error:', error);
    return NextResponse.json({
      error: 'Failed to take P&L snapshot.',
      details: error.message,
    }, { status: 500 });
  }
} 