"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";
import Sidebar from "@/components/Sidebar";
import { HoldingsPage } from "@/components/HoldingsPage";
import { Dashboard } from "@/components/Dashboard";
import { WalletConnection } from "@/components/WalletConnection";
import { JournalPage } from "@/components/JournalPage";
import { WatchlistPage } from "@/components/WatchlistPage";
import { TradesPage } from "@/components/TradesPage";
import { SettingsPage } from "@/components/SettingsPage";
import { LoadingScreen } from "@/components/LoadingScreen";
import { FirstWalletEmptyState } from "@/components/FirstWalletEmptyState";
import { Trade, Holding, User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import TradeForm from "@/components/TradeForm";
import { WalletFilterProvider, useWalletFilter } from "@/app/contexts/WalletFilterContext";
import { WalletSelector } from "@/components/WalletSelector";
import { cachedFetch } from "@/lib/cachedFetch";
import { useAppSettings } from "@/lib/hooks/useAppSettings";
import { authedFetchClient, parseApiResponse } from "@/lib/authedFetch";

function DashboardContent({
  dbUser,
  propInitialTrades,
  propInitialHoldings,
  initialActiveItem = "Dashboard",
}: {
  dbUser: User;
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
  const [hasInitializedDashboard, setHasInitializedDashboard] = useState(false);
  const resolvedWalletAddress = selectedWallet?.wallet_address ?? null;
  const isDashboardDataReady = !isLoading && !walletFilterLoading && hasResolvedHoldings;
  const walletScope = selectedWalletId ?? "all";
  const { settings } = useAppSettings(dbUser?.id);
  const autoSyncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSyncLastRunRef = useRef<Map<string, number>>(new Map());
  const { ready, authenticated, getAccessToken } = usePrivy();
  const getBearerToken = useCallback(async () => (await getAccessToken?.()) || null, [getAccessToken]);
  const hasWallets = (filterWallets?.length || 0) > 0;

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
    if (Array.isArray(dashboardData?.holdings)) {
      const nextHoldings = dashboardData.holdings as Holding[];
      setHoldings(nextHoldings);
      const solFromAggregate =
        nextHoldings.find(
          (h: any) => h?.symbol === "SOL" || h?.mint === "So11111111111111111111111111111111111111112"
        )?.amount || 0;
      setSolBalance(Number(solFromAggregate || 0));
      setHasResolvedHoldings(true);
    }
  }, []);

  const applyJournalPayload = useCallback((journalData: any) => {
    setJournalEvents(journalData || []);
  }, []);

  const normalizeTradesPayload = useCallback((payload: unknown): Trade[] => {
    if (Array.isArray(payload)) {
      return payload as Trade[];
    }
    if (
      payload &&
      typeof payload === "object" &&
      "items" in payload &&
      Array.isArray((payload as { items: unknown[] }).items)
    ) {
      return (payload as { items: Trade[] }).items;
    }
    return [];
  }, []);

  const syncStatusStorageKey = useMemo(
    () => (dbUser?.id ? `tradelog:syncState:${dbUser.id}` : null),
    [dbUser?.id]
  );

  const setSyncStatus = useCallback(
    (syncing: boolean, scope: string) => {
      if (!syncStatusStorageKey || typeof window === "undefined") return;
      const payload = {
        syncing,
        scope,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(syncStatusStorageKey, JSON.stringify(payload));
      window.dispatchEvent(new CustomEvent("tradelog:sync-status", { detail: payload }));
    },
    [syncStatusStorageKey]
  );

  useEffect(() => {
    const fetchData = async () => {
      if (!ready || !authenticated) {
        setIsLoading(false);
        return;
      }
      if (!dbUser) {
        setIsLoading(false);
        return;
      }
      if (walletFilterLoading) {
        return;
      }

      if (!hasInitializedDashboard) {
        setIsLoading(true);
      }
      try {
        let dashboardUrl = `/api/dashboard-data`;
        let journalUrl = `/api/journal-activity`;
        let tradesUrl = `/api/trades`;

        if (selectedWalletId !== null) {
          dashboardUrl += `?walletId=${selectedWalletId}`;
          journalUrl += `?walletId=${selectedWalletId}`;
          tradesUrl += `?walletId=${selectedWalletId}`;
        }

        const [dashboardData, journalData] = await Promise.all([
          cachedFetch({
            revalidateOnHit: false,
            key: `dashboard:${dbUser.id}:${walletScope}`,
            fetcher: async () => {
              const res = await authedFetchClient(getBearerToken, dashboardUrl);
              return parseApiResponse(res);
            },
            onUpdate: applyDashboardPayload,
          }),
          cachedFetch({
            revalidateOnHit: false,
            key: `journal-activity:${dbUser.id}:${walletScope}`,
            fetcher: async () => {
              const res = await authedFetchClient(getBearerToken, journalUrl);
              return parseApiResponse(res);
            },
            onUpdate: applyJournalPayload,
          }),
          cachedFetch({
            revalidateOnHit: false,
            key: `trades-list:${dbUser.id}:${walletScope}`,
            fetcher: async () => {
              const res = await authedFetchClient(getBearerToken, tradesUrl);
              return normalizeTradesPayload(await parseApiResponse(res));
            },
          }),
        ]);

        applyDashboardPayload(dashboardData);
        applyJournalPayload(journalData);
      } catch (error) {
        console.error("Initialization error:", error);
      } finally {
        setIsLoading(false);
        if (!hasInitializedDashboard) {
          setHasInitializedDashboard(true);
        }
      }
    };

    fetchData();
  }, [
    ready,
    authenticated,
    dbUser,
    selectedWalletId,
    selectedWallet,
    walletScope,
    walletFilterLoading,
    filterWallets?.length,
    applyDashboardPayload,
    applyJournalPayload,
    getBearerToken,
    hasInitializedDashboard,
  ]);

  useEffect(() => {
    const openManageWallets = () => setActiveItem("Settings");
    const storageSelection =
      typeof window !== "undefined" ? localStorage.getItem("tradelog:dashboardActiveItem") : null;
    if (storageSelection === "Settings") {
      setActiveItem("Settings");
      localStorage.removeItem("tradelog:dashboardActiveItem");
    }
    if (typeof window !== "undefined") {
      window.addEventListener("tradelog:open-manage-wallets", openManageWallets);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("tradelog:open-manage-wallets", openManageWallets);
      }
    };
  }, []);


  const handleRefreshHoldings = useCallback(async () => {
    if (!dbUser?.id) {
      throw new Error("User not ready yet.");
    }
    setIsRefreshing(true);
    try {
      const shouldFetchAllWallets = selectedWalletId === null && (filterWallets?.length || 0) > 0;
      if (shouldFetchAllWallets) {
        const aggregatePayload = await cachedFetch<any>({
          force: true,
          key: `holdings:${dbUser.id}:${walletScope}`,
          fetcher: async () => {
            const response = await authedFetchClient(getBearerToken, `/api/dashboard-data`);
            return parseApiResponse(response);
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
        force: true,
        key: `holdings:${dbUser.id}:${walletScope}:${resolvedWalletAddress}`,
        fetcher: async () => {
          const response = await authedFetchClient(
            getBearerToken,
            `/api/holdings?walletAddress=${resolvedWalletAddress}`
          );
          return parseApiResponse(response);
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
    getBearerToken,
  ]);

  useEffect(() => {
    if (!ready || !authenticated) {
      return;
    }
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
        ? `/api/dashboard-data`
        : `/api/dashboard-data?walletId=${selectedWalletId}`;

    const journalActivityUrl =
      selectedWalletId === null
        ? `/api/journal-activity`
        : `/api/journal-activity?walletId=${selectedWalletId}`;

    const journalEntriesUrl =
      selectedWalletId === null
        ? `/api/journal/entries`
        : `/api/journal/entries?walletId=${selectedWalletId}`;

    const tradesUrl =
      selectedWalletId === null
        ? `/api/trades`
        : `/api/trades?walletId=${selectedWalletId}`;

    const fetchJournalActivity = async () => {
      const res = await authedFetchClient(getBearerToken, journalActivityUrl);
      return parseApiResponse(res);
    };

    const fetchJournalEntries = async () => {
      const res = await authedFetchClient(getBearerToken, journalEntriesUrl);
      return parseApiResponse(res);
    };

    const tasks: Promise<unknown>[] = [
      cachedFetch({
        revalidateOnHit: false,
        key: `dashboard:${userId}:${walletKey}`,
        fetcher: async () => {
          const res = await authedFetchClient(getBearerToken, dashboardUrl);
          return parseApiResponse(res);
        },
      }),
      cachedFetch({
        revalidateOnHit: false,
        key: `trades-list:${userId}:${walletKey}`,
        fetcher: async () => {
          const res = await authedFetchClient(getBearerToken, tradesUrl);
          return normalizeTradesPayload(await parseApiResponse(res));
        },
      }),
      cachedFetch({
        revalidateOnHit: false,
        key: `journal-activity:${userId}:${walletKey}`,
        fetcher: fetchJournalActivity,
      }),
      cachedFetch({
        revalidateOnHit: false,
        key: `journal-entries:${userId}:${walletKey}`,
        fetcher: fetchJournalEntries,
      }),
      cachedFetch({
        revalidateOnHit: false,
        key: `trades:${userId}:${walletKey}`,
        fetcher: async () => {
          const [tradesRes, entriesRes] = await Promise.all([
            authedFetchClient(getBearerToken, tradesUrl),
            fetchJournalEntries(),
          ]);
          const tradesData = normalizeTradesPayload(await parseApiResponse(tradesRes));
          return {
            trades: tradesData || [],
            entries: Array.isArray(entriesRes) ? entriesRes : [],
          };
        },
      }),
      cachedFetch({
        revalidateOnHit: false,
        key: `journal:${userId}:${walletKey}`,
        fetcher: async () => {
          const [activityData, entriesData] = await Promise.all([
            fetchJournalActivity(),
            fetchJournalEntries().catch(() => []),
          ]);
          const journalMap = new Map(
            (Array.isArray(entriesData) ? entriesData : []).map((entry: any) => [entry.tx_hash, entry])
          );

          return (Array.isArray(activityData) ? activityData : [])
            .map((event: any) => {
              const journalKey = event.transaction_hash || event.id;
              const journalEntry = journalMap.get(journalKey);
              if (journalEntry) {
                return {
                  ...event,
                  notes: journalEntry.notes,
                  tags: journalEntry.tags,
                  is_flagged: journalEntry.is_flagged,
                  what_went_well: journalEntry.what_went_well,
                  what_went_wrong: journalEntry.what_went_wrong,
                  what_will_i_do_differently: journalEntry.what_will_i_do_differently,
                  is_journaled: true,
                  journal_updated_at: journalEntry.updated_at,
                };
              }
              return { ...event, is_journaled: false };
            })
            .sort((a: any, b: any) => {
              const dateA = a.journal_updated_at ? new Date(a.journal_updated_at) : new Date(a.date);
              const dateB = b.journal_updated_at ? new Date(b.journal_updated_at) : new Date(b.date);
              return dateB.getTime() - dateA.getTime();
            });
        },
      }),
    ];

    if (selectedWalletId === null && (filterWallets?.length || 0) > 0) {
      tasks.push(
        cachedFetch({
          revalidateOnHit: false,
          key: `holdings:${userId}:${walletKey}`,
          fetcher: async () => {
            const res = await authedFetchClient(getBearerToken, `/api/dashboard-data`);
            return parseApiResponse(res);
          },
        })
      );
    } else if (resolvedWalletAddress) {
      tasks.push(
        cachedFetch({
          revalidateOnHit: false,
          key: `holdings:${userId}:${walletKey}:${resolvedWalletAddress}`,
          fetcher: async () => {
            const res = await authedFetchClient(getBearerToken, `/api/holdings?walletAddress=${resolvedWalletAddress}`);
            return parseApiResponse(res);
          },
        })
      );
    }

    void Promise.allSettled(tasks);
  }, [
    settings.preloadDataInBackground,
    ready,
    authenticated,
    dbUser?.id,
    selectedWalletId,
    selectedWallet?.wallet_address,
    walletScope,
    walletFilterLoading,
    filterWallets?.length,
    resolvedWalletAddress,
    getBearerToken,
    normalizeTradesPayload,
  ]);

  useEffect(() => {
    if (!ready || !authenticated) {
      return;
    }
    if (!settings.autoSyncOnLogin) {
      return;
    }
    if (!dbUser?.id || walletFilterLoading) {
      return;
    }

    const targets =
      selectedWalletId === null
        ? filterWallets
        : selectedWallet
          ? [selectedWallet]
          : [];

    if (!targets.length) {
      return;
    }

    const scope = `${dbUser.id}:${selectedWalletId ?? "all"}:${targets
      .map((wallet: any) => wallet.id)
      .join(",")}`;
    const lastRun = autoSyncLastRunRef.current.get(scope) || 0;
    if (Date.now() - lastRun < 45_000) {
      return;
    }

    if (autoSyncDebounceRef.current) {
      clearTimeout(autoSyncDebounceRef.current);
    }

    autoSyncDebounceRef.current = setTimeout(() => {
      void (async () => {
        setSyncStatus(true, scope);
        try {
          for (const wallet of targets) {
            const response = await authedFetchClient(getBearerToken, "/api/journal/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                walletAddress: wallet.wallet_address,
              }),
            });
            const data = await parseApiResponse<any>(response);

            const nextTimestamp = data?.last_synced_at || new Date().toISOString();
            const key = `tradelog:lastSyncedAt:${wallet.id}`;
            localStorage.setItem(key, nextTimestamp);
            window.dispatchEvent(
              new CustomEvent("tradelog:wallet-synced", {
                detail: { walletId: wallet.id, timestamp: nextTimestamp },
              })
            );
          }

          autoSyncLastRunRef.current.set(scope, Date.now());
        } catch (error) {
          console.error("Auto-sync error:", error);
        } finally {
          setSyncStatus(false, scope);
        }
      })();
    }, 1000);

    return () => {
      if (autoSyncDebounceRef.current) {
        clearTimeout(autoSyncDebounceRef.current);
      }
    };
  }, [
    settings.autoSyncOnLogin,
    ready,
    authenticated,
    dbUser?.id,
    walletFilterLoading,
    selectedWalletId,
    selectedWallet,
    filterWallets,
    setSyncStatus,
    getBearerToken,
  ]);

  const renderMainContent = () => {
    if (isLoading) {
      return <LoadingScreen />;
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
        if (!hasWallets) {
          return (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-white">Trading Dashboard</h1>
                <div className="flex items-center gap-4">
                  <WalletSelector dbUser={dbUser} />
                </div>
              </div>
              <FirstWalletEmptyState />
            </div>
          );
        }
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
              isLoading={!isDashboardDataReady} 
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

export function DashboardClient({
  initialTrades: propInitialTrades,
  initialHoldings: propInitialHoldings,
  initialActiveItem = "Dashboard",
}: any) {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const getBearerToken = useCallback(async () => (await getAccessToken?.()) || null, [getAccessToken]);
  const [dbUser, setDbUser] = useState<User | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      if (!ready) {
        return;
      }

      if (!authenticated) {
        setDbUser(null);
        setIsUserLoading(false);
        return;
      }

      setIsUserLoading(true);
      try {
        const response = await authedFetchClient(getBearerToken, '/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const user = await parseApiResponse<User>(response);
        setDbUser(user);
      } catch (error) {
        console.error("Initialization error:", error);
      } finally {
        setIsUserLoading(false);
      }
    };

    fetchUser();
  }, [ready, authenticated, getBearerToken]);

  if (!ready) {
    return <LoadingScreen />;
  }

  if (!authenticated) {
    return <WalletConnection />;
  }

  if (isUserLoading) {
    return <LoadingScreen />;
  }

  if (!dbUser) {
    return <LoadingScreen />;
  }

  return (
    <WalletFilterProvider dbUser={dbUser}>
      <DashboardContent
        dbUser={dbUser}
        propInitialTrades={propInitialTrades}
        propInitialHoldings={propInitialHoldings}
        initialActiveItem={initialActiveItem}
      />
    </WalletFilterProvider>
  );
}
