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
import { WalletFilterProvider, useWalletFilter } from "@/app/contexts/WalletFilterContext";
import { WalletSelector } from "@/components/WalletSelector";

function DashboardContent({
  dbUser,
  publicKey,
  connected,
  propInitialTrades,
  propInitialHoldings,
}: {
  dbUser: User;
  publicKey: any;
  connected: boolean;
  propInitialTrades: any;
  propInitialHoldings: any;
}) {
  const { selectedWalletId, selectedWallet } = useWalletFilter();
  const [wallets, setWallets] = useState<any[]>([]);
  const [trades, setTrades] = useState<Trade[]>(propInitialTrades || []);
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>(propInitialHoldings || []);
  const [journalEvents, setJournalEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeItem, setActiveItem] = useState("Dashboard");

  useEffect(() => {
    const fetchData = async () => {
      if (!connected || !publicKey || !dbUser) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const selectedWalletAddress = selectedWallet?.wallet_address || null;

        // Fire-and-forget sync only for a concrete wallet context.
        const syncWalletAddress = selectedWalletAddress || publicKey.toBase58();
        fetch('/api/journal/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: dbUser.id, walletAddress: syncWalletAddress }),
        }).then(async res => {
          const data = await res.json();
          if (res.ok) {
            console.log("Background sync completed:", data);
          } else {
            console.warn("Background sync failed or skipped:", data);
          }
        }).catch(err => console.error("Background sync error:", err));

        let dashboardUrl = `/api/dashboard-data?user_id=${dbUser.id}`;
        let journalUrl = `/api/journal-activity?userId=${dbUser.id}`;

        if (selectedWalletId !== null) {
          dashboardUrl += `&walletId=${selectedWalletId}`;
          journalUrl += `&walletId=${selectedWalletId}`;
        }

        const [dashboardData, journalData] = await Promise.all([
          fetch(dashboardUrl).then(res => res.json()),
          fetch(journalUrl).then(res => res.json()),
        ]);

        setHoldings(dashboardData?.holdings || []);
        setWatchlist(dashboardData?.watchlist || []);
        setTrades(dashboardData?.trades || []);
        setWallets(dashboardData?.wallets || []);
        setJournalEvents(journalData || []);
      } catch (error) {
        console.error("Initialization error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [connected, publicKey, dbUser, selectedWalletId, selectedWallet]);


  const handleRefreshHoldings = async () => {
    if (!dbUser?.id || !publicKey) return;

    console.log("Manual refresh triggered.");
    setIsRefreshing(true);
    try {
      let url = `/api/dashboard-data?user_id=${dbUser.id}`;
      if (selectedWalletId !== null) {
        url += `&walletId=${selectedWalletId}`;
      }
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
   
    switch (activeItem) {
      case "Journal":
        return <JournalPage dbUser={dbUser} />;
      case "Holdings":
        return <HoldingsPage holdings={holdings} isLoading={isRefreshing} onRefresh={handleRefreshHoldings} walletAddress={selectedWallet?.wallet_address || publicKey?.toBase58()} />;
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
    <div className="flex">
      <Sidebar activeItem={activeItem} onItemClick={setActiveItem} dbUser={dbUser} />
      <main className="flex-1 ml-24 p-8">{renderMainContent()}</main>
    </div>
  );
}

export function DashboardClient({ initialTrades: propInitialTrades, initialHoldings: propInitialHoldings }: any) {
  const { publicKey, connected } = useWallet();
  const [dbUser, setDbUser] = useState<User | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      if (!connected || !publicKey) {
        setDbUser(null);
        setIsUserLoading(false);
        return;
      }

      setIsUserLoading(true);
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
      } catch (error) {
        console.error("Initialization error:", error);
      } finally {
        setIsUserLoading(false);
      }
    };

    fetchUser();
  }, [connected, publicKey]);

  if (!connected || !publicKey) {
    return <WalletConnection />;
  }

  if (isUserLoading) {
    return <LoadingScreen message="Syncing user..." />;
  }

  if (!dbUser) {
    return <LoadingScreen message="Syncing user..." />;
  }

  return (
    <WalletFilterProvider dbUser={dbUser}>
      <DashboardContent
        dbUser={dbUser}
        publicKey={publicKey}
        connected={connected}
        propInitialTrades={propInitialTrades}
        propInitialHoldings={propInitialHoldings}
      />
    </WalletFilterProvider>
  );
}
