"use client";

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { usePrivy } from '@privy-io/react-auth';
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { cn } from '@/lib/utils';
import { DailyPnlData } from '@/lib/pnl'; // Import the type
import { useWalletFilter } from '@/app/contexts/WalletFilterContext';
import { authedFetchClient, parseApiResponse } from '@/lib/authedFetch';

export const DailyPnlDisplay = () => {
  const { getAccessToken } = usePrivy();
  const getBearerToken = async () => (await getAccessToken?.()) || null;
  const { publicKey } = useWallet();
  const { dbUserId, selectedWalletId, selectedWallet } = useWalletFilter();
  const [pnlData, setPnlData] = useState<DailyPnlData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dbUserId) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        let url = `/api/pnl/today`;
        if (selectedWalletId !== null) {
          url += `?walletId=${selectedWalletId}`;
        }

        const response = await authedFetchClient(getBearerToken, url);
        const data = await parseApiResponse<DailyPnlData>(response);
        setPnlData(data);
      } catch (err: any) {
        setError(err.message);
        console.error("Error fetching P&L data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    // Refresh every 60 seconds
    const interval = setInterval(fetchData, 60000); 

    return () => clearInterval(interval);
  }, [dbUserId, selectedWalletId, selectedWallet]);

  const getPnlColor = (pnl?: number): string => {
    if (pnl === undefined || pnl === null || pnl === 0) return 'text-gray-300';
    return pnl > 0 ? 'text-green-400' : 'text-red-400';
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center h-24">
          <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center space-x-3 text-red-400">
          <AlertCircle size={24} />
          <div>
            <p className="font-semibold">Could not load P&L data</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      );
    }
    
    if (!publicKey) {
        return <p className="text-gray-400">Connect your wallet to see your daily P&L.</p>;
    }

    if (!pnlData) {
      return <p className="text-gray-400">No P&L data available for today.</p>;
    }

    // Special message for the first day
    if (pnlData.pnl_usd === 0 && pnlData.pnl_percent === 0 && pnlData.current_balance_usd > 0) {
        return (
            <div>
                <p className="text-lg text-gray-300">Your first daily P&L snapshot is ready!</p>
                <p className="text-sm text-gray-400">Check back tomorrow to see your performance. Your current balance is ${pnlData.current_balance_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.</p>
            </div>
        )
    }

    return (
      <div className="flex items-center space-x-6">
        <div className={cn("text-4xl font-bold flex items-center", getPnlColor(pnlData.pnl_percent))}>
          {pnlData.pnl_percent >= 0 ? <TrendingUp size={36} className="mr-3" /> : <TrendingDown size={36} className="mr-3" />}
          {pnlData.pnl_percent.toFixed(2)}%
        </div>
        <div className="text-gray-300 border-l border-gray-600 pl-6">
          <div className="text-md">24H Profit / Loss</div>
          <div className={cn("text-xl font-medium", getPnlColor(pnlData.pnl_usd))}>
            ${pnlData.pnl_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Performance</CardTitle>
      </CardHeader>
      <CardContent>
        {renderContent()}
      </CardContent>
    </Card>
  );
}; 
