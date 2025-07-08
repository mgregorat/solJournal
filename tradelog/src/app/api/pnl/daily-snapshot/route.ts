import { NextRequest, NextResponse } from 'next/server';
import { 
  createDailySnapshot, 
  calculateDailyPnL, 
  getDailyPnLData,
  rebuildDailySnapshot 
} from '@/lib/pnl-tracker';

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, date, action } = await req.json();

    console.log('P&L API POST request:', { walletAddress, date, action });

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    const snapshotDate = date ? new Date(date) : new Date();

    switch (action) {
      case 'create':
        console.log('Creating daily snapshot...');
        const snapshot = await createDailySnapshot(walletAddress, snapshotDate);
        console.log('Snapshot created:', snapshot);
        return NextResponse.json(snapshot);

      case 'calculate':
        console.log('Calculating P&L...');
        const pnlSnapshot = await calculateDailyPnL(walletAddress, snapshotDate);
        console.log('P&L calculated:', pnlSnapshot);
        return NextResponse.json(pnlSnapshot);

      case 'rebuild':
        console.log('Rebuilding snapshot...');
        const rebuiltSnapshot = await rebuildDailySnapshot(walletAddress, snapshotDate);
        console.log('Snapshot rebuilt:', rebuiltSnapshot);
        return NextResponse.json(rebuiltSnapshot);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Daily snapshot API error:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json({ 
      error: error.message || 'An unexpected error occurred.',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const walletAddress = searchParams.get('walletAddress');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    console.log('P&L API GET request:', { walletAddress, startDate, endDate });

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const end = endDate ? new Date(endDate) : new Date();

    console.log('Fetching P&L data for date range:', { start, end });

    const pnlData = await getDailyPnLData(walletAddress, start, end);
    
    console.log('P&L data fetched:', { count: pnlData.length });
    
    return NextResponse.json(pnlData);
  } catch (error: any) {
    console.error('Get P&L data API error:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json({ 
      error: error.message || 'An unexpected error occurred.',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
} 