"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { User } from "@/lib/types";
import { useWalletFilter } from "@/app/contexts/WalletFilterContext";
import { shortenAddress } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JournalEntryModal } from "@/components/JournalEntryModal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WalletSelector } from "@/components/WalletSelector";
import { cachedFetch } from "@/lib/cachedFetch";
import { invalidateCache } from "@/lib/cache";

type TradeRow = {
  id: number;
  wallet_id: number | null;
  wallet_address: string;
  token_symbol: string;
  token_address: string;
  trade_type: "buy" | "sell";
  amount: number;
  price: number;
  total_value: number;
  trade_date: string;
  source: string;
  transaction_hash: string;
};

type JournalEntryRow = {
  tx_hash: string;
  is_journaled?: boolean | null;
  is_flagged?: boolean | null;
  notes?: string | null;
  tags?: string[] | null;
  what_went_well?: string | null;
  what_went_wrong?: string | null;
  what_will_i_do_differently?: string | null;
};

export const TradesPage = ({
  dbUser,
}: {
  dbUser: User;
}) => {
  const { selectedWalletId, selectedWallet, wallets, refreshWallets } = useWalletFilter();
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [journaledTxHashes, setJournaledTxHashes] = useState<Set<string>>(new Set());
  const [journalEntriesByTx, setJournalEntriesByTx] = useState<Map<string, JournalEntryRow>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingData, setIsRefreshingData] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
  const [selectedTradeForJournal, setSelectedTradeForJournal] = useState<TradeRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyTradesPayload = useCallback((payload: { trades: TradeRow[]; entries: JournalEntryRow[] }) => {
    const nextTrades = payload?.trades || [];
    const entriesData = payload?.entries || [];
    const curatedTxHashes = new Set(
      entriesData
        .filter((entry) => !!entry?.tx_hash && !!entry.is_journaled)
        .map((entry) => entry.tx_hash)
    );

    setTrades(nextTrades);
    setJournaledTxHashes(curatedTxHashes);
    setJournalEntriesByTx(new Map(entriesData.map((entry) => [entry.tx_hash, entry])));
  }, []);

  const fetchTrades = useCallback(async () => {
    if (!dbUser?.id) {
      setIsLoading(false);
      return;
    }

    setIsRefreshingData(true);
    if (trades.length === 0) {
      setIsLoading(true);
    }
    setError(null);
    try {
      const walletScope = selectedWalletId ?? "all";
      const payload = await cachedFetch<{ trades: TradeRow[]; entries: JournalEntryRow[] }>({
        key: `trades:${dbUser.id}:${walletScope}`,
        fetcher: async () => {
          let tradesUrl = `/api/trades?userId=${dbUser.id}`;
          let entriesUrl = `/api/journal/entries?userId=${dbUser.id}`;
          if (selectedWalletId !== null) {
            tradesUrl += `&walletId=${selectedWalletId}`;
            entriesUrl += `&walletId=${selectedWalletId}`;
          }

          const [tradesResponse, entriesResponse] = await Promise.all([
            fetch(tradesUrl),
            fetch(entriesUrl),
          ]);

          const tradesData = await tradesResponse.json();
          if (!tradesResponse.ok) {
            throw new Error(tradesData.error || "Failed to fetch trades");
          }

          let entriesData: JournalEntryRow[] = [];
          if (entriesResponse.ok) {
            entriesData = await entriesResponse.json();
          }

          return {
            trades: tradesData || [],
            entries: entriesData || [],
          };
        },
        onUpdate: applyTradesPayload,
      });

      applyTradesPayload(payload);
    } catch (err: any) {
      setError(err.message || "Failed to fetch trades");
    } finally {
      setIsLoading(false);
      setIsRefreshingData(false);
    }
  }, [dbUser?.id, selectedWalletId, applyTradesPayload, trades.length]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  const handleSyncTrades = async () => {
    if (!dbUser?.id) return;
    if (wallets.length === 0) {
      setError("No wallets available to sync.");
      return;
    }

    setIsSyncing(true);
    setError(null);
    try {
      const targetWallets =
        selectedWalletId === null
          ? wallets
          : wallets.filter((wallet) => wallet.id === selectedWalletId || wallet.wallet_address === selectedWallet?.wallet_address);

      await Promise.all(
        targetWallets.map(async (wallet) => {
          const response = await fetch("/api/journal/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: dbUser.id,
              walletAddress: wallet.wallet_address,
            }),
          });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data?.error || "Failed to sync trades");
          }
          return data;
        })
      );

      await refreshWallets();
      invalidateCache(`trades:${dbUser.id}:`);
      await fetchTrades();
    } catch (err: any) {
      setError(err.message || "Failed to sync trades");
    } finally {
      setIsSyncing(false);
    }
  };

  const walletLabelById = useMemo(() => {
    const map = new Map<number, string>();
    wallets.forEach((wallet, index) => {
      const label = wallet.label || `Wallet ${index + 1}`;
      map.set(wallet.id, `${label} (${shortenAddress(wallet.wallet_address)})`);
    });
    return map;
  }, [wallets]);

  const lastSyncedText = useMemo(() => {
    const toRelative = (iso: string) => {
      const timestamp = new Date(iso).getTime();
      if (!Number.isFinite(timestamp)) return "unknown";
      const diffMs = Date.now() - timestamp;
      if (diffMs < 60_000) return "just now";
      const minutes = Math.floor(diffMs / 60_000);
      if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
      const days = Math.floor(hours / 24);
      return `${days} day${days === 1 ? "" : "s"} ago`;
    };

    if (wallets.length === 0) return null;

    if (selectedWalletId !== null) {
      const selected = wallets.find((wallet) => wallet.id === selectedWalletId);
      if (!selected?.last_synced_at) return "Last synced: never";
      return `Last synced: ${toRelative(selected.last_synced_at)}`;
    }

    const latest = wallets
      .map((wallet) => wallet.last_synced_at)
      .filter((value): value is string => !!value)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

    if (!latest) return "Last synced: never";
    return `Last synced: ${toRelative(latest)} (latest wallet)`;
  }, [wallets, selectedWalletId]);

  const showWalletColumn = selectedWalletId === null;

  const handleAddToJournal = (trade: TradeRow) => {
    if (!trade.transaction_hash) return;
    if (!trade.wallet_id) {
      setError("Cannot journal this trade because wallet_id is missing.");
      return;
    }

    setError(null);
    // Immediate local UI state only. No network work here.
    setSelectedTradeForJournal(trade);
    setIsJournalModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Trades</h1>
        <div className="flex items-center gap-3">
          {isRefreshingData && <span className="text-xs text-muted-foreground">Refreshing...</span>}
          {lastSyncedText && <span className="text-xs text-muted-foreground">{lastSyncedText}</span>}
          <Button variant="outline" size="sm" onClick={handleSyncTrades} disabled={isSyncing}>
            {isSyncing ? "Syncing..." : "Sync"}
          </Button>
          <WalletSelector dbUser={dbUser} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trade History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading trades...</p>
          ) : error ? (
            <p className="text-sm text-red-400">{error}</p>
          ) : trades.length === 0 ? (
            <p className="text-sm text-muted-foreground">No trades found for this wallet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    {showWalletColumn && <TableHead>Wallet</TableHead>}
                    <TableHead>Token</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Total Value</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trades.map((trade) => (
                    <TableRow key={trade.id}>
                      <TableCell>{new Date(trade.trade_date).toLocaleString()}</TableCell>
                      <TableCell className={trade.trade_type === "buy" ? "text-green-400 capitalize" : "text-red-400 capitalize"}>
                        {trade.trade_type}
                      </TableCell>
                      {showWalletColumn && (
                        <TableCell>
                          {trade.wallet_id && walletLabelById.get(trade.wallet_id)
                            ? walletLabelById.get(trade.wallet_id)
                            : trade.wallet_address}
                        </TableCell>
                      )}
                      <TableCell>{trade.token_symbol}</TableCell>
                      <TableCell>{Number(trade.amount || 0).toLocaleString(undefined, { maximumFractionDigits: 6 })}</TableCell>
                      <TableCell>${Number(trade.price || 0).toLocaleString(undefined, { maximumFractionDigits: 6 })}</TableCell>
                      <TableCell>${Number(trade.total_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell>
                        <span
                          title="Journaling helps you review and improve your trading decisions."
                          className="inline-block"
                        >
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={journaledTxHashes.has(trade.transaction_hash) || !trade.wallet_id}
                            onClick={() => handleAddToJournal(trade)}
                          >
                            {journaledTxHashes.has(trade.transaction_hash)
                              ? "Journaled"
                              : "Add to Journal"}
                          </Button>
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedTradeForJournal && selectedTradeForJournal.wallet_id && selectedTradeForJournal.transaction_hash && (
        <JournalEntryModal
          open={isJournalModalOpen}
          onOpenChange={(open) => {
            setIsJournalModalOpen(open);
            if (!open) {
              setSelectedTradeForJournal(null);
            }
          }}
          userId={dbUser.id}
          walletId={selectedTradeForJournal.wallet_id}
          tx_hash={selectedTradeForJournal.transaction_hash}
          initialValues={{
            notes: journalEntriesByTx.get(selectedTradeForJournal.transaction_hash)?.notes || "",
            tags: journalEntriesByTx.get(selectedTradeForJournal.transaction_hash)?.tags || [],
            what_went_well: journalEntriesByTx.get(selectedTradeForJournal.transaction_hash)?.what_went_well || "",
            what_went_wrong: journalEntriesByTx.get(selectedTradeForJournal.transaction_hash)?.what_went_wrong || "",
            what_will_i_do_differently: journalEntriesByTx.get(selectedTradeForJournal.transaction_hash)?.what_will_i_do_differently || "",
            is_flagged: journalEntriesByTx.get(selectedTradeForJournal.transaction_hash)?.is_flagged || false,
          }}
          tokenSymbol={selectedTradeForJournal.token_symbol}
          tradeDate={selectedTradeForJournal.trade_date}
          onSaved={(savedJournalEntry) => {
            setJournaledTxHashes((prev) => {
              const next = new Set(prev);
              next.add(selectedTradeForJournal.transaction_hash);
              return next;
            });
            setJournalEntriesByTx((prev) => {
              const next = new Map(prev);
              next.set(selectedTradeForJournal.transaction_hash, savedJournalEntry);
              return next;
            });
            setIsJournalModalOpen(false);
            setSelectedTradeForJournal(null);
          }}
        />
      )}
    </div>
  );
};
