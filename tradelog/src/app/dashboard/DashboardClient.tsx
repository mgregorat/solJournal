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

export function DashboardClient({ initialHoldings, initialTrades }: DashboardClientProps) {
  const { publicKey, connected } = useWallet();
  const { user, authenticated } = usePrivy();

  const [dbUser, setDbUser] = useState<any>(null);
  const [wallets, setWallets] = useState<any[]>([]);
  const [trades, setTrades] = useState<Trade[]>(initialTrades || []);
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>(initialHoldings || []);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const walletAddress = publicKey?.toBase58();

  // 1. Sync user and fetch their wallets
  useEffect(() => {
    const setupUser = async () => {
      if (authenticated && user) {
        try {
          // Sync user with DB
          const userResponse = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ privy_did: user.id, email: user.email?.address }),
          });

          if (!userResponse.ok) {
            throw new Error('Failed to sync user');
          }
          const syncedUser = await userResponse.json();
          setDbUser(syncedUser);

          // Fetch wallets for the synced user
          const walletsResponse = await fetch(`/api/wallets?user_id=${syncedUser.id}`);
          if (walletsResponse.ok) {
            const userWallets = await walletsResponse.json();
            setWallets(userWallets);
          } else {
             // If fetching wallets fails, we can assume there are none and stop loading
            setIsInitialLoading(false);
          }

        } catch (error) {
          console.error('Error during user setup:', error);
          setIsInitialLoading(false);
        }
      } else if (!user) {
         // If there's no Privy user, we can stop loading.
        setIsInitialLoading(false);
      }
    };
    setupUser();
  }, [authenticated, user]);

  // 2. Fetch data once we have a user and wallets
  useEffect(() => {
    const loadInitialData = async () => {
        // This effect should only run when we have a user and at least one wallet,
        // and a connected wallet in the browser.
        if (dbUser && wallets.length > 0 && publicKey) {
            try {
                const walletAddresses = wallets.map(w => w.wallet_address).join(',');
                
                // Fetch holdings, trades, and watchlist data.
                const [tradesResponse, watchlistResponse, holdingsResponse] = await Promise.all([
                    fetch(`/api/trades?walletAddresses=${walletAddresses}`),
                    fetch(`/api/watchlist?user_id=${dbUser.id}`),
                    fetch(`/api/refresh-holdings`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ walletAddress: publicKey.toBase58() }),
                    })
                ]);

                if (tradesResponse.ok) setTrades(await tradesResponse.json());
                if (watchlistResponse.ok) setWatchlist(await watchlistResponse.json());
                if (holdingsResponse.ok) {
                    const data = await holdingsResponse.json();
                    setHoldings(data.holdings);
                }
            } catch (error) {
                console.error("Failed to load initial dashboard data", error);
            } finally {
                setIsInitialLoading(false);
            }
        } else if (dbUser) {
            // If the user is loaded but has no wallets or none connected, stop loading.
            setIsInitialLoading(false);
        }
    };

    loadInitialData();
  }, [dbUser, wallets, publicKey]);

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

  const handleRefreshHoldings = async () => {
    if (!publicKey) return;

    setIsHoldingsLoading(true);
    try {
      const response = await fetch('/api/refresh-holdings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: publicKey.toBase58() }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to refresh holdings.');
      }
      setHoldings(data.holdings);
    } catch (error: any) {
      console.error(error.message);
      // You could add a toast notification here to inform the user of the error
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