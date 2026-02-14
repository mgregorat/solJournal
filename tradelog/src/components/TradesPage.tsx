"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { User } from "@/lib/types";
import { useWalletFilter } from "@/app/contexts/WalletFilterContext";
import { shortenAddress } from "@/lib/utils";
import { WalletSelector } from "@/components/WalletSelector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createApiClient } from "@/lib/apiClient";
import {
  DEFAULT_TRADES_QUERY,
  JournaledFilter,
  TradeListItem,
  TradeSortDirection,
  TradeSortField,
  TradeTypeFilter,
  TradesPageData,
  fetchTradesPage,
} from "@/lib/tradesQuery";
import { TradeTable } from "@/components/trades/TradeTable";
import { TradeDrawer } from "@/components/trades/TradeDrawer";
import { getCache, getCacheWithMeta, invalidateCache } from "@/lib/cache";
import { FirstWalletEmptyState } from "@/components/FirstWalletEmptyState";

type SortOptionValue =
  | "trade_date_desc"
  | "trade_date_asc"
  | "total_value_usd_desc"
  | "total_value_usd_asc"
  | "realized_pnl_usd_desc"
  | "realized_pnl_usd_asc";

const SORT_OPTIONS: Array<{ value: SortOptionValue; label: string; sort: TradeSortField; dir: TradeSortDirection }> = [
  { value: "trade_date_desc", label: "Newest", sort: "trade_date", dir: "desc" },
  { value: "trade_date_asc", label: "Oldest", sort: "trade_date", dir: "asc" },
  { value: "total_value_usd_desc", label: "Largest Value", sort: "total_value_usd", dir: "desc" },
  { value: "total_value_usd_asc", label: "Smallest Value", sort: "total_value_usd", dir: "asc" },
  { value: "realized_pnl_usd_desc", label: "Best PnL", sort: "realized_pnl_usd", dir: "desc" },
  { value: "realized_pnl_usd_asc", label: "Worst PnL", sort: "realized_pnl_usd", dir: "asc" },
];

function getSortOption(sort: TradeSortField, dir: TradeSortDirection): SortOptionValue {
  const found = SORT_OPTIONS.find((option) => option.sort === sort && option.dir === dir);
  return found ? found.value : "trade_date_desc";
}

