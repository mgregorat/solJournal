"use client";

import { useMemo } from 'react';
import { Metrics } from '../types';

export function usePortfolioMetrics(holdings: any[]) {
  const metrics: Metrics = useMemo(() => {
    if (!holdings || holdings.length === 0) {
      return { walletValue: 0, allTimePnl: 0, dailyPnl: 0, dailyPnlPercentage: 0 };
    }

    const totalWalletValue = holdings.reduce((acc: any, holding: any) => acc + (holding.currentValueUSD || 0), 0);
    const historicalWalletValue = holdings.reduce((acc: any, holding: any) => acc + (holding.historicalValueUSD || 0), 0);
    
    // TODO: Re-implement all-time P&L correctly later
    const allTimePnl = 0; 
    const dailyPnl = totalWalletValue - historicalWalletValue;
    const dailyPnlPercentage = historicalWalletValue === 0 ? 0 : (dailyPnl / historicalWalletValue) * 100;
    
    return {
        walletValue: totalWalletValue,
        allTimePnl: allTimePnl,
        dailyPnl: dailyPnl,
        dailyPnlPercentage: dailyPnlPercentage
    };
  }, [holdings]);

  return { metrics };
} 