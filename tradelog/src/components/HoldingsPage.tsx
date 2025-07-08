"use client";
import { useState, useMemo, useEffect, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { ExternalLink, TrendingUp, TrendingDown, Calendar, DollarSign, Grid3X3, List, RefreshCw, Clock, Play, Pause, ArrowUpDown, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
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
  currentValueSOL?: number;
  avgEntryPrice?: number;
  totalCostBasis?: number;
  firstBuyDate?: string;
  unrealizedPnL?: number;
  pnlPercentage?: number;
  sparklineData?: number[];
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
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(true);
  const [countdown, setCountdown] = useState(10);
  const [sortBy, setSortBy] = useState<'amount' | 'value' | 'pnl' | 'symbol' | 'none'>('value');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: string } | null>({ key: 'currentValueUSD', direction: 'desc' });

  const totalValue = useMemo(() => {
    return holdings.reduce((acc, token) => acc + (token.currentValueUSD || 0), 0);
  }, [holdings]);

  const totalPnl = useMemo(() => {
    return holdings.reduce((acc, holding) => acc + (holding.unrealizedPnL || 0), 0);
  }, [holdings]);

  const totalPnlPercentage = useMemo(() => {
    const totalCost = holdings.reduce((acc, holding) => acc + (holding.totalCostBasis || 0), 0);
    if (totalCost === 0) return 0;
    return (totalPnl / totalCost) * 100;
  }, [holdings, totalPnl]);

  // Sorted holdings based on current sort criteria
  const sortedHoldings = useMemo(() => {
    if (sortBy === 'none') return holdings;

    const sorted = [...holdings].sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      switch (sortBy) {
        case 'amount':
          aValue = a.amount || 0;
          bValue = b.amount || 0;
          break;
        case 'value':
          aValue = a.currentValueUSD || 0;
          bValue = b.currentValueUSD || 0;
          break;
        case 'pnl':
          // For native SOL, treat P&L as 0 for sorting purposes
          aValue = a.isNativeSOL ? 0 : (a.pnlPercentage || 0);
          bValue = b.isNativeSOL ? 0 : (b.pnlPercentage || 0);
          break;
        case 'symbol':
          aValue = a.symbol || a.mint;
          bValue = b.symbol || b.mint;
          break;
        default:
          return 0;
      }

      // Handle string comparison for symbols
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      // Handle numeric comparison
      const numA = Number(aValue);
      const numB = Number(bValue);
      
      return sortOrder === 'asc' ? numA - numB : numB - numA;
    });

    return sorted;
  }, [holdings, sortBy, sortOrder]);

  // Function to handle sort change
  const handleSort = (newSortBy: typeof sortBy) => {
    if (sortBy === newSortBy) {
      // Toggle sort order if same column
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new sort column with default desc order (except for symbol)
      setSortBy(newSortBy);
      setSortOrder(newSortBy === 'symbol' ? 'asc' : 'desc');
    }
  };

  // Auto-refresh functionality
  useEffect(() => {
    if (isAutoRefreshEnabled && publicKey && !isLoading) {
      // Clear any existing intervals
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }

      // Reset countdown
      setCountdown(10);

      // Set up countdown interval (updates every second)
      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            return 10; // Reset to 10 when it reaches 0
          }
          return prev - 1;
        });
      }, 1000);

      // Set up refresh interval (every 10 seconds)
      intervalRef.current = setInterval(() => {
        console.log('Auto-refreshing holdings...');
        onRefresh();
        setCountdown(10); // Reset countdown after refresh
      }, 10000);

      // Cleanup function
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
        }
      };
    } else {
      // Cleanup if auto-refresh is disabled
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [isAutoRefreshEnabled, publicKey, isLoading, onRefresh]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  const WRAPPED_SOL_MINT = "So11111111111111111111111111111111111111112";

  const SparklineChart = ({ data }: { data: number[] }) => {
    if (!data || data.length < 2) return null;

    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min;
    const width = 60;
    const height = 20;

    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    }).join(' ');

    const isPositive = data[data.length - 1] > data[0];
    const color = isPositive ? '#10b981' : '#ef4444';

    return (
      <svg width={width} height={height} className="flex-shrink-0">
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          points={points}
        />
      </svg>
    );
  };

  if (!publicKey) {
    return <ConnectWalletPrompt />;
  }

  if (isLoading && holdings.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isLoading && holdings.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="text-center">
          <p className="text-lg font-semibold">No tokens found in your wallet</p>
          <p className="text-sm mt-2">Start trading to see your holdings here</p>
        </div>
      </div>
    );
  }

  const renderGridView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {sortedHoldings.map((token) => {
        const displaySymbol = token.mint === WRAPPED_SOL_MINT ? 'SOL' : token.symbol;
        return (
          <div key={token.mint} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            {/* Token Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                {token.logoURI && (
                  <img
                    src={token.logoURI}
                    alt={displaySymbol || 'token'}
                    className="w-6 h-6 rounded-full"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
                <div>
                  <div className="font-semibold text-white">
                    {displaySymbol || 'Unknown'}
                  </div>
                  <div className="text-xs text-gray-400">
                    {token.name || token.mint.slice(0, 8) + '...'}
                  </div>
                </div>
              </div>
              <SparklineChart data={token.sparklineData || []} />
            </div>

            {/* Token Amount */}
            <div className="mb-3">
              <div className="text-sm text-gray-400">💼 Tokens Held</div>
              <div className="text-lg font-semibold text-white">
                {(token.amount).toLocaleString(undefined, {
                  minimumFractionDigits: (displaySymbol === 'SOL') ? 4 : 2,
                  maximumFractionDigits: (displaySymbol === 'SOL') ? 4 : 2
                })} {displaySymbol}
              </div>
            </div>

            {/* Current Value */}
            <div className="mb-3">
              <div className="text-sm text-gray-400">💰 Current Value</div>
              <div className="text-lg font-semibold text-white">
                ${token.currentValueUSD?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            {/* P&L */}
            <div className="mb-3">
              <div className="text-sm text-gray-400">📈 Unrealized P&L</div>
              {token.isNativeSOL ? (
                <div className="text-sm font-semibold text-gray-300">
                  <span>N/A (Native SOL)</span>
                </div>
              ) : (
                <>
                  <div className={`text-sm font-semibold flex items-center space-x-1 ${
                    token.pnlPercentage && token.pnlPercentage > 0 ? 'text-green-400' :
                    token.pnlPercentage && token.pnlPercentage < 0 ? 'text-red-400' : 'text-gray-300'
                  }`}>
                    {token.pnlPercentage && token.pnlPercentage > 0 && <TrendingUp size={12} />}
                    {token.pnlPercentage && token.pnlPercentage < 0 && <TrendingDown size={12} />}
                    <span>
                      {token.pnlPercentage ? `${token.pnlPercentage > 0 ? '+' : ''}${token.pnlPercentage.toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                  <div className={`text-xs ${
                    token.unrealizedPnL && token.unrealizedPnL > 0 ? 'text-green-400' :
                    token.unrealizedPnL && token.unrealizedPnL < 0 ? 'text-red-400' : 'text-gray-400'
                  }`}>
                    {token.unrealizedPnL ? `${token.unrealizedPnL > 0 ? '+' : ''}$${token.unrealizedPnL.toFixed(2)}` : ''}
                  </div>
                </>
              )}
            </div>

            {/* Entry Price */}
            <div className="mb-3">
              <div className="text-sm text-gray-400">💸 Avg Entry Price</div>
              <div className="text-sm font-medium text-white">
                {token.isNativeSOL ? 'N/A (Native SOL)' : (token.avgEntryPrice ? `$${token.avgEntryPrice.toFixed(6)}` : 'N/A')}
              </div>
            </div>

            {/* First Buy Date */}
            <div className="mb-4">
              <div className="text-sm text-gray-400 flex items-center space-x-1">
                <Calendar size={12} />
                <span>First Buy</span>
              </div>
              <div className="text-sm text-white">
                {token.firstBuyDate || 'N/A'}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs"
                onClick={() => window.open(
                  token.isNativeSOL 
                    ? `https://solscan.io/account/${walletAddress || publicKey?.toBase58()}` 
                    : `https://solscan.io/token/${token.mint}`, 
                  '_blank'
                )}
              >
                <ExternalLink size={12} className="mr-1" />
                Solscan
              </Button>
              {!token.isNativeSOL && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={() => window.open(`https://birdeye.so/token/${token.mint}`, '_blank')}
                >
                  <ExternalLink size={12} className="mr-1" />
                  Birdeye
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderListView = () => (
    <div className="bg-gray-800/30 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-700/50">
            <tr>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-600/50 transition-colors"
                onClick={() => handleSort('symbol')}
              >
                <div className="flex items-center">
                  Token
                  {sortBy === 'symbol' ? (
                    sortOrder === 'asc' ? <ArrowUp size={12} className="ml-1" /> : <ArrowDown size={12} className="ml-1" />
                  ) : (
                    <ArrowUpDown size={12} className="ml-1 opacity-50" />
                  )}
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-600/50 transition-colors"
                onClick={() => handleSort('amount')}
              >
                <div className="flex items-center">
                  Amount
                  {sortBy === 'amount' ? (
                    sortOrder === 'asc' ? <ArrowUp size={12} className="ml-1" /> : <ArrowDown size={12} className="ml-1" />
                  ) : (
                    <ArrowUpDown size={12} className="ml-1 opacity-50" />
                  )}
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-600/50 transition-colors"
                onClick={() => handleSort('value')}
              >
                <div className="flex items-center">
                  Value
                  {sortBy === 'value' ? (
                    sortOrder === 'asc' ? <ArrowUp size={12} className="ml-1" /> : <ArrowDown size={12} className="ml-1" />
                  ) : (
                    <ArrowUpDown size={12} className="ml-1 opacity-50" />
                  )}
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-600/50 transition-colors"
                onClick={() => handleSort('pnl')}
              >
                <div className="flex items-center">
                  P&L
                  {sortBy === 'pnl' ? (
                    sortOrder === 'asc' ? <ArrowUp size={12} className="ml-1" /> : <ArrowDown size={12} className="ml-1" />
                  ) : (
                    <ArrowUpDown size={12} className="ml-1 opacity-50" />
                  )}
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Entry Price</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">First Buy</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Links</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {sortedHoldings.map((token) => {
              const displaySymbol = token.mint === WRAPPED_SOL_MINT ? 'SOL' : token.symbol;
              return (
                <tr key={token.mint} className="hover:bg-gray-700/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-3">
                      {token.logoURI && (
                        <img
                          src={token.logoURI}
                          alt={displaySymbol || 'token'}
                          className="w-6 h-6 rounded-full"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                      <div>
                        <div className="font-medium text-white">
                          {displaySymbol || 'Unknown'}
                        </div>
                        <div className="text-xs text-gray-400">
                          {token.name || token.mint.slice(0, 8) + '...'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-white">
                    {(token.amount).toLocaleString(undefined, {
                      minimumFractionDigits: (displaySymbol === 'SOL') ? 4 : 2,
                      maximumFractionDigits: (displaySymbol === 'SOL') ? 4 : 2
                    })}
                  </td>
                  <td className="px-4 py-3 text-sm text-white">
                    ${token.currentValueUSD?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {token.isNativeSOL ? (
                      <div className="font-semibold text-gray-300">
                        N/A (Native SOL)
                      </div>
                    ) : (
                      <>
                        <div className={`font-semibold flex items-center space-x-1 ${
                          token.pnlPercentage && token.pnlPercentage > 0 ? 'text-green-400' :
                          token.pnlPercentage && token.pnlPercentage < 0 ? 'text-red-400' : 'text-gray-300'
                        }`}>
                          {token.pnlPercentage && token.pnlPercentage > 0 && <TrendingUp size={12} />}
                          {token.pnlPercentage && token.pnlPercentage < 0 && <TrendingDown size={12} />}
                          <span>
                            {token.pnlPercentage ? `${token.pnlPercentage > 0 ? '+' : ''}${token.pnlPercentage.toFixed(1)}%` : 'N/A'}
                          </span>
                        </div>
                        <div className={`text-xs ${
                          token.unrealizedPnL && token.unrealizedPnL > 0 ? 'text-green-400' :
                          token.unrealizedPnL && token.unrealizedPnL < 0 ? 'text-red-400' : 'text-gray-400'
                        }`}>
                          {token.unrealizedPnL ? `${token.unrealizedPnL > 0 ? '+' : ''}$${token.unrealizedPnL.toFixed(2)}` : 'N/A'}
                        </div>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-white">
                    {token.isNativeSOL ? 'N/A (Native SOL)' : (token.avgEntryPrice ? `$${token.avgEntryPrice.toFixed(6)}` : 'N/A')}
                  </td>
                  <td className="px-4 py-3 text-sm text-white">
                    {token.firstBuyDate || 'N/A'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs"
                        onClick={() => window.open(
                          token.isNativeSOL 
                            ? `https://solscan.io/account/${walletAddress || publicKey?.toBase58()}` 
                            : `https://solscan.io/token/${token.mint}`, 
                          '_blank'
                        )}
                      >
                        <ExternalLink size={12} className="mr-1" />
                        Solscan
                      </Button>
                      {!token.isNativeSOL && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs"
                          onClick={() => window.open(`https://birdeye.so/token/${token.mint}`, '_blank')}
                        >
                          <ExternalLink size={12} className="mr-1" />
                          Birdeye
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 mb-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-white">Holdings</h1>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={onRefresh}
                disabled={isLoading}
                className="h-8 w-8"
                title="Manual refresh"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
              <Button
                variant={isAutoRefreshEnabled ? "default" : "outline"}
                size="sm"
                onClick={() => setIsAutoRefreshEnabled(!isAutoRefreshEnabled)}
                className="h-8 px-3 text-xs"
                title={isAutoRefreshEnabled ? "Disable auto-refresh (10s)" : "Enable auto-refresh (10s)"}
              >
                {isAutoRefreshEnabled ? <Pause size={12} className="mr-1" /> : <Play size={12} className="mr-1" />}
                Auto
              </Button>
              {isAutoRefreshEnabled && (
                <div className="text-xs text-gray-400 flex items-center">
                  <Clock size={12} className="mr-1" />
                  {countdown}s
                </div>
              )}
            </div>
          </div>
          
          <div className="text-gray-400">
            <div className="flex items-center gap-2">
              <div>
                Total Portfolio Value:{" "}
                <span className="text-lg font-semibold text-white">
                  ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              {isAutoRefreshEnabled && (
                <div className="flex items-center text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded">
                  <div className="w-2 h-2 bg-green-400 rounded-full mr-1 animate-pulse"></div>
                  Live
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2 rounded-lg bg-gray-800 p-1">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="p-2"
            >
              <Grid3X3 size={16} />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="p-2"
            >
              <List size={16} />
            </Button>
          </div>
        </div>
        
        {/* Sort Controls */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Sort by:</span>
          <div className="flex items-center gap-1">
            <Button
              variant={sortBy === 'symbol' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => handleSort('symbol')}
              className="h-7 px-2 text-xs"
            >
              Name
              {sortBy === 'symbol' && (
                sortOrder === 'asc' ? <ArrowUp size={12} className="ml-1" /> : <ArrowDown size={12} className="ml-1" />
              )}
            </Button>
            <Button
              variant={sortBy === 'amount' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => handleSort('amount')}
              className="h-7 px-2 text-xs"
            >
              Amount
              {sortBy === 'amount' && (
                sortOrder === 'asc' ? <ArrowUp size={12} className="ml-1" /> : <ArrowDown size={12} className="ml-1" />
              )}
            </Button>
            <Button
              variant={sortBy === 'value' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => handleSort('value')}
              className="h-7 px-2 text-xs"
            >
              Value
              {sortBy === 'value' && (
                sortOrder === 'asc' ? <ArrowUp size={12} className="ml-1" /> : <ArrowDown size={12} className="ml-1" />
              )}
            </Button>
            <Button
              variant={sortBy === 'pnl' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => handleSort('pnl')}
              className="h-7 px-2 text-xs"
            >
              P&L
              {sortBy === 'pnl' && (
                sortOrder === 'asc' ? <ArrowUp size={12} className="ml-1" /> : <ArrowDown size={12} className="ml-1" />
              )}
            </Button>
            <div className="w-px h-4 bg-gray-600 mx-1"></div>
            <Button
              variant={sortBy === 'none' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setSortBy('none')}
              className="h-7 px-2 text-xs"
            >
              Default
            </Button>
          </div>
        </div>
      </div>
      
      <div className='w-full'>
          <PortfolioPieChart holdings={sortedHoldings} />
      </div>

      {viewMode === 'grid' ? renderGridView() : renderListView()}
    </div>
  );
}; 