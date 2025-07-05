import { NextRequest, NextResponse } from 'next/server';
import { getTodaysPnl } from '@/lib/pnl';

export const dynamic = 'force-dynamic';

// This endpoint is for the UI to fetch the latest P&L data
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    const pnlData = await getTodaysPnl(walletAddress);

    return NextResponse.json(pnlData);

  } catch (error: any) {
    console.error('Today\'s P&L API Error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch today\'s P&L data.',
      details: error.message
    }, { status: 500 });
  }
} 