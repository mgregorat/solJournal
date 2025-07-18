'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface JournalEvent {
  id: string;
  status: 'CLOSED' | 'OPEN';
  token_symbol: string;
  token_logo?: string;
  date: string;
  sell_value_usd?: number;
  cost_basis_usd?: number;
  realized_pnl_usd?: number;
  realized_pnl_percent?: number;
  sell_tx_hash?: string;
  held_amount?: number;
  avg_buy_price?: number;
  total_cost?: number;
  current_price?: number;
  current_value_usd?: number;
  unrealized_pnl_usd?: number;
  unrealized_pnl_percent?: number;
}

interface JournalPageProps {
  dbUser: any;
  activeWalletAddress?: string;
}

export const JournalPage = ({ dbUser, activeWalletAddress }: JournalPageProps) => {
  const [journalEvents, setJournalEvents] = useState<JournalEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const syncInitiated = useRef(false);

  useEffect(() => {
    const syncAndFetch = async () => {
      if (!dbUser?.id || !activeWalletAddress || syncInitiated.current) return;
      syncInitiated.current = true;
      setIsLoading(true);
      setError(null);
      try {
        await fetch('/api/journal/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: dbUser.id, walletAddress: activeWalletAddress }),
        });
        const response = await fetch(`/api/journal-activity?userId=${dbUser.id}&walletAddress=${activeWalletAddress}`);
        if (!response.ok) throw new Error('Failed to fetch P&L data');
        const data = await response.json();
        setJournalEvents(data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
        syncInitiated.current = false;
      }
    };
    syncAndFetch();
  }, [dbUser?.id, activeWalletAddress]);

  const renderContent = () => {
    if (isLoading) return <p className="text-center">Calculating P&L...</p>;
    if (error) return <p className="text-red-500 text-center">Error: {error}</p>;
    if (journalEvents.length === 0) return <p className="text-center text-muted-foreground">No journal events found.</p>;

    return (
      <div className="space-y-4">
        {journalEvents.map((event) => {
          if (event.status === 'CLOSED') {
            return (
              <Card key={event.id} className="bg-gray-800 border-gray-700 text-white">
                <CardHeader>
                  <CardTitle className="flex justify-between items-center text-lg">
                    <div className="flex items-center gap-2">
                      {event.token_logo && <img src={event.token_logo} alt={event.token_symbol} className="w-6 h-6 rounded-full" />}
                      <span>{event.token_symbol}</span>
                    </div>
                    <Badge variant={event.realized_pnl_usd! >= 0 ? 'default' : 'destructive'}>
                      {event.realized_pnl_usd! >= 0 ? 'PROFIT' : 'LOSS'}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div className="bg-gray-700 p-3 rounded-lg">
                    <p className="font-semibold text-gray-400">Proceeds</p>
                    <p className="text-lg font-mono">${event.sell_value_usd!.toFixed(2)}</p>
                  </div>
                  <div className="bg-gray-700 p-3 rounded-lg">
                    <p className="font-semibold text-gray-400">Cost Basis</p>
                    <p className="text-lg font-mono">${event.cost_basis_usd!.toFixed(2)}</p>
                  </div>
                  <div className={`col-span-2 p-3 rounded-lg ${event.realized_pnl_usd! >= 0 ? 'bg-green-900' : 'bg-red-900'}`}>
                    <p className="font-semibold text-gray-300">Realized P&L</p>
                    <p className="text-xl font-bold">
                      {event.realized_pnl_usd! >= 0 ? '+' : ''}${event.realized_pnl_usd!.toFixed(2)}
                      <span className={`ml-2 text-sm font-normal ${event.realized_pnl_usd! >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                        ({event.realized_pnl_percent!.toFixed(2)}%)
                      </span>
                    </p>
                  </div>
                  <div className="col-span-2 text-xs text-gray-500 pt-2">
                    <p>Sold on {new Date(event.date).toLocaleString()}</p>
                    <a href={`https://solscan.io/tx/${event.sell_tx_hash}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                      View Sale on Solscan
                    </a>
                  </div>
                </CardContent>
              </Card>
            );
          } else { // OPEN positions
            return (
              <Card key={event.id} className="bg-blue-900/50 border-blue-700 text-white">
                <CardHeader>
                  <CardTitle className="flex justify-between items-center text-lg">
                    <div className="flex items-center gap-2">
                      {event.token_logo && <img src={event.token_logo} alt={event.token_symbol} className="w-6 h-6 rounded-full" />}
                      <span>{event.token_symbol}</span>
                    </div>
                    <Badge variant="secondary">IN PROGRESS</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                   <div className="bg-gray-700 p-3 rounded-lg">
                    <p className="font-semibold text-gray-400">Position Size</p>
                    <p className="text-lg font-mono">{event.held_amount!.toLocaleString()}</p>
                  </div>
                  <div className="bg-gray-700 p-3 rounded-lg">
                    <p className="font-semibold text-gray-400">Avg. Buy Price</p>
                    <p className="text-lg font-mono">${event.avg_buy_price!.toFixed(6)}</p>
                  </div>
                  <div className="bg-gray-700 p-3 rounded-lg col-span-2">
                    <p className="font-semibold text-gray-400">Current Value</p>
                    <p className="text-lg font-mono">${event.current_value_usd?.toFixed(2) ?? 'N/A'}</p>
                  </div>
                  {event.unrealized_pnl_usd !== undefined && (
                    <div className={`col-span-2 p-3 rounded-lg ${event.unrealized_pnl_usd >= 0 ? 'bg-green-900' : 'bg-red-900'}`}>
                      <p className="font-semibold text-gray-300">Unrealized P&L</p>
                      <p className="text-xl font-bold">
                        {event.unrealized_pnl_usd >= 0 ? '+' : ''}${event.unrealized_pnl_usd.toFixed(2)}
                        <span className={`ml-2 text-sm font-normal ${event.unrealized_pnl_usd >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                          ({event.unrealized_pnl_percent!.toFixed(2)}%)
                        </span>
                      </p>
                    </div>
                  )}
                   <div className="col-span-2 text-xs text-gray-500 pt-2">
                     <p>Last purchase on {new Date(event.date).toLocaleString()}</p>
                  </div>
                </CardContent>
              </Card>
            );
          }
        })}
      </div>
    );
  };
  
  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">P&L Journal</h1>
        <p className="text-sm text-muted-foreground">Automatically calculated from synced trades.</p>
      </div>
      {renderContent()}
    </div>
  );
}; 