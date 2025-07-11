"use client";
import { useState, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { ExternalLink, TrendingUp, TrendingDown, Grid3X3, List, RefreshCw, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import ConnectWalletPrompt from './ConnectWalletPrompt';
import { PortfolioPieChart } from './PortfolioPieChart';
import { toast } from 'sonner';

interface TokenHolding {
  mint: string;
  amount: number;
  decimals: number;
  symbol?: string;
  name?: string;
  logoURI?: string;
  currentPrice?: number;
  currentValueUSD?: number;
  avgEntryPrice?: number;
  totalCostBasis?: number;
  unrealizedPnL?: number;
  pnlPercentage?: number;
  isNativeSOL?: boolean;
}

interface HoldingsPageProps {
    holdings: TokenHolding[];
    isLoading: boolean;
    onRefresh: () => void;
    walletAddress?: string;
}

export const HoldingsPage = ({ holdings, isLoading, onRefresh, walletAddress }: HoldingsPageProps) => {
  const { publicKey } = useWallet();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'value' | 'pnl' | 'symbol'>('value');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const sortedHoldings = useMemo(() => {
    return [...holdings].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case 'value':
          aValue = a.currentValueUSD || 0;
          bValue = b.currentValueUSD || 0;
          break;
        case 'pnl':
          aValue = a.isNativeSOL ? -Infinity : a.unrealizedPnL ?? -Infinity;
          bValue = b.isNativeSOL ? -Infinity : b.unrealizedPnL ?? -Infinity;
          break;
        case 'symbol':
          aValue = a.symbol || '';
          bValue = b.symbol || '';
          break;
        default:
          return 0;
      }

      if (typeof aValue === 'string') {
        return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });
  }, [holdings, sortBy, sortOrder]);

  const handleSort = (newSortBy: 'value' | 'pnl' | 'symbol') => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  const handleManualRefresh = () => {
    toast.info('Refreshing holdings data...');
    onRefresh();
  };

  if (!publicKey) return <ConnectWalletPrompt />;

  if (isLoading && holdings.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isLoading && holdings.length === 0) {
    return (
      <div className="text-center p-8">
        <h2 className="text-xl font-semibold">No Holdings Found</h2>
        <p className="text-gray-400 mt-2">Connect your wallet or perform a trade to see your holdings here.</p>
      </div>
    );
  }
  
  const renderHeader = () => (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Your Holdings</h1>
          <p className="text-gray-400">Overview of your token assets</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={handleManualRefresh} variant="outline" size="sm" className="h-9" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
          <Button onClick={() => setViewMode('grid')} variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" className="h-9 w-9"><Grid3X3 className="h-4 w-4" /></Button>
          <Button onClick={() => setViewMode('list')} variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-9 w-9"><List className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );

  const renderSortControls = () => (
     <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-gray-400">Sort by:</span>
        <Button variant={sortBy === 'value' ? 'secondary' : 'ghost'} size="sm" onClick={() => handleSort('value')}>Value {sortBy === 'value' && (sortOrder === 'asc' ? <ArrowUp size={12} className="ml-1" /> : <ArrowDown size={12} className="ml-1" />)}</Button>
        <Button variant={sortBy === 'pnl' ? 'secondary' : 'ghost'} size="sm" onClick={() => handleSort('pnl')}>P&L {sortBy === 'pnl' && (sortOrder === 'asc' ? <ArrowUp size={12} className="ml-1" /> : <ArrowDown size={12} className="ml-1" />)}</Button>
        <Button variant={sortBy === 'symbol' ? 'secondary' : 'ghost'} size="sm" onClick={() => handleSort('symbol')}>Name {sortBy === 'symbol' && (sortOrder === 'asc' ? <ArrowUp size={12} className="ml-1" /> : <ArrowDown size={12} className="ml-1" />)}</Button>
     </div>
  );

  const renderGridView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {sortedHoldings.map((token) => (
        <div key={token.mint} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2 overflow-hidden">
                {token.logoURI && <img src={token.logoURI} alt={token.symbol} className="w-8 h-8 rounded-full" />}
                <div className="overflow-hidden">
                  <div className="font-semibold text-white truncate">{token.symbol}</div>
                  <div className="text-xs text-gray-400 truncate">{token.name}</div>
                </div>
              </div>
            </div>
            <div className="text-sm text-gray-400">Value</div>
            <div className="text-lg font-semibold text-white mb-2">${token.currentValueUSD?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="text-sm text-gray-400">P&L</div>
            <div className={`text-sm font-semibold ${token.unrealizedPnL && token.unrealizedPnL > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {token.isNativeSOL ? 'N/A' : `${token.unrealizedPnL?.toFixed(2)}$ (${token.pnlPercentage?.toFixed(2)}%)`}
            </div>
          </div>
          <div className="flex space-x-2 mt-4">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => window.open(`https://solscan.io/token/${token.mint}`, '_blank')}><ExternalLink size={12} className="mr-1" /> Solscan</Button>
          </div>
        </div>
      ))}
    </div>
  );

  const renderListView = () => (
    <div className="bg-gray-800/30 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-700/50">
            <tr>
              <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase">Token</th>
              <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase">Amount</th>
              <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase">Value</th>
              <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase">P&L</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {sortedHoldings.map(token => (
              <tr key={token.mint}>
                <td className="p-3">
                  <div className="flex items-center space-x-3">
                    {token.logoURI && <img src={token.logoURI} alt={token.symbol} className="w-8 h-8 rounded-full" />}
                    <div>
                      <div className="font-semibold text-white">{token.symbol}</div>
                      <div className="text-xs text-gray-400">{token.name}</div>
                    </div>
                  </div>
                </td>
                <td className="p-3">{token.amount.toLocaleString()}</td>
                <td className="p-3">${token.currentValueUSD?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className={`p-3 ${token.unrealizedPnL && token.unrealizedPnL > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {token.isNativeSOL ? 'N/A' : `${token.unrealizedPnL?.toFixed(2)}$ (${token.pnlPercentage?.toFixed(2)}%)`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
    </div>
  );

  return (
    <div className="space-y-4">
      {renderHeader()}
      <div className='w-full'><PortfolioPieChart holdings={holdings} /></div>
      {renderSortControls()}
      {viewMode === 'grid' ? renderGridView() : renderListView()}
    </div>
  );
}; 