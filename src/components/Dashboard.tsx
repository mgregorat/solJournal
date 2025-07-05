"use client";
import { useMemo } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Wallet, PieChart, Activity, Target, Zap, ArrowUpRight, ArrowDownRight, Eye, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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

interface DashboardProps {
  holdings: TokenHolding[];
  onNavigateToHoldings: () => void;
  onNavigateToJournal?: () => void;
  isLoading?: boolean;
}

const formatCurrency = (value: number) => {
  const options: Intl.NumberFormatOptions = {
    style: 'currency',
    currency: 'USD',
  };

  if (Math.abs(value) > 0 && Math.abs(value) < 0.01) {
    options.minimumFractionDigits = 2;
    options.maximumFractionDigits = 8;
  } else {
    options.minimumFractionDigits = 2;
    options.maximumFractionDigits = 2;
  }

  return new Intl.NumberFormat('en-US', options).format(value);
};

const formatPercentage = (value: number) => {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
};

export const Dashboard = ({ holdings, onNavigateToHoldings, onNavigateToJournal, isLoading = false }: DashboardProps) => {
  // Calculate comprehensive metrics from holdings data
  const metrics = useMemo(() => {
    const totalValue = holdings.reduce((sum, holding) => sum + (holding.currentValueUSD || 0), 0);
    const totalCostBasis = holdings.reduce((sum, holding) => sum + (holding.totalCostBasis || 0), 0);
    const totalUnrealizedPnL = holdings.reduce((sum, holding) => sum + (holding.unrealizedPnL || 0), 0);
    
    const profitablePositions = holdings.filter(h => !h.isNativeSOL && (h.pnlPercentage || 0) > 0);
    const losingPositions = holdings.filter(h => !h.isNativeSOL && (h.pnlPercentage || 0) < 0);
    
    const bestPerformer = holdings
      .filter(h => !h.isNativeSOL && h.pnlPercentage)
      .sort((a, b) => (b.pnlPercentage || 0) - (a.pnlPercentage || 0))[0];
    
    const worstPerformer = holdings
      .filter(h => !h.isNativeSOL && h.pnlPercentage)
      .sort((a, b) => (a.pnlPercentage || 0) - (b.pnlPercentage || 0))[0];
    
    const avgPnLPercentage = holdings
      .filter(h => !h.isNativeSOL && h.pnlPercentage)
      .reduce((sum, h, _, arr) => sum + (h.pnlPercentage || 0) / arr.length, 0);

    return {
      totalValue,
      totalCostBasis,
      totalUnrealizedPnL,
      totalPnLPercentage: totalCostBasis > 0 ? (totalUnrealizedPnL / totalCostBasis) * 100 : 0,
      profitableCount: profitablePositions.length,
      losingCount: losingPositions.length,
      totalPositions: holdings.filter(h => !h.isNativeSOL).length,
      winRate: holdings.filter(h => !h.isNativeSOL).length > 0 
        ? (profitablePositions.length / holdings.filter(h => !h.isNativeSOL).length) * 100 
        : 0,
      bestPerformer,
      worstPerformer,
      avgPnLPercentage,
      largestPosition: holdings.sort((a, b) => (b.currentValueUSD || 0) - (a.currentValueUSD || 0))[0]
    };
  }, [holdings]);

  const StatCard = ({ 
    title, 
    value, 
    subtitle, 
    icon: Icon, 
    trend, 
    trendValue, 
    onClick,
    className = ""
  }: {
    title: string;
    value: string;
    subtitle?: string;
    icon: any;
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: string;
    onClick?: () => void;
    className?: string;
  }) => (
    <Card 
      className={`bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 hover:border-gray-600 transition-all duration-200 ${onClick ? 'cursor-pointer hover:scale-105' : ''} ${className}`}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${
              trend === 'up' ? 'bg-green-500/20 text-green-400' :
              trend === 'down' ? 'bg-red-500/20 text-red-400' :
              'bg-blue-500/20 text-blue-400'
            }`}>
              <Icon size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-400 font-medium">{title}</p>
              <p className="text-2xl font-bold text-white">{value}</p>
              {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
            </div>
          </div>
          {trendValue && (
            <div className={`flex items-center space-x-1 text-sm font-semibold ${
              trend === 'up' ? 'text-green-400' :
              trend === 'down' ? 'text-red-400' :
              'text-gray-400'
            }`}>
              {trend === 'up' && <ArrowUpRight size={16} />}
              {trend === 'down' && <ArrowDownRight size={16} />}
              <span>{trendValue}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const PositionCard = ({ 
    holding, 
    isTop = false 
  }: { 
    holding: TokenHolding; 
    isTop?: boolean;
  }) => (
    <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700">
      <div className="flex items-center space-x-3">
        {holding.logoURI && (
          <img 
            src={holding.logoURI} 
            alt={holding.symbol} 
            className="w-8 h-8 rounded-full"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        )}
        <div>
          <p className="font-semibold text-white">{holding.symbol}</p>
          <p className="text-xs text-gray-400">{holding.name}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-semibold text-white">
          {formatCurrency(holding.currentValueUSD || 0)}
        </p>
        {!holding.isNativeSOL && holding.pnlPercentage && (
          <p className={`text-xs font-medium ${
            holding.pnlPercentage > 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {formatPercentage(holding.pnlPercentage)}
          </p>
        )}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-800 rounded-lg"></div>
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-64 bg-gray-800 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-900/20 via-purple-900/20 to-pink-900/20 rounded-2xl border border-gray-700">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5"></div>
        <div className="relative p-8">
          <div className="flex items-center justify-between">
                         <div>
               <h1 className="text-4xl font-bold text-white mb-2">Portfolio Overview</h1>
               <p className="text-gray-400">Live portfolio tracking and analytics</p>
             </div>
            <div className="text-right">
              <p className="text-sm text-gray-400 mb-1">Total Portfolio Value</p>
              <p className="text-4xl font-bold text-white">{formatCurrency(metrics.totalValue)}</p>
              <div className={`flex items-center justify-end space-x-1 text-lg font-semibold ${
                metrics.totalPnLPercentage > 0 ? 'text-green-400' : 
                metrics.totalPnLPercentage < 0 ? 'text-red-400' : 'text-gray-400'
              }`}>
                {metrics.totalPnLPercentage > 0 ? <TrendingUp size={20} /> : 
                 metrics.totalPnLPercentage < 0 ? <TrendingDown size={20} /> : null}
                <span>{formatCurrency(metrics.totalUnrealizedPnL)}</span>
                <span className="text-sm">({formatPercentage(metrics.totalPnLPercentage)})</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Positions"
          value={metrics.totalPositions.toString()}
          icon={Target}
          trend="neutral"
          onClick={onNavigateToHoldings}
          subtitle={`${metrics.profitableCount} profitable • ${metrics.losingCount} losing`}
        />
        
        <StatCard
          title="Win Rate"
          value={`${metrics.winRate.toFixed(1)}%`}
          icon={Activity}
          trend={metrics.winRate > 50 ? 'up' : metrics.winRate < 50 ? 'down' : 'neutral'}
          trendValue={metrics.winRate > 50 ? 'Above 50%' : metrics.winRate < 50 ? 'Below 50%' : 'Neutral'}
        />
        
        <StatCard
          title="Cost Basis"
          value={formatCurrency(metrics.totalCostBasis)}
          icon={DollarSign}
          trend="neutral"
          subtitle="Total invested"
        />
        
        <StatCard
          title="Avg Position P&L"
          value={formatPercentage(metrics.avgPnLPercentage)}
          icon={TrendingUp}
          trend={metrics.avgPnLPercentage > 0 ? 'up' : metrics.avgPnLPercentage < 0 ? 'down' : 'neutral'}
          trendValue={`${metrics.avgPnLPercentage > 0 ? '+' : ''}${metrics.avgPnLPercentage.toFixed(1)}%`}
        />
      </div>

      {/* Performance & Positions Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Performers */}
        <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-white">
              <Zap className="text-green-400" size={20} />
              <span>Performance Highlights</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {metrics.bestPerformer && (
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-sm text-green-400 font-medium mb-2">🚀 Best Performer</p>
                <PositionCard holding={metrics.bestPerformer} isTop />
              </div>
            )}
            
            {metrics.worstPerformer && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-sm text-red-400 font-medium mb-2">📉 Needs Attention</p>
                <PositionCard holding={metrics.worstPerformer} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Largest Positions */}
        <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-white">
              <PieChart className="text-blue-400" size={20} />
              <span>Position Breakdown</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {holdings
              .sort((a, b) => (b.currentValueUSD || 0) - (a.currentValueUSD || 0))
              .slice(0, 4)
              .map((holding, index) => (
                <div key={holding.mint}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">#{index + 1} Largest Position</span>
                    <span className="text-xs text-gray-500">
                      {((holding.currentValueUSD || 0) / metrics.totalValue * 100).toFixed(1)}% of portfolio
                    </span>
                  </div>
                  <PositionCard holding={holding} />
                </div>
              ))}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center justify-center space-x-4 pt-4">
        <Button 
          onClick={onNavigateToHoldings}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 rounded-lg font-semibold transition-all duration-200 hover:scale-105"
        >
          <Eye className="mr-2" size={16} />
          View All Holdings
        </Button>
        
        <Button 
          onClick={onNavigateToJournal}
          variant="outline"
          className="border-gray-600 text-gray-300 hover:bg-gray-800 px-8 py-3 rounded-lg font-semibold transition-all duration-200"
        >
          <Clock className="mr-2" size={16} />
          Trading History
        </Button>
      </div>
    </div>
  );
};
