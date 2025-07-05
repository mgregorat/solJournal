import { NextRequest, NextResponse } from 'next/server';
import { 
  fetchAndClassifyTransactions, 
  saveTransactionClassifications 
} from '@/lib/pnl-tracker';

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, limit = 100 } = await req.json();

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    // Fetch and classify transactions
    const classifications = await fetchAndClassifyTransactions(walletAddress, limit);
    
    // Save classifications to database
    if (classifications.length > 0) {
      await saveTransactionClassifications(classifications);
    }

    return NextResponse.json({
      message: `Classified ${classifications.length} transactions`,
      classifications: classifications
    });
  } catch (error: any) {
    console.error('Transaction classification API error:', error);
    return NextResponse.json({ error: error.message || 'An unexpected error occurred.' }, { status: 500 });
  }
} 