export const TradesPage = ({ dbUser }: { dbUser: User }) => {
  const { getAccessToken } = usePrivy();
  const getBearerToken = useCallback(async () => (await getAccessToken?.()) || null, [getAccessToken]);
  const api = useMemo(() => createApiClient({ getAccessToken: getBearerToken }), [getBearerToken]);
  const { selectedWalletId, selectedWallet, wallets, refreshWallets } = useWalletFilter();

  const [rows, setRows] = useState<TradeListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const nextCursorRef = useRef<string | null>(null);
  const requestSeqRef = useRef(0);
  const requestAbortRef = useRef<AbortController | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<TradeListItem | null>(null);
  const [isUpdatingJournaled, setIsUpdatingJournaled] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TradeTypeFilter>(DEFAULT_TRADES_QUERY.type);
  const [journaledFilter, setJournaledFilter] = useState<JournaledFilter>(DEFAULT_TRADES_QUERY.journaled);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [sortField, setSortField] = useState<TradeSortField>(DEFAULT_TRADES_QUERY.sort);
  const [sortDir, setSortDir] = useState<TradeSortDirection>(DEFAULT_TRADES_QUERY.dir);

  const abortActiveRequest = useCallback(() => {
    const controller = requestAbortRef.current;
    if (!controller || controller.signal.aborted) return;
    try {
      controller.abort(new DOMException("Trades request cancelled", "AbortError"));
    } catch {
      try {
        controller.abort();
      } catch {
        // no-op
      }
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const walletLabelById = useMemo(() => {
    const map = new Map<number, string>();
    wallets.forEach((wallet, index) => {
      const label = wallet.label || `Wallet ${index + 1}`;
      map.set(wallet.id, `${label} (${shortenAddress(wallet.wallet_address)})`);
    });
    return map;
  }, [wallets]);

  const showWalletColumn = selectedWalletId === null;
  const walletScope = selectedWalletId ?? "all";
  const isDefaultQuery =
    !debouncedSearch &&
    typeFilter === DEFAULT_TRADES_QUERY.type &&
    journaledFilter === DEFAULT_TRADES_QUERY.journaled &&
    !dateFrom &&
    !dateTo &&
    sortField === DEFAULT_TRADES_QUERY.sort &&
    sortDir === DEFAULT_TRADES_QUERY.dir;

  const queryBase = useMemo(
    () => ({
      walletId: selectedWalletId,
      walletAddress: selectedWalletId === null ? null : selectedWallet?.wallet_address || null,
      q: debouncedSearch || undefined,
      type: typeFilter,
      journaled: journaledFilter,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      sort: sortField,
      dir: sortDir,
      limit: 50,
    }),
    [selectedWalletId, selectedWallet?.wallet_address, debouncedSearch, typeFilter, journaledFilter, dateFrom, dateTo, sortField, sortDir]
  );

  const loadTrades = useCallback(
    async (mode: "reset" | "more", cursorOverride?: string | null) => {
      if (!wallets.length) {
        setRows([]);
        setHasMore(false);
        setNextCursor(null);
        setError(null);
        setIsLoadingInitial(false);
        setIsLoadingMore(false);
        return;
      }

      const controller = new AbortController();
      abortActiveRequest();
      requestAbortRef.current = controller;
      const requestSeq = ++requestSeqRef.current;

      try {
        setError(null);
        if (mode === "reset") {
          setIsLoadingInitial(true);
        } else {
          setIsLoadingMore(true);
        }

        const payload: TradesPageData = await fetchTradesPage(getBearerToken, {
          ...queryBase,
          cursor: mode === "more" ? cursorOverride ?? nextCursorRef.current : null,
        }, { signal: controller.signal });

        if (requestSeq !== requestSeqRef.current) {
          return;
        }

        setRows((prev) => (mode === "reset" ? payload.items : [...prev, ...payload.items]));
        setNextCursor(payload.nextCursor);
        nextCursorRef.current = payload.nextCursor;
        setHasMore(payload.hasMore);
      } catch (err: unknown) {
        if (
          (err instanceof DOMException && err.name === "AbortError") ||
          (err instanceof Error && err.name === "AbortError")
        ) {
          return;
        }
        if (requestSeq !== requestSeqRef.current) {
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load trades");
      } finally {
        if (requestSeq !== requestSeqRef.current) {
          return;
        }
        setIsLoadingInitial(false);
        setIsLoadingMore(false);
      }
    },
    [abortActiveRequest, getBearerToken, queryBase, wallets.length]
  );

  useEffect(() => {
    nextCursorRef.current = null;
    if (isDefaultQuery) {
      const listCacheKey = `trades-list:${dbUser.id}:${walletScope}`;
      const cachedList = getCache<TradeListItem[]>(listCacheKey);
      if (Array.isArray(cachedList) && cachedList.length > 0) {
        setRows(cachedList);
        setHasMore(false);
        setNextCursor(null);
        setIsLoadingInitial(false);
        setError(null);
        return;
      }
      const staleList = getCacheWithMeta<TradeListItem[]>(listCacheKey);
      if (Array.isArray(staleList?.data) && staleList.data.length > 0) {
        setRows(staleList.data);
        setHasMore(false);
        setNextCursor(null);
        setIsLoadingInitial(false);
        setError(null);
        return;
      }

      const bundleCacheKey = `trades:${dbUser.id}:${walletScope}`;
      const cachedBundle = getCache<{ trades?: TradeListItem[] }>(bundleCacheKey);
      if (Array.isArray(cachedBundle?.trades) && cachedBundle.trades.length > 0) {
        setRows(cachedBundle.trades);
        setHasMore(false);
        setNextCursor(null);
        setIsLoadingInitial(false);
        setError(null);
        return;
      }
      const staleBundle = getCacheWithMeta<{ trades?: TradeListItem[] }>(bundleCacheKey);
      if (Array.isArray(staleBundle?.data?.trades) && staleBundle.data.trades.length > 0) {
        setRows(staleBundle.data.trades);
        setHasMore(false);
        setNextCursor(null);
        setIsLoadingInitial(false);
        setError(null);
        return;
      }
    }

    void loadTrades("reset");
  }, [dbUser.id, isDefaultQuery, loadTrades, queryBase, walletScope]);

  useEffect(() => {
    return () => {
      abortActiveRequest();
    };
  }, [abortActiveRequest]);

  const handleLoadMore = useCallback(() => {
    if (!hasMore || isLoadingMore || !nextCursorRef.current) return;
    void loadTrades("more", nextCursorRef.current);
  }, [hasMore, isLoadingMore, loadTrades]);

  const handleSyncTrades = useCallback(async () => {
    if (!wallets.length) {
      setError("No wallets available to sync.");
      return;
    }

    setIsSyncing(true);
    setError(null);
    try {
      const targetWallets =
        selectedWalletId === null
          ? wallets
          : wallets.filter((wallet) => wallet.id === selectedWalletId);

      await Promise.all(
        targetWallets.map((wallet) =>
          api.post("/api/journal/sync", {
            walletAddress: wallet.wallet_address,
          })
        )
      );
      await refreshWallets();
      invalidateCache(`trades:${dbUser.id}:`);
      invalidateCache(`trades-list:${dbUser.id}:`);
      setNextCursor(null);
      nextCursorRef.current = null;
      await loadTrades("reset");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to sync trades");
    } finally {
      setIsSyncing(false);
    }
  }, [api, dbUser.id, loadTrades, refreshWallets, selectedWalletId, wallets]);

  const handleSortChange = (value: SortOptionValue) => {
    const selected = SORT_OPTIONS.find((option) => option.value === value);
    if (!selected) return;
    setSortField(selected.sort);
    setSortDir(selected.dir);
  };

  const handleToggleJournaled = useCallback(
    async (trade: TradeListItem) => {
      if (!trade.wallet_id) return;
      setIsUpdatingJournaled(true);
      try {
        await api.patch("/api/journal/flag", {
          tx_hash: trade.transaction_hash,
          walletId: trade.wallet_id,
          is_journaled: !trade.is_journaled,
        });
        setRows((prev) =>
          prev.map((row) =>
            row.transaction_hash === trade.transaction_hash
              ? { ...row, is_journaled: !row.is_journaled }
              : row
          )
        );
        setSelectedTrade((prev) =>
          prev && prev.transaction_hash === trade.transaction_hash
            ? { ...prev, is_journaled: !prev.is_journaled }
            : prev
        );
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to update journal status");
      } finally {
        setIsUpdatingJournaled(false);
      }
    },
    [api]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-white">Trades</h1>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleSyncTrades} disabled={isSyncing}>
            {isSyncing ? "Syncing..." : "Sync"}
          </Button>
          <WalletSelector dbUser={dbUser} />
        </div>
      </div>

      {wallets.length === 0 && (
        <FirstWalletEmptyState />
      )}

      {wallets.length > 0 && (
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-6">
          <Input
            placeholder="Search token"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="lg:col-span-2"
          />

          <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as TradeTypeFilter)}>
            <SelectTrigger>
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="buy">Buy</SelectItem>
              <SelectItem value="sell">Sell</SelectItem>
            </SelectContent>
          </Select>

          <Select value={journaledFilter} onValueChange={(value) => setJournaledFilter(value as JournaledFilter)}>
            <SelectTrigger>
              <SelectValue placeholder="Journaled" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="journaled">Journaled</SelectItem>
              <SelectItem value="unjournaled">Unjournaled</SelectItem>
            </SelectContent>
          </Select>

          <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />

          <Select value={getSortOption(sortField, sortDir)} onValueChange={(value) => handleSortChange(value as SortOptionValue)}>
            <SelectTrigger className="lg:col-span-2">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      )}

      {wallets.length > 0 && (
      <Card>
        <CardHeader>
          <CardTitle>Trade History</CardTitle>
        </CardHeader>
        <CardContent>
          <TradeTable
            rows={rows}
            showWalletColumn={showWalletColumn}
            walletLabelById={walletLabelById}
            onRowClick={setSelectedTrade}
            isLoading={isLoadingInitial}
            isError={Boolean(error)}
            errorMessage={error}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={handleLoadMore}
          />
        </CardContent>
      </Card>
      )}

      <TradeDrawer
        open={Boolean(selectedTrade)}
        trade={selectedTrade}
        onOpenChange={(open) => {
          if (!open) setSelectedTrade(null);
        }}
        onToggleJournaled={handleToggleJournaled}
        isUpdatingJournaled={isUpdatingJournaled}
      />
    </div>
  );
};
