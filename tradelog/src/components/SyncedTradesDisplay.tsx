'use client';
import { Trade } from '@/lib/types';

interface SyncedTradesDisplayProps {
    trades: Trade[];
}

export const SyncedTradesDisplay = ({ trades }: SyncedTradesDisplayProps) => {
  if (!trades || trades.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        <p>No trades to display</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="px-4 py-2 text-left">Date</th>
            <th className="px-4 py-2 text-left">Token</th>
            <th className="px-4 py-2 text-left">Type</th>
            <th className="px-4 py-2 text-left">Amount</th>
            <th className="px-4 py-2 text-left">Price</th>
            <th className="px-4 py-2 text-left">Total Value</th>
            <th className="px-4 py-2 text-left">Source</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => (
            <tr key={trade.id} className="border-b">
              <td className="px-4 py-2">{new Date(trade.trade_date).toLocaleDateString()}</td>
              <td className="px-4 py-2">{trade.token_symbol}</td>
              <td className="px-4 py-2">
                <span className={`px-2 py-1 rounded text-xs ${
                  trade.trade_type === 'buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {trade.trade_type}
                </span>
              </td>
              <td className="px-4 py-2">{trade.amount.toFixed(4)}</td>
              <td className="px-4 py-2">${trade.price.toFixed(4)}</td>
              <td className="px-4 py-2">${trade.total_value.toFixed(2)}</td>
              <td className="px-4 py-2">{trade.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}; 