"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useWallet } from "@solana/wallet-adapter-react";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import Sidebar from "@/components/Sidebar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import TradeForm from "@/components/TradeForm";
import { HoldingsPage } from "@/components/HoldingsPage";
import { Dashboard } from "@/components/Dashboard";
import { WalletConnection } from "@/components/WalletConnection";
import TradeHistory from "@/components/TradeHistory";
import { WatchlistPage } from "@/components/WatchlistPage";
import { DailyPnlDisplay } from "@/components/DailyPnlDisplay";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Trade, Holding } from "@/lib/types";

interface DashboardClientProps {
  initialHoldings: Holding[] | null;
  initialTrades: Trade[];
}

export function DashboardClient({ initialTrades: propInitialTrades, initialHoldings: propInitialHoldings }: any) {
  const { publicKey, connected } = useWallet();
  const { user, authenticated } = usePrivy();

  const [dbUser, setDbUser] = useState<any>(null);
  const [wallets, setWallets] = useState<any[]>([]);
  const [trades, setTrades] = useState<Trade[]>(propInitialTrades || []);
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>(propInitialHoldings || []);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const walletAddress = publicKey?.toBase58();

  // Effect to sync the user with the database
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
            const walletsResponse = await fetch(`/api/wallets?user_id=${syncedUser.id}`);
            if (walletsResponse.ok) setWallets(await walletsResponse.json());
          }
        } catch (error) {
          console.error('Error syncing user:', error);
        }
      }
    };
    syncUser();
  }, [authenticated, user]);

  // Main data fetching effect, now calls the single master endpoint
  useEffect(() => {
    const loadDashboardData = async () => {
      if (dbUser?.id && publicKey) {
        setIsInitialLoading(true);
        try {
          const url = `/api/dashboard-data?user_id=${dbUser.id}&walletAddress=${publicKey.toBase58()}`;
          const response = await fetch(url);
          if (response.ok) {
            const data = await response.json();
            setHoldings(data.holdings || []);
            setWatchlist(data.watchlist || []);
            setTrades(data.trades || []);
          } else {
            console.error("Failed to fetch dashboard data:", response.statusText);
          }
        } catch (error) {
          console.error("Error fetching dashboard data:", error);
        } finally {
          setIsInitialLoading(false);
        }
      } else if (authenticated) {
        // If logged in but no wallet connected, stop loading.
        setIsInitialLoading(false);
      }
    };
    loadDashboardData();
  }, [dbUser, publicKey]); // Depends on user and connected wallet

  // 3. Save newly connected wallet (no change needed here)
  useEffect(() => {
    const saveWallet = async () => {
      if (connected && publicKey && dbUser) {
        if (wallets.some(w => w.wallet_address === publicKey.toBase58())) return;
        try {
          const response = await fetch('/api/wallets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: dbUser.id, wallet_address: publicKey.toBase58() }),
          });
          if (response.ok) {
            const newWallet = await response.json();
            setWallets(prev => [...prev, newWallet]);
          }
        } catch (error) {
          console.error('Error saving wallet:', error);
        }
      }
    };
    saveWallet();
  }, [connected, publicKey, dbUser]);


  const [activeItem, setActiveItem] = useState("Dashboard");
  const [isHoldingsLoading, setIsHoldingsLoading] = useState(false);

  // Updated manual refresh handler to use the new master endpoint
  const handleRefreshHoldings = async () => {
    if (!dbUser?.id || !publicKey) return;

    console.log("Manual refresh triggered. Fetching all dashboard data...");
    setIsHoldingsLoading(true);
    try {
      const url = `/api/dashboard-data?user_id=${dbUser.id}&walletAddress=${publicKey.toBase58()}`;
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        setHoldings(data.holdings || []);
        // We could also update trades and watchlist here if needed
        // setWatchlist(data.watchlist || []);
        // setTrades(data.trades || []);
        console.log("Manual refresh successful.");
      } else {
        throw new Error('Failed to refresh dashboard data.');
      }
    } catch (error: any) {
      console.error(error.message);
    } finally {
      setIsHoldingsLoading(false);
    }
  };

  const handleItemClick = (item: string) => {
    setActiveItem(item);
  };

  const renderMainContent = () => {
    if (!authenticated) {
      // Should be redirected by page logic, but as a fallback:
      return <div>Please log in to continue.</div>;
    }

    if (isInitialLoading) {
      return <LoadingScreen />;
    }

    if (wallets.length === 0) {
      return <WalletConnection />;
    }

    if (!publicKey) {
      // This case means they have wallets in DB but none is connected in the UI
      return <WalletConnection />;
    }
    
    switch (activeItem) {
      case "Journal":
        return <TradeHistory initialTrades={trades} />;
      case "Holdings":
        return <HoldingsPage holdings={holdings} isLoading={isInitialLoading} onRefresh={handleRefreshHoldings} walletAddress={publicKey?.toBase58()} />;
      case "Watchlist":
        return <WatchlistPage initialWatchlist={watchlist} dbUser={dbUser} />;
      case "P&L":
        return <DailyPnlDisplay />;
      case "Dashboard":
      default:
        return (
          <div className="space-y-8">
            {/* Header */}
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <h1 className="text-3xl font-bold text-white">Trading Dashboard</h1>
              </div>
              <div className="flex items-center space-x-3">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-2 rounded-lg font-semibold transition-all duration-200 hover:scale-105">
                      + Log Trade
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Log a New Trade</DialogTitle>
                    </DialogHeader>
                    <TradeForm />
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Dashboard Component */}
            <Dashboard 
              holdings={holdings} 
              onNavigateToHoldings={() => setActiveItem("Holdings")} 
              onNavigateToJournal={() => setActiveItem("Journal")}
              isLoading={isInitialLoading} 
            />
          </div>
        );
    }
  };

  return (
    <div className="flex">
      <Sidebar activeItem={activeItem} onItemClick={handleItemClick} />
      <main className="flex-1 ml-24 p-8">{renderMainContent()}</main>
    </div>
  );
} 