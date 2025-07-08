'use client';
import { useState } from 'react';

// A simple component to display synced trade data.
export const SyncedTradesDisplay = ({ trades }: { trades: any[] }) => {
  const [filter, setFilter] = useState('all'); // 'all', 'buy', 'sell'

  if (!trades || trades.length === 0) {
    return (
        <div className="mt-8 text-center text-gray-400">
            <p>No recent transactions found.</p>
        </div>
    );
  }

  const filteredTrades = trades.filter(trade => {
    if (filter === 'all') return true;
    return trade.trade_type === filter;
  });

  return (
    <div className="mt-8">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold">Recent Transactions</h3>
        <div className="flex space-x-2">
          <button 
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-sm rounded-md ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>
            All
          </button>
          <button 
            onClick={() => setFilter('buy')}
            className={`px-3 py-1 text-sm rounded-md ${filter === 'buy' ? 'bg-green-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>
            Buys
          </button>
          <button 
            onClick={() => setFilter('sell')}
            className={`px-3 py-1 text-sm rounded-md ${filter === 'sell' ? 'bg-red-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>
            Sells
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTrades.length > 0 ? (
          filteredTrades.map((trade, index) => {
            const isBuy = trade.trade_type === 'buy';
            const action = isBuy ? "Buy" : "Sell";
            const colorClass = isBuy ? "text-green-400" : "text-red-400";

            const displayDetails = (
              <p>
                {action} {Number(trade.amount).toFixed(4)} {trade.token_symbol} for {Number(trade.total_value).toFixed(4)} SOL
              </p>
            );
            
            return (
              <div key={trade.id || index} className="p-4 bg-gray-800/50 rounded-lg flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center">
                    <p className={`text-lg font-bold ${colorClass}`}>{action} {trade.token_symbol}</p>
                    <p className="text-gray-400 text-xs">{new Date(trade.trade_date).toLocaleDateString()}</p>
                  </div>
                  <div className="mt-2 text-sm">
                    {displayDetails}
                    <p className="font-bold text-gray-300">~${Number(trade.total_value).toFixed(2)}</p>
                    <p className="text-gray-500 text-xs mt-1">Source: {trade.source}</p>
                  </div>
                </div>
                <a href={`https://solscan.io/tx/${trade.transaction_hash}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs break-all mt-4 text-blue-400 hover:underline self-start">
                  View on Solscan
                </a>
              </div>
            );
          })
        ) : (
          <div className="col-span-3 mt-8 text-center text-gray-400">
            <p>No {filter} transactions found.</p>
          </div>
        )}
      </div>
    </div>
  );
}; 