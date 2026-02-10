"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import { HoldingsPage } from "@/components/HoldingsPage";
import { Dashboard } from "@/components/Dashboard";
import { WalletConnection } from "@/components/WalletConnection";
import { JournalPage } from "@/components/JournalPage";
import { WatchlistPage } from "@/components/WatchlistPage";
import { TradesPage } from "@/components/TradesPage";
import { SettingsPage } from "@/components/SettingsPage";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Trade, Holding, User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import TradeForm from "@/components/TradeForm";
import { WalletFilterProvider, useWalletFilter } from "@/app/contexts/WalletFilterContext";
import { WalletSelector } from "@/components/WalletSelector";
import { cachedFetch } from "@/lib/cachedFetch";

function DashboardContent({
  dbUser,
  publicKey,
  connected,
  propInitialTrades,
  propInitialHoldings,
  initialActiveItem = "Dashboard",
}: {
  dbUser: User;
  publicKey: any;
  connected: boolean;
  propInitialTrades: any;
  propInitialHoldings: any;
  initialActiveItem?: string;
}) {
  const {
    selectedWalletId,
    selectedWallet,
    wallets: filterWallets,
    loading: walletFilterLoading,
  } = useWalletFilter();
  const [wallets, setWallets] = useState<any[]>([]);
  const [trades, setTrades] = useState<Trade[]>(propInitialTrades || []);
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>(propInitialHoldings || []);
  const [solBalance, setSolBalance] = useState<number>(0);
  const [journalEvents, setJournalEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasResolvedHoldings, setHasResolvedHoldings] = useState(false);
  const [activeItem, setActiveItem] = useState(initialActiveItem);
  const [pendingJournalTxHash, setPendingJournalTxHash] = useState<string | null>(null);
  const resolvedWalletAddress = selectedWallet?.wallet_address ?? (publicKey ? publicKey.toBase58() : null);
  const isDashboardDataReady = !isLoading && !walletFilterLoading && hasResolvedHoldings;
  const walletScope = selectedWalletId ?? "all";

  const applyHoldingsPayload = useCallback((data: any) => {
    const sourceHoldings =
      data?.holdings ||
      data?.raw?.data?.holdings ||
      data?.raw?.data?.tokens ||
      data?.raw?.data?.list ||
      data?.raw?.data?.items ||
      [];

    const normalized: Holding[] = (sourceHoldings || []).map((item: any) => {
      const amount = Number(item.balance || item?.amount || 0);
      const currentPrice = Number(
        item.priceUsd ?? item?.price ?? item?.price_usd ?? item?.token?.price ?? 0
      );
      const currentValueUSD = Number(item.valueUsd ?? item?.usd_value ?? item?.value_usd ?? amount * currentPrice);
      const avgEntryPrice = Number(
        item.avgEntryPrice ??
          item?.avg_entry_price ??
          ((Number(item?.accu_amount || 0) > 0)
            ? Number(item?.accu_cost || 0) / Number(item?.accu_amount || 1)
            : 0)
      );
      const unrealizedPnL = (currentPrice - avgEntryPrice) * amount;
      const totalCostBasis = avgEntryPrice * amount;
      const pnlPercentage =
        totalCostBasis > 0 ? (unrealizedPnL / totalCostBasis) * 100 : 0;

      return {
        mint:
          item.tokenAddress ||
          item?.token?.token_address ||
          item?.token?.address ||
          item?.address ||
          item?.mint,
        amount,
        decimals: 9,
        symbol: item.tokenSymbol || item?.token?.symbol || item?.symbol || "UNKNOWN",
        name: item.tokenSymbol || item?.token?.name || item?.name || "Unknown Token",
        currentPrice,
        currentValueUSD,
        avgEntryPrice,
        totalCostBasis,
        unrealizedPnL,
        pnlPercentage,
        isNativeSOL:
          (item.tokenSymbol || item?.token?.symbol || item?.symbol) === "SOL" ||
          (item.tokenAddress || item?.token?.address || item?.address || item?.mint) ===
            "So11111111111111111111111111111111111111112",
      };
    });

    const solFromPayload = Number(data?.solBalance || 0);
    const solPriceFromPayload = Number(
      data?.solPriceUsd ??
      data?.raw?.data?.price_per_sol ??
      data?.raw?.data?.sol_price ??
      data?.raw?.data?.solPrice ??
      0
    );
    const solUsdFromPayload = Number(data?.solUsdValue || 0);
    const solFromHoldings =
      normalized.find(
        (h) => h.symbol === "SOL" || h.mint === "So11111111111111111111111111111111111111112"
      )?.amount || 0;
    const hasSolHolding = normalized.some(
      (h) => h.symbol === "SOL" || h.mint === "So11111111111111111111111111111111111111112"
    );

    if (solFromPayload > 0 && !hasSolHolding) {
      normalized.unshift({
        mint: "So11111111111111111111111111111111111111112",
        amount: solFromPayload,
        decimals: 9,
        symbol: "SOL",
        name: "Solana",
        currentPrice: solPriceFromPayload,
        currentValueUSD:
          solUsdFromPayload > 0
            ? solUsdFromPayload
            : solPriceFromPayload > 0
              ? solFromPayload * solPriceFromPayload
              : 0,
        isNativeSOL: true,
      });
    }

    setSolBalance(solFromPayload > 0 ? solFromPayload : solFromHoldings);
    setHoldings(normalized);
    setHasResolvedHoldings(true);
  }, []);

  const applyAggregateHoldings = useCallback((data: any) => {
    const nextHoldings = data?.holdings || [];
    setHoldings(nextHoldings);
    const solFromAggregate =
      nextHoldings.find(
        (h: any) => h?.symbol === "SOL" || h?.mint === "So11111111111111111111111111111111111111112"
      )?.amount || 0;
    setSolBalance(Number(solFromAggregate || 0));
    setHasResolvedHoldings(true);
  }, []);

  const applyDashboardPayload = useCallback((dashboardData: any) => {
    setWatchlist(dashboardData?.watchlist || []);
    setTrades(dashboardData?.trades || []);
    setWallets(dashboardData?.wallets || []);
  }, []);

  const applyJournalPayload = useCallback((journalData: any) => {
    setJournalEvents(journalData || []);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!connected || !publicKey || !dbUser) {
        setIsLoading(false);
        return;
      }
      if (walletFilterLoading) {
        return;
      }

      setIsLoading(true);
      try {
        let dashboardUrl = `/api/dashboard-data?user_id=${dbUser.id}`;
        let journalUrl = `/api/journal-activity?userId=${dbUser.id}`;

        if (selectedWalletId !== null) {
          dashboardUrl += `&walletId=${selectedWalletId}`;
          journalUrl += `&walletId=${selectedWalletId}`;
        } else if ((filterWallets?.length || 0) === 0) {
          // If wallets haven't been created in DB yet, bootstrap with connected wallet.
          dashboardUrl += `&walletAddress=${publicKey.toBase58()}`;
        }

        const [dashboardData, journalData] = await Promise.all([
          cachedFetch({
            key: `dashboard:${dbUser.id}:${walletScope}`,
            fetcher: async () => {
              const res = await fetch(dashboardUrl);
              if (!res.ok) {
                throw new Error("Failed to fetch dashboard data");
              }
              return res.json();
            },
            onUpdate: applyDashboardPayload,
          }),
          cachedFetch({
            key: `journal-activity:${dbUser.id}:${walletScope}`,
            fetcher: async () => {
              const res = await fetch(journalUrl);
              if (!res.ok) {
                throw new Error("Failed to fetch journal activity data");
              }
              return res.json();
            },
            onUpdate: applyJournalPayload,
          }),
        ]);

        applyDashboardPayload(dashboardData);
        applyJournalPayload(journalData);
      } catch (error) {
        console.error("Initialization error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [
    connected,
    publicKey,
    dbUser,
    selectedWalletId,
    selectedWallet,
    walletScope,
    walletFilterLoading,
    filterWallets?.length,
    applyDashboardPayload,
    applyJournalPayload,
  ]);


  const handleRefreshHoldings = useCallback(async () => {
    if (!dbUser?.id) {
      throw new Error("User not ready yet.");
    }
    setIsRefreshing(true);
    try {
      const shouldFetchAllWallets = selectedWalletId === null && (filterWallets?.length || 0) > 0;
      if (shouldFetchAllWallets) {
        const aggregatePayload = await cachedFetch<any>({
          key: `holdings:${dbUser.id}:${walletScope}`,
          fetcher: async () => {
            const response = await fetch(`/api/dashboard-data?user_id=${dbUser.id}`);
            const data = await response.json();
            if (!response.ok) {
              throw new Error(data?.error || "Failed to refresh all-wallet holdings");
            }
            return data;
          },
          onUpdate: applyAggregateHoldings,
        });
        applyAggregateHoldings(aggregatePayload);
        return true;
      }

      if (!resolvedWalletAddress) {
        throw new Error("Connect a wallet to refresh holdings.");
      }

      const walletPayload = await cachedFetch<any>({
        key: `holdings:${dbUser.id}:${walletScope}:${resolvedWalletAddress}`,
        fetcher: async () => {
          const response = await fetch(
            `/api/holdings?walletAddress=${resolvedWalletAddress}`
          );
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data?.error || "Failed to refresh holdings");
          }
          return data;
        },
        onUpdate: applyHoldingsPayload,
      });

      applyHoldingsPayload(walletPayload);
      return true;
    } finally {
      setIsRefreshing(false);
    }
  }, [
    dbUser?.id,
    selectedWalletId,
    walletScope,
    filterWallets?.length,
    resolvedWalletAddress,
    applyAggregateHoldings,
    applyHoldingsPayload,
  ]);

  useEffect(() => {
    if (!dbUser?.id || walletFilterLoading) {
      return;
    }

    if (!resolvedWalletAddress) {
      setHasResolvedHoldings(true);
      return;
    }

    setHasResolvedHoldings(false);
    handleRefreshHoldings().catch((error) => {
      console.error("Auto-refresh holdings failed:", error);
      setHasResolvedHoldings(true);
    });
  }, [
    dbUser?.id,
    selectedWalletId,
    selectedWallet?.wallet_address,
    publicKey,
    walletFilterLoading,
    resolvedWalletAddress,
    handleRefreshHoldings,
  ]);

  useEffect(() => {
    if (!dbUser?.id || walletFilterLoading) {
      return;
    }

    const userId = dbUser.id;
    const walletKey = walletScope;
    const hasWalletSelectionResolved = selectedWalletId === null || typeof selectedWalletId === "number";
    if (!hasWalletSelectionResolved) {
      return;
    }

    const dashboardUrl =
      selectedWalletId === null
        ? `/api/dashboard-data?user_id=${userId}`
        : `/api/dashboard-data?user_id=${userId}&walletId=${selectedWalletId}`;

    const journalActivityUrl =
      selectedWalletId === null
        ? `/api/journal-activity?userId=${userId}`
        : `/api/journal-activity?userId=${userId}&walletId=${selectedWalletId}`;

    const journalEntriesUrl =
      selectedWalletId === null
        ? `/api/journal/entries?userId=${userId}`
        : `/api/journal/entries?userId=${userId}&walletId=${selectedWalletId}`;

    const tradesUrl =
      selectedWalletId === null
        ? `/api/trades?userId=${userId}`
        : `/api/trades?userId=${userId}&walletId=${selectedWalletId}`;

    const tasks: Promise<unknown>[] = [
      cachedFetch({
        key: `dashboard:${userId}:${walletKey}`,
        fetcher: async () => {
          const res = await fetch(dashboardUrl);
          if (!res.ok) {
            throw new Error("Failed to prefetch dashboard data");
          }
          return res.json();
        },
      }),
      cachedFetch({
        key: `trades:${userId}:${walletKey}`,
        fetcher: async () => {
          const res = await fetch(tradesUrl);
          if (!res.ok) {
            throw new Error("Failed to prefetch trades data");
          }
          return res.json();
        },
      }),
      cachedFetch({
        key: `journal:${userId}:${walletKey}`,
        fetcher: async () => {
          const res = await fetch(journalActivityUrl);
          if (!res.ok) {
            throw new Error("Failed to prefetch journal activity");
          }
          return res.json();
        },
      }),
      cachedFetch({
        key: `journal-entries:${userId}:${walletKey}`,
        fetcher: async () => {
          const res = await fetch(journalEntriesUrl);
          if (!res.ok) {
            throw new Error("Failed to prefetch journal entries");
          }
          return res.json();
        },
      }),
    ];

    if (selectedWalletId === null && (filterWallets?.length || 0) > 0) {
      tasks.push(
        cachedFetch({
          key: `holdings:${userId}:${walletKey}`,
          fetcher: async () => {
            const res = await fetch(`/api/dashboard-data?user_id=${userId}`);
            if (!res.ok) {
              throw new Error("Failed to prefetch aggregate holdings");
            }
            return res.json();
          },
        })
      );
    } else if (resolvedWalletAddress) {
      tasks.push(
        cachedFetch({
          key: `holdings:${userId}:${walletKey}:${resolvedWalletAddress}`,
          fetcher: async () => {
            const res = await fetch(`/api/holdings?walletAddress=${resolvedWalletAddress}`);
            if (!res.ok) {
              throw new Error("Failed to prefetch holdings data");
            }
            return res.json();
          },
        })
      );
    }

    void Promise.allSettled(tasks);
  }, [
    dbUser?.id,
    selectedWalletId,
    selectedWallet?.wallet_address,
    walletScope,
    walletFilterLoading,
    filterWallets?.length,
    resolvedWalletAddress,
  ]);

  const renderMainContent = () => {
    if (isLoading) {
      return <LoadingScreen />;
    }
    
    if (!connected || !publicKey) {
      return <WalletConnection />;
    }
   
    switch (activeItem) {
      case "Journal":
        return (
          <JournalPage
            dbUser={dbUser}
            pendingJournalTxHash={pendingJournalTxHash}
            onPendingJournalTxHandled={() => setPendingJournalTxHash(null)}
          />
        );
      case "Holdings":
        return (
          <HoldingsPage
            holdings={holdings}
            isLoading={isRefreshing || !hasResolvedHoldings}
            onRefresh={handleRefreshHoldings}
            walletAddress={resolvedWalletAddress || undefined}
            canRefresh={selectedWalletId === null || !!resolvedWalletAddress}
            solBalance={solBalance}
          />
        );
      case "Watchlist":
        return <WatchlistPage initialWatchlist={watchlist} dbUser={dbUser} />;
      case "Trades":
        return <TradesPage dbUser={dbUser} />;
      case "Settings":
        return <SettingsPage />;
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
              isLoading={!isDashboardDataReady || isRefreshing} 
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

export function DashboardClient({
  initialTrades: propInitialTrades,
  initialHoldings: propInitialHoldings,
  initialActiveItem = "Dashboard",
}: any) {
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
        initialActiveItem={initialActiveItem}
      />
    </WalletFilterProvider>
  );
}
