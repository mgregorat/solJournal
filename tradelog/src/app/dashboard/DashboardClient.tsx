"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { HoldingsPage } from "@/components/HoldingsPage";
import { Dashboard } from "@/components/Dashboard";
import { WalletConnection } from "@/components/WalletConnection";
import { JournalPage } from "@/components/JournalPage";
import { WatchlistPage } from "@/components/WatchlistPage";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Trade, Holding, User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import TradeForm from "@/components/TradeForm";
import { WalletFilterProvider } from "@/app/contexts/WalletFilterContext";
import { WalletSelector } from "@/components/WalletSelector";

export function DashboardClient({ initialTrades: propInitialTrades, initialHoldings: propInitialHoldings }: any) {
  const { publicKey, connected } = useWallet();

  const [dbUser, setDbUser] = useState<User | null>(null);
  const [wallets, setWallets] = useState<any[]>([]);
  const [trades, setTrades] = useState<Trade[]>(propInitialTrades || []);
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>(propInitialHoldings || []);
  const [journalEvents, setJournalEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeItem, setActiveItem] = useState("Dashboard");

  useEffect(() => {
    const fetchUserAndData = async () => {
      if (!connected || !publicKey) {
        setIsLoading(false);
        setDbUser(null);
        return;
      }

      setIsLoading(true);

      try {
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ wallet_address: publicKey.toBase58() }),
        });

        if (!response.ok) {
            throw new Error("Failed to get or create user.");
        }
        const user = await response.json();
        setDbUser(user);
        
        if (user) {
            const walletAddress = publicKey.toBase58();
            // The sync process is slow and should not block the initial load.
            // We can trigger this in the background or with a manual button later.
            // await fetch('/api/journal/sync', {
            //   method: 'POST',
            //   headers: { 'Content-Type': 'application/json' },
            //   body: JSON.stringify({ userId: user.id, walletAddress }),
            // });

            const dashboardDataPromise = fetch(`/api/dashboard-data?user_id=${user.id}&walletAddress=${walletAddress}`).then(res => res.json());
            const journalDataPromise = fetch(`/api/journal-activity?userId=${user.id}&walletAddress=${walletAddress}`).then(res => res.json());

            const [dashboardData, journalData] = await Promise.all([
                dashboardDataPromise,
                journalDataPromise
            ]);

            setHoldings(dashboardData?.holdings || []);
            setWatchlist(dashboardData?.watchlist || []);
            setTrades(dashboardData?.trades || []);
            setWallets(dashboardData?.wallets || []);
            setJournalEvents(journalData || []);
        }
      } catch (error) {
        console.error("Initialization error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserAndData();
  }, [connected, publicKey]);


  const handleRefreshHoldings = async () => {
    if (!dbUser?.id || !publicKey) return;

    console.log("Manual refresh triggered.");
    setIsRefreshing(true);
    try {
      const url = `/api/dashboard-data?user_id=${dbUser.id}&walletAddress=${publicKey.toBase58()}`;
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        setHoldings(data.holdings || []);
        console.log("Manual refresh successful.");
      } else {
        throw new Error('Failed to refresh dashboard data.');
      }
    } catch (error: any) {
      console.error(error.message);
    } finally {
      setIsRefreshing(false);
    }
  };

  const renderMainContent = () => {
    if (isLoading) {
      return <LoadingScreen />;
    }
    
    if (!connected || !publicKey) {
      return <WalletConnection />;
    }
   
    if (!dbUser) {
        return <LoadingScreen message="Syncing user..." />;
    }
    
    switch (activeItem) {
      case "Journal":
        return <JournalPage dbUser={dbUser} />;
      case "Holdings":
        return <HoldingsPage holdings={holdings} isLoading={isRefreshing} onRefresh={handleRefreshHoldings} walletAddress={publicKey?.toBase58()} />;
      case "Watchlist":
        return <WatchlistPage initialWatchlist={watchlist} dbUser={dbUser} />;
      case "Dashboard":
      default:
        return (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold text-white">Trading Dashboard</h1>
              <div className="flex items-center gap-4">
                <WalletSelector dbUser={dbUser} />
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>+ Log Trade</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Log a New Trade</DialogTitle></DialogHeader>
                    <TradeForm />
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            <Dashboard 
              holdings={holdings} 
              onNavigateToHoldings={() => setActiveItem("Holdings")} 
              onNavigateToJournal={() => setActiveItem("Journal")}
              isLoading={isLoading} 
            />
          </div>
        );
    }
  };
  
  return (
    <WalletFilterProvider dbUser={dbUser}>
        <div className="flex">
          <Sidebar activeItem={activeItem} onItemClick={setActiveItem} dbUser={dbUser} />
          <main className="flex-1 ml-24 p-8">{renderMainContent()}</main>
        </div>
    </WalletFilterProvider>
  );
}
