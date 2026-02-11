"use client";

import { useEffect, useMemo, useState } from "react";
import { useWalletFilter } from "@/app/contexts/WalletFilterContext";
import { useWallet } from "@solana/wallet-adapter-react";
import { Wallet } from "@/lib/types";
import { shortenAddress } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAppSettings } from "@/lib/hooks/useAppSettings";
import { clearCache } from "@/lib/cache";
import { LinkWalletModal } from "@/components/LinkWalletModal";
import toast from "react-hot-toast";

export function SettingsPage() {
  const { dbUserId, selectedWalletId, setSelectedWalletId, refreshWallets } = useWalletFilter();
  const { publicKey } = useWallet();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isLoadingWallets, setIsLoadingWallets] = useState(false);
  const [isLinkWalletModalOpen, setIsLinkWalletModalOpen] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [isSavingNickname, setIsSavingNickname] = useState(false);
  const [removingWallet, setRemovingWallet] = useState<Wallet | null>(null);
  const [removeConfirmText, setRemoveConfirmText] = useState("");
  const [isRemovingWallet, setIsRemovingWallet] = useState(false);
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isClearCacheModalOpen, setIsClearCacheModalOpen] = useState(false);
  const [lastSyncedByWalletId, setLastSyncedByWalletId] = useState<Record<number, string>>({});
  const { settings, updateSetting } = useAppSettings(dbUserId);

  const selectedWalletStorageKey = useMemo(
    () => (dbUserId ? `tradelog:selectedWalletId:${dbUserId}` : "tradelog:selectedWallet"),
    [dbUserId]
  );

  const getNicknameStorageKey = (walletId: number) => `tradelog:walletNickname:${walletId}`;
  const getLastSyncedStorageKey = (walletId: number) => `tradelog:lastSyncedAt:${walletId}`;
  const syncStatusStorageKey = useMemo(
    () => (dbUserId ? `tradelog:syncState:${dbUserId}` : null),
    [dbUserId]
  );
  const connectedWalletAddress = publicKey ? publicKey.toBase58() : null;

  const getLocalNickname = (walletId: number) => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(getNicknameStorageKey(walletId));
  };

  const setLocalNickname = (walletId: number, value: string | null) => {
    if (typeof window === "undefined") return;
    const key = getNicknameStorageKey(walletId);
    if (!value || value.trim().length === 0) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, value.trim());
  };

  const fetchWallets = async () => {
    if (!dbUserId) return;
    setIsLoadingWallets(true);
    try {
      const response = await fetch(`/api/wallets?userId=${dbUserId}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to fetch wallets");
      }
      setWallets(data || []);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load wallets");
      setWallets([]);
    } finally {
      setIsLoadingWallets(false);
    }
  };

  useEffect(() => {
    fetchWallets();
  }, [dbUserId]);

  const connectedWalletAlreadyAdded =
    !!connectedWalletAddress &&
    wallets.some(
      (wallet) =>
        wallet.wallet_address === connectedWalletAddress
    );

  const handleWalletLinked = async (wallet: { id: number }) => {
    await fetchWallets();
    await refreshWallets();
    setSelectedWalletId(wallet.id);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncedMap: Record<number, string> = {};
    for (const wallet of wallets) {
      const value = localStorage.getItem(getLastSyncedStorageKey(wallet.id));
      if (value) {
        syncedMap[wallet.id] = value;
      }
    }
    setLastSyncedByWalletId(syncedMap);
  }, [wallets]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!syncStatusStorageKey) {
      setIsAutoSyncing(false);
      return;
    }

    const readSyncState = () => {
      try {
        const raw = localStorage.getItem(syncStatusStorageKey);
        if (!raw) {
          setIsAutoSyncing(false);
          return;
        }
        const parsed = JSON.parse(raw);
        setIsAutoSyncing(Boolean(parsed?.syncing));
      } catch {
        setIsAutoSyncing(false);
      }
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === syncStatusStorageKey) {
        readSyncState();
      }
      if (!event.key?.startsWith("tradelog:lastSyncedAt:")) return;
      const walletId = Number(event.key.split(":").pop());
      if (!Number.isFinite(walletId) || !event.newValue) return;
      setLastSyncedByWalletId((prev) => ({ ...prev, [walletId]: event.newValue as string }));
    };

    const onSyncStatus = (event: Event) => {
      const detail = (event as CustomEvent<{ syncing?: boolean }>).detail;
      setIsAutoSyncing(Boolean(detail?.syncing));
    };

    const onWalletSynced = (event: Event) => {
      const detail = (event as CustomEvent<{ walletId?: number; timestamp?: string }>).detail;
      if (!detail?.walletId || !detail?.timestamp) return;
      setLastSyncedByWalletId((prev) => ({ ...prev, [detail.walletId as number]: detail.timestamp as string }));
    };

    readSyncState();
    window.addEventListener("storage", onStorage);
    window.addEventListener("tradelog:sync-status", onSyncStatus);
    window.addEventListener("tradelog:wallet-synced", onWalletSynced);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("tradelog:sync-status", onSyncStatus);
      window.removeEventListener("tradelog:wallet-synced", onWalletSynced);
    };
  }, [syncStatusStorageKey]);

  const handleSetDefault = (walletId: number) => {
    localStorage.setItem(selectedWalletStorageKey, String(walletId));
    setSelectedWalletId(walletId);
    toast.success("Default wallet updated");
  };

  const openRenameModal = (wallet: Wallet) => {
    const localFallback = getLocalNickname(wallet.id) || "";
    const initialValue = wallet.label || localFallback;
    setEditingWallet(wallet);
    setNicknameDraft(initialValue);
  };

  const handleSaveNickname = async () => {
    if (!editingWallet || !dbUserId) return;
    const nextLabel = nicknameDraft.trim();
    setIsSavingNickname(true);
    try {
      const response = await fetch("/api/wallets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: dbUserId,
          walletId: editingWallet.id,
          label: nextLabel,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setLocalNickname(editingWallet.id, null);
        setWallets((prev) =>
          prev.map((wallet) =>
            wallet.id === editingWallet.id ? { ...wallet, label: data?.label ?? (nextLabel || null) } : wallet
          )
        );
        toast.success("Wallet nickname updated");
      } else {
        setLocalNickname(editingWallet.id, nextLabel || null);
        setWallets((prev) =>
          prev.map((wallet) =>
            wallet.id === editingWallet.id ? { ...wallet, label: wallet.label ?? null } : wallet
          )
        );
        toast.success("Wallet nickname saved locally");
      }

      setEditingWallet(null);
      setNicknameDraft("");
      await fetchWallets();
      await refreshWallets();
    } catch {
      setLocalNickname(editingWallet.id, nextLabel || null);
      toast.success("Wallet nickname saved locally");
      setEditingWallet(null);
      setNicknameDraft("");
    } finally {
      setIsSavingNickname(false);
    }
  };

  const displayWalletName = (wallet: Wallet) => {
    const localNickname = getLocalNickname(wallet.id);
    const nickname = wallet.label || localNickname;
    if (nickname) {
      return nickname;
    }
    return `Wallet (${shortenAddress(wallet.wallet_address)})`;
  };

  const activeWalletDisplay = useMemo(() => {
    if (selectedWalletId === null) return "All wallets";
    const wallet = wallets.find((item) => item.id === selectedWalletId);
    if (!wallet) return "Selected wallet";
    return `${displayWalletName(wallet)} (${shortenAddress(wallet.wallet_address)})`;
  }, [selectedWalletId, wallets]);

  const getRemoveBlockedReason = (wallet: Wallet): string | null => {
    if (wallets.length <= 1) {
      return "Cannot remove the last wallet.";
    }
    if (selectedWalletId === wallet.id) {
      return "Cannot remove the currently selected wallet.";
    }
    return null;
  };

  const openRemoveModal = (wallet: Wallet) => {
    const blockedReason = getRemoveBlockedReason(wallet);
    if (blockedReason) {
      toast.error(blockedReason);
      return;
    }

    setRemovingWallet(wallet);
    setRemoveConfirmText("");
  };

  const handleRemoveWallet = async () => {
    if (!removingWallet || !dbUserId) return;

    if (selectedWalletId === removingWallet.id) {
      toast.error("Cannot remove the currently selected wallet.");
      return;
    }
    if (wallets.length <= 1) {
      toast.error("Cannot remove the last wallet.");
      return;
    }
    if (removeConfirmText.trim() !== "REMOVE") {
      toast.error('Type "REMOVE" to confirm.');
      return;
    }

    setIsRemovingWallet(true);
    try {
      const response = await fetch("/api/wallets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: dbUserId,
          walletId: removingWallet.id,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Failed to remove wallet");
      }

      const remainingWallets = wallets.filter((wallet) => wallet.id !== removingWallet.id);
      setWallets(remainingWallets);
      localStorage.removeItem(getNicknameStorageKey(removingWallet.id));
      localStorage.removeItem(getLastSyncedStorageKey(removingWallet.id));

      const savedDefault = localStorage.getItem(selectedWalletStorageKey);
      if (savedDefault === String(removingWallet.id)) {
        const nextDefault = remainingWallets[0]?.id;
        if (nextDefault) {
          localStorage.setItem(selectedWalletStorageKey, String(nextDefault));
          setSelectedWalletId(nextDefault);
        } else {
          localStorage.setItem(selectedWalletStorageKey, "all");
          setSelectedWalletId(null);
        }
      }

      toast.success("Wallet removed.");
      setRemovingWallet(null);
      setRemoveConfirmText("");
      await fetchWallets();
      await refreshWallets();
    } catch (error: any) {
      toast.error(error?.message || "Failed to remove wallet");
    } finally {
      setIsRemovingWallet(false);
    }
  };

  const formatLastSynced = (iso?: string | null) => {
    if (!iso) return "Never";
    const ts = new Date(iso).getTime();
    if (!Number.isFinite(ts)) return "Unknown";
    const diffMs = Date.now() - ts;
    if (diffMs < 60_000) return "Just now";
    const minutes = Math.floor(diffMs / 60_000);
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  };

  const getWalletLastSynced = (wallet: Wallet) => {
    return lastSyncedByWalletId[wallet.id] || wallet.last_synced_at || null;
  };

  const syncSingleWallet = async (wallet: Wallet) => {
    if (!dbUserId) return;
    const response = await fetch("/api/journal/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: dbUserId,
        walletAddress: wallet.wallet_address,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || `Failed to sync ${displayWalletName(wallet)}`);
    }

    const nextTimestamp = data?.last_synced_at || new Date().toISOString();
    localStorage.setItem(getLastSyncedStorageKey(wallet.id), nextTimestamp);
    setLastSyncedByWalletId((prev) => ({ ...prev, [wallet.id]: nextTimestamp }));
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("tradelog:wallet-synced", {
          detail: { walletId: wallet.id, timestamp: nextTimestamp },
        })
      );
    }

    return data;
  };

  const handleSyncNow = async () => {
    if (!dbUserId) {
      toast.error("User not ready yet.");
      return;
    }
    if (wallets.length === 0) {
      toast.error("No wallets available to sync.");
      return;
    }

    setIsSyncingNow(true);
    if (syncStatusStorageKey && typeof window !== "undefined") {
      const payload = {
        syncing: true,
        scope: `manual:${selectedWalletId ?? "all"}`,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(syncStatusStorageKey, JSON.stringify(payload));
      window.dispatchEvent(new CustomEvent("tradelog:sync-status", { detail: payload }));
    }
    try {
      if (selectedWalletId === null) {
        for (const wallet of wallets) {
          await syncSingleWallet(wallet);
        }
        toast.success("All wallets sync complete.");
      } else {
        const activeWallet = wallets.find((wallet) => wallet.id === selectedWalletId);
        if (!activeWallet) {
          throw new Error("Selected wallet not found.");
        }
        await syncSingleWallet(activeWallet);
        toast.success("Active wallet sync complete.");
      }

      await fetchWallets();
      await refreshWallets();
    } catch (error: any) {
      toast.error(error?.message || "Sync failed");
    } finally {
      setIsSyncingNow(false);
      if (syncStatusStorageKey && typeof window !== "undefined") {
        const payload = {
          syncing: false,
          scope: `manual:${selectedWalletId ?? "all"}`,
          updatedAt: new Date().toISOString(),
        };
        localStorage.setItem(syncStatusStorageKey, JSON.stringify(payload));
        window.dispatchEvent(new CustomEvent("tradelog:sync-status", { detail: payload }));
      }
    }
  };

  const escapeCsvCell = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    const text = typeof value === "string" ? value : JSON.stringify(value);
    return `"${text.replace(/"/g, '""')}"`;
  };

  const handleExportJournalCsv = async () => {
    if (!dbUserId) {
      toast.error("User not ready yet.");
      return;
    }

    setIsExportingCsv(true);
    try {
      let url = `/api/journal/entries?userId=${dbUserId}`;
      if (selectedWalletId !== null) {
        url += `&walletId=${selectedWalletId}`;
      }

      const response = await fetch(url);
      const data = await response.json().catch(() => []);
      if (!response.ok) {
        throw new Error(data?.error || "Failed to export journal entries.");
      }

      const entries = Array.isArray(data) ? data : [];
      const headers = [
        "id",
        "user_id",
        "wallet_id",
        "tx_hash",
        "is_journaled",
        "is_flagged",
        "notes",
        "tags",
        "what_went_well",
        "what_went_wrong",
        "what_will_i_do_differently",
        "created_at",
        "updated_at",
      ];

      const rows = [
        headers.map((header) => escapeCsvCell(header)).join(","),
        ...entries.map((entry: Record<string, unknown>) =>
          headers.map((header) => escapeCsvCell(entry?.[header])).join(",")
        ),
      ];

      const csvBlob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
      const walletSuffix = selectedWalletId === null ? "all-wallets" : `wallet-${selectedWalletId}`;
      const filename = `journal-entries-${walletSuffix}-${new Date().toISOString().slice(0, 10)}.csv`;

      const link = document.createElement("a");
      const objectUrl = URL.createObjectURL(csvBlob);
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);

      toast.success(`Exported ${entries.length} journal entr${entries.length === 1 ? "y" : "ies"}.`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to export CSV");
    } finally {
      setIsExportingCsv(false);
    }
  };

  const handleClearLocalCache = () => {
    if (typeof window === "undefined") return;
    try {
      clearCache();
      Object.keys(localStorage)
        .filter(
          (key) =>
            key.startsWith("tradelog:cache:") ||
            (key.startsWith("tradelog:") && key.toLowerCase().includes("cache"))
        )
        .forEach((key) => localStorage.removeItem(key));
      toast.success("Local cache cleared.");
    } catch {
      toast.error("Failed to clear local cache.");
    } finally {
      setIsClearCacheModalOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure wallet preferences, sync behavior, and account data controls.
        </p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-white">Wallets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-end mb-3">
            <Button
              size="sm"
              onClick={() => setIsLinkWalletModalOpen(true)}
              disabled={
                connectedWalletAlreadyAdded
              }
              title={
                connectedWalletAlreadyAdded
                  ? "Already added"
                  : undefined
              }
            >
              {connectedWalletAlreadyAdded ? "Already added" : "Add wallet"}
            </Button>
          </div>
          {isLoadingWallets ? (
            <p className="text-sm text-muted-foreground">Loading wallets...</p>
          ) : wallets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No wallets found.</p>
          ) : (
            <div className="rounded-md border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nickname</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wallets.map((wallet) => {
                    const isDefault = selectedWalletId === wallet.id;
                    const removeBlockedReason = getRemoveBlockedReason(wallet);
                    const removeDisabled = !!removeBlockedReason;
                    return (
                      <TableRow key={wallet.id}>
                        <TableCell className="font-medium text-white">{displayWalletName(wallet)}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {wallet.wallet_address}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            size="sm"
                            variant={isDefault ? "secondary" : "outline"}
                            onClick={() => handleSetDefault(wallet.id)}
                          >
                            {isDefault ? "Default" : "Set Default"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openRenameModal(wallet)}>
                            Rename
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            aria-disabled={removeDisabled}
                            className={removeDisabled ? "opacity-50 cursor-not-allowed" : ""}
                            title={removeBlockedReason || undefined}
                            onClick={() => {
                              if (removeBlockedReason) {
                                toast.error(removeBlockedReason);
                                return;
                              }
                              openRemoveModal(wallet);
                            }}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-white">Sync &amp; Performance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <p className="text-sm font-medium text-white">Auto-sync on login</p>
              <p className="text-xs text-muted-foreground">
                Automatically start sync jobs when you log in.
              </p>
            </div>
            <Switch
              checked={settings.autoSyncOnLogin}
              onCheckedChange={(checked) => updateSetting("autoSyncOnLogin", checked)}
              aria-label="Toggle auto-sync on login"
            />
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <p className="text-sm font-medium text-white">Preload data in background</p>
              <p className="text-xs text-muted-foreground">
                Prefetch dashboard, journal, and trades data silently.
              </p>
            </div>
            <Switch
              checked={settings.preloadDataInBackground}
              onCheckedChange={(checked) => updateSetting("preloadDataInBackground", checked)}
              aria-label="Toggle preload data in background"
            />
          </div>

          <div className="rounded-md border border-border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">Manual sync</p>
                <p className="text-xs text-muted-foreground">
                  Sync the active wallet, or all wallets sequentially when "All wallets" is selected.
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleSyncNow}
                disabled={isSyncingNow || isAutoSyncing || wallets.length === 0}
              >
                {isSyncingNow ? "Syncing..." : "Sync now"}
              </Button>
            </div>
            {(isSyncingNow || isAutoSyncing) && (
              <p className="text-xs text-muted-foreground">Syncing in progress...</p>
            )}

            <div className="space-y-1">
              {wallets.length === 0 ? (
                <p className="text-xs text-muted-foreground">No wallets found.</p>
              ) : (
                wallets.map((wallet) => (
                  <div key={wallet.id} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{displayWalletName(wallet)}</span>
                    <span className="text-muted-foreground">
                      Last synced: {formatLastSynced(getWalletLastSynced(wallet))}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-white">Account / Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-border p-3 space-y-3">
            <div>
              <p className="text-sm font-medium text-white">Export Journal Entries (CSV)</p>
              <p className="text-xs text-muted-foreground">
                Export entries for <span className="text-white">{activeWalletDisplay}</span>.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportJournalCsv}
              disabled={isExportingCsv || !dbUserId}
            >
              {isExportingCsv ? "Exporting..." : "Export CSV"}
            </Button>
          </div>

          <div className="rounded-md border border-border p-3 space-y-3">
            <div>
              <p className="text-sm font-medium text-white">Clear Local Cache</p>
              <p className="text-xs text-muted-foreground">
                Removes cached `tradelog:*` cache keys only. Your login session remains active.
              </p>
            </div>
            <Button size="sm" variant="destructive" onClick={() => setIsClearCacheModalOpen(true)}>
              Clear Cache
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editingWallet} onOpenChange={(open) => !open && setEditingWallet(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Rename Wallet</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="wallet-nickname">Nickname</Label>
            <Input
              id="wallet-nickname"
              value={nicknameDraft}
              onChange={(e) => setNicknameDraft(e.target.value)}
              placeholder="Wallet nickname"
              maxLength={50}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingWallet(null)} disabled={isSavingNickname}>
              Cancel
            </Button>
            <Button onClick={handleSaveNickname} disabled={isSavingNickname}>
              {isSavingNickname ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!removingWallet}
        onOpenChange={(open) => {
          if (!open) {
            setRemovingWallet(null);
            setRemoveConfirmText("");
          }
        }}
      >
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Remove Wallet</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This action removes wallet <span className="text-white">{removingWallet ? displayWalletName(removingWallet) : ""}</span>.
            </p>
            <p className="text-sm text-muted-foreground">Type <span className="font-semibold text-white">REMOVE</span> to confirm.</p>
            <Input
              value={removeConfirmText}
              onChange={(e) => setRemoveConfirmText(e.target.value)}
              placeholder="Type REMOVE"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRemovingWallet(null);
                setRemoveConfirmText("");
              }}
              disabled={isRemovingWallet}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemoveWallet}
              disabled={isRemovingWallet || removeConfirmText.trim() !== "REMOVE"}
            >
              {isRemovingWallet ? "Removing..." : "Remove Wallet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isClearCacheModalOpen} onOpenChange={setIsClearCacheModalOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Clear Local Cache</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This clears local cached API data and does not log you out.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsClearCacheModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleClearLocalCache}>
              Confirm Clear Cache
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LinkWalletModal
        open={isLinkWalletModalOpen}
        onOpenChange={setIsLinkWalletModalOpen}
        onLinked={handleWalletLinked}
      />
    </div>
  );
}
