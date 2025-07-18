'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trade } from '@/lib/types';

interface JournalPageProps {
  initialTrades: Trade[];
  dbUser: any;
  activeWalletAddress?: string;
}

export const JournalPage = ({ initialTrades, dbUser, activeWalletAddress }: JournalPageProps) => {
  const [journalTrades, setJournalTrades] = useState<any[]>(initialTrades || []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use a ref to prevent double-invocations in React's Strict Mode (dev only)
  const syncInitiated = useRef(false);

  useEffect(() => {
    const syncAndFetch = async () => {
      if (!dbUser?.id || !activeWalletAddress || syncInitiated.current) {
        return;
      }
      syncInitiated.current = true;
      setIsLoading(true);
      setError(null);

      try {
        // Step 1: Sync trades for the active wallet
        console.log(`🚀 Starting trade sync for ${activeWalletAddress}...`);
        await fetch('/api/journal/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: dbUser.id, walletAddress: activeWalletAddress }),
        });
        console.log("✅ Trade sync completed.");

        // Step 2: Fetch the newly synced trades
        console.log(`🔄 Fetching updated trades for wallet ${activeWalletAddress}...`);
        const response = await fetch(`/api/journal-activity?userId=${dbUser.id}&walletAddress=${activeWalletAddress}`);
        if (!response.ok) {
          throw new Error('Failed to fetch journal activity');
        }
        const trades = await response.json();
        setJournalTrades(trades || []);
        console.log(`👍 Successfully fetched ${trades.length} trades.`);

      } catch (err: any) {
        console.error("Failed to sync or fetch journal trades:", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
        // Reset the ref so a new sync can occur if the wallet changes
        syncInitiated.current = false; 
      }
    };

    syncAndFetch();
  }, [dbUser?.id, activeWalletAddress]);

  const renderContent = () => {
    if (isLoading) {
      return <p className="text-center">Syncing and fetching trades...</p>;
    }

    if (error) {
      return <p className="text-red-500 text-center">Error syncing trades: {error}</p>;
    }

    if (journalTrades.length === 0) {
      return <p className="text-center text-muted-foreground">No journal trades found.</p>;
    }

    return (
      <div className="space-y-4">
        {journalTrades.map((trade) => (
          <Card key={trade.tx_hash}>
            <CardHeader>
              <CardTitle className="flex justify-between items-center text-lg">
                <span>{trade.token_symbol}</span>
                <Badge variant={(trade.event_type || '').toLowerCase() === 'buy' ? 'default' : 'destructive'}>
                  {(trade.event_type || '').toUpperCase()}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="font-semibold">Token</p>
                <p className="text-muted-foreground">{trade.token_symbol}</p>
              </div>
              <div>
                <p className="font-semibold">Amount</p>
                <p className="text-muted-foreground">{Number(trade.token_amount).toLocaleString()} {trade.token_symbol}</p>
              </div>
              <div>
                <p className="font-semibold">Value (USD)</p>
                <p className="text-muted-foreground">${Number(trade.cost_usd).toFixed(2)}</p>
              </div>
              <div>
                <p className="font-semibold">Price (USD)</p>
                <p className="text-muted-foreground">${Number(trade.price_usd).toFixed(6)}</p>
              </div>
              <div className="col-span-2">
                 <p className="font-semibold">Timestamp</p>
                 <p className="text-muted-foreground">{new Date(trade.trade_date).toLocaleString()}</p>
              </div>
              <div className="col-span-2 mt-2">
                <a href={`https://solscan.io/tx/${trade.tx_hash}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                  View on Solscan
                </a>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };
  
  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Trade Journal</h1>
        <p className="text-sm text-muted-foreground">Automatically synced from gmgn.ai</p>
      </div>
      {renderContent()}
    </div>
  );
}; 