"use client";
import { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { Trade } from '@/lib/types';
import { cn } from '@/lib/utils';

interface PnLWidgetProps {
  trades?: Trade[];
}

type Timeframe = 'daily' | 'weekly' | 'monthly' | '6months' | 'yearly' | 'all';

export const PnLWidget = ({ trades = [] }: PnLWidgetProps) => {
  const [timeframe, setTimeframe] = useState<Timeframe>('daily');

  const pnlData = useMemo(() => {
    if (!trades || trades.length === 0) return { 
      daily: 0, 
      weekly: 0, 
      monthly: 0, 
      sixMonths: 0, 
      yearly: 0, 
      all: 0 
    };

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    let dailyPnL = 0;
    let weeklyPnL = 0;
    let monthlyPnL = 0;
    let sixMonthsPnL = 0;
    let yearlyPnL = 0;
    let allPnL = 0;

    trades.forEach(trade => {
      // Dates from the database are in ISO format
      const tradeDate = new Date(trade.trade_date);
      // Value from the database is already in USD
      const tradeValue = trade.total_value || 0;

      // Determine if it's a buy or sell from our 'trades' table structure
      const isBuy = trade.trade_type === 'buy';
      
      // For P&L calculation: buys are negative (money spent), sells are positive (money received)
      const pnlImpact = isBuy ? -tradeValue : tradeValue;

      // Daily P&L
      if (tradeDate >= oneDayAgo) {
        dailyPnL += pnlImpact;
      }

      // Weekly P&L
      if (tradeDate >= oneWeekAgo) {
        weeklyPnL += pnlImpact;
      }

      // Monthly P&L
      if (tradeDate >= oneMonthAgo) {
        monthlyPnL += pnlImpact;
      }

      // 6 Months P&L
      if (tradeDate >= sixMonthsAgo) {
        sixMonthsPnL += pnlImpact;
      }

      // Yearly P&L
      if (tradeDate >= oneYearAgo) {
        yearlyPnL += pnlImpact;
      }

      // All time P&L (start of wallet)
      allPnL += pnlImpact;
    });

    return { 
      daily: dailyPnL, 
      weekly: weeklyPnL, 
      monthly: monthlyPnL, 
      sixMonths: sixMonthsPnL, 
      yearly: yearlyPnL, 
      all: allPnL 
    };
  }, [trades]);

  const getCurrentPnL = () => {
    switch (timeframe) {
      case 'daily': return pnlData.daily;
      case 'weekly': return pnlData.weekly;
      case 'monthly': return pnlData.monthly;
      case '6months': return pnlData.sixMonths;
      case 'yearly': return pnlData.yearly;
      case 'all': return pnlData.all;
      default: return 0;
    }
  };

  const getTimeframeLabel = () => {
    switch (timeframe) {
      case 'daily': return '24h';
      case 'weekly': return '7d';
      case 'monthly': return '1mo';
      case '6months': return '6mo';
      case 'yearly': return '1y';
      case 'all': return 'All Time';
      default: return '';
    }
  };

  const currentPnL = getCurrentPnL();
  const isPositive = currentPnL > 0;
  const isNegative = currentPnL < 0;

  const timeframes: { key: Timeframe; label: string }[] = [
    { key: 'daily', label: '24h' },
    { key: 'weekly', label: '7d' },
    { key: 'monthly', label: '1mo' },
    { key: '6months', label: '6mo' },
    { key: 'yearly', label: '1y' },
    { key: 'all', label: 'All' }
  ];

  return (
    <div className="bg-gray-800/50 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">P&L Overview</h3>
        <div className="flex space-x-1">
          {timeframes.map((tf) => (
            <button
              key={tf.key}
              onClick={() => setTimeframe(tf.key)}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                timeframe === tf.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <DollarSign size={20} className="text-gray-400" />
            <span className="text-gray-300">
              {getTimeframeLabel()} P&L
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {isPositive && <TrendingUp size={16} className="text-green-400" />}
            {isNegative && <TrendingDown size={16} className="text-red-400" />}
            <span
              className={`text-xl font-bold ${
                isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-gray-300'
              }`}
            >
              ${currentPnL.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-700/50 rounded p-3">
            <div className="text-xs text-gray-400">24h</div>
            <div className={`text-sm font-semibold ${
              pnlData.daily > 0 ? 'text-green-400' : pnlData.daily < 0 ? 'text-red-400' : 'text-gray-300'
            }`}>
              ${pnlData.daily.toFixed(2)}
            </div>
          </div>
          <div className="bg-gray-700/50 rounded p-3">
            <div className="text-xs text-gray-400">7d</div>
            <div className={`text-sm font-semibold ${
              pnlData.weekly > 0 ? 'text-green-400' : pnlData.weekly < 0 ? 'text-red-400' : 'text-gray-300'
            }`}>
              ${pnlData.weekly.toFixed(2)}
            </div>
          </div>
          <div className="bg-gray-700/50 rounded p-3">
            <div className="text-xs text-gray-400">1mo</div>
            <div className={`text-sm font-semibold ${
              pnlData.monthly > 0 ? 'text-green-400' : pnlData.monthly < 0 ? 'text-red-400' : 'text-gray-300'
            }`}>
              ${pnlData.monthly.toFixed(2)}
            </div>
          </div>
          <div className="bg-gray-700/50 rounded p-3">
            <div className="text-xs text-gray-400">6mo</div>
            <div className={`text-sm font-semibold ${
              pnlData.sixMonths > 0 ? 'text-green-400' : pnlData.sixMonths < 0 ? 'text-red-400' : 'text-gray-300'
            }`}>
              ${pnlData.sixMonths.toFixed(2)}
            </div>
          </div>
          <div className="bg-gray-700/50 rounded p-3">
            <div className="text-xs text-gray-400">1y</div>
            <div className={`text-sm font-semibold ${
              pnlData.yearly > 0 ? 'text-green-400' : pnlData.yearly < 0 ? 'text-red-400' : 'text-gray-300'
            }`}>
              ${pnlData.yearly.toFixed(2)}
            </div>
          </div>
          <div className="bg-gray-700/50 rounded p-3">
            <div className="text-xs text-gray-400">All Time</div>
            <div className={`text-sm font-semibold ${
              pnlData.all > 0 ? 'text-green-400' : pnlData.all < 0 ? 'text-red-400' : 'text-gray-300'
            }`}>
              ${pnlData.all.toFixed(2)}
            </div>
          </div>
        </div>

        {trades.length === 0 && (
          <div className="text-center text-gray-400 py-4">
            <p>No trades found. Sync your trades to see P&L data.</p>
          </div>
        )}
      </div>
    </div>
  );
}; 