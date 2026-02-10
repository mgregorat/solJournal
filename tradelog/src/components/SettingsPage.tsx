"use client";

import { useEffect, useMemo, useState } from "react";
import { useWalletFilter } from "@/app/contexts/WalletFilterContext";
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
import toast from "react-hot-toast";

export function SettingsPage() {
  const { dbUserId, selectedWalletId, setSelectedWalletId, refreshWallets } = useWalletFilter();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isLoadingWallets, setIsLoadingWallets] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [isSavingNickname, setIsSavingNickname] = useState(false);
  const [removingWallet, setRemovingWallet] = useState<Wallet | null>(null);
  const [removeConfirmText, setRemoveConfirmText] = useState("");
  const [isRemovingWallet, setIsRemovingWallet] = useState(false);
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [lastSyncedByWalletId, setLastSyncedByWalletId] = useState<Record<number, string>>({});
  const { settings, updateSetting } = useAppSettings(dbUserId);

  const selectedWalletStorageKey = useMemo(
    () => (dbUserId ? `tradelog:selectedWalletId:${dbUserId}` : "tradelog:selectedWallet"),
    [dbUserId]
  );

  const getNicknameStorageKey = (walletId: number) => `tradelog:walletNickname:${walletId}`;
  const getLastSyncedStorageKey = (walletId: number) => `tradelog:lastSyncedAt:${walletId}`;

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

  const openRemoveModal = (wallet: Wallet) => {
    if (selectedWalletId === wallet.id) {
      toast.error("Cannot remove the currently selected wallet.");
      return;
    }
    if (wallets.length <= 1) {
      toast.error("Cannot remove the last wallet.");
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
                          <Button size="sm" variant="destructive" onClick={() => openRemoveModal(wallet)}>
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
              <Button size="sm" onClick={handleSyncNow} disabled={isSyncingNow || wallets.length === 0}>
                {isSyncingNow ? "Syncing..." : "Sync now"}
              </Button>
            </div>

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
        <CardContent className="text-sm text-muted-foreground">
          Account-level preferences and data tools will appear here.
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
    </div>
  );
}
