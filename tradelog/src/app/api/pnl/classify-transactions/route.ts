import { NextRequest } from 'next/server';
import { 
  fetchAndClassifyTransactions, 
  saveTransactionClassifications 
} from '@/lib/pnl-tracker';
import { throwHttp, withTiming } from '@/app/lib/http';

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return withTiming(req, async () => {
    const { walletAddress, limit = 100 } = await req.json();

    if (!walletAddress) {
      throwHttp("bad_request", "Wallet address is required", 400);
    }

    // Fetch and classify transactions
    const classifications = await fetchAndClassifyTransactions(walletAddress, limit);
    
    // Save classifications to database
    if (classifications.length > 0) {
      await saveTransactionClassifications(classifications);
    }

    return {
      message: `Classified ${classifications.length} transactions`,
      classifications: classifications
    };
  });
} 
