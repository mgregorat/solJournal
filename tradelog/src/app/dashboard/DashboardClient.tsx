"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useWallet } from "@solana/wallet-adapter-react";
import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { HoldingsPage } from "@/components/HoldingsPage";
import { Dashboard } from "@/components/Dashboard";
import { WalletConnection } from "@/components/WalletConnection";
import TradeHistory from "@/components/TradeHistory";
import { WatchlistPage } from "@/components/WatchlistPage";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Trade, Holding } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import TradeForm from "@/components/TradeForm";

export function DashboardClient({ initialTrades: propInitialTrades, initialHoldings: propInitialHoldings }: any) {
  const { publicKey, connected } = useWallet();
  const { user, authenticated, getAccessToken } = usePrivy();

  const [dbUser, setDbUser] = useState<any>(null);
  const [wallets, setWallets] = useState<any[]>([]);
  const [trades, setTrades] = useState<Trade[]>(propInitialTrades || []);
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>(propInitialHoldings || []);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeItem, setActiveItem] = useState("Dashboard");

  // Effect to sync user with the database. Runs only when auth state changes.
  useEffect(() => {
    const syncUser = async () => {
      if (authenticated && user) {
        try {
          const response = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ privy_did: user.id, email: user.email?.address }),
          });
          if (response.ok) {
            const syncedUser = await response.json();
            setDbUser(syncedUser);
          } else {
            console.error("Failed to sync user.");
          }
        } catch (error) {
          console.error("Error syncing user:", error);
        }
      }
    };
    syncUser();
  }, [authenticated, user]);


  // Effect to fetch dashboard data. Runs when we have a user and a connected wallet.
  useEffect(() => {
    const loadDashboardData = async () => {
      if (dbUser?.id && publicKey) {
        setIsLoading(true);
        try {
          const url = `/api/dashboard-data?user_id=${dbUser.id}&walletAddress=${publicKey.toBase58()}`;
          const response = await fetch(url);

          if (response.ok) {
            const data = await response.json();
            setHoldings(data.holdings || []);
            setWatchlist(data.watchlist || []);
            setTrades(data.trades || []);
            setWallets(data.wallets || []);
          } else {
            console.error("Failed to fetch dashboard data:", response.statusText);
          }
        } catch (error) {
          console.error("Error fetching dashboard data:", error);
        } finally {
          setIsLoading(false);
        }
      } else if (authenticated) {
        // If logged in but no wallet, stop loading and wait for connection.
        setIsLoading(false);
      }
    };
    loadDashboardData();
  }, [dbUser, publicKey, authenticated]);


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
    
    if (!authenticated) {
      return <div>Please log in to continue.</div>;
    }

    if (!publicKey) {
      return <WalletConnection />;
    }
    
    switch (activeItem) {
      case "Journal":
        return <TradeHistory initialTrades={trades} />;
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
      <Sidebar activeItem={activeItem} onItemClick={setActiveItem} />
      <main className="flex-1 ml-24 p-8">{renderMainContent()}</main>
    </div>
  );
} 