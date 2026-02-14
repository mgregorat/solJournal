"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useWalletFilter } from "@/app/contexts/WalletFilterContext";
import { User } from "@/lib/types";
import { shortenAddress } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, ChevronsUpDown } from "lucide-react";
import toast from 'react-hot-toast';
import { authedFetchClient, parseApiResponse } from "@/lib/authedFetch";
import { AddWalletResult, useAddCurrentWallet } from "@/lib/hooks/useAddCurrentWallet";

interface WalletSelectorProps {
  dbUser: User | null;
}

export const WalletSelector = ({ dbUser }: WalletSelectorProps) => {
  const { getAccessToken } = usePrivy();
  const router = useRouter();
  const getBearerToken = async () => (await getAccessToken?.()) || null;
  const { wallets, selectedWalletId, selectedWallet, setSelectedWalletId, refreshWallets, loading } = useWalletFilter();
  const { handleAddCurrentWallet, isAddingWallet } = useAddCurrentWallet();
  const [addWalletResult, setAddWalletResult] = useState<AddWalletResult | null>(null);

  const handleManageWallets = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("tradelog:dashboardActiveItem", "Settings");
      window.dispatchEvent(new CustomEvent("tradelog:open-manage-wallets"));
    }
    router.push("/dashboard");
  };

  const routeToTrades = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("tradelog:dashboardActiveItem", "Trades");
    }
    router.push("/dashboard");
  };

  const runAddCurrentWallet = async () => {
    const result = await handleAddCurrentWallet();
    if (result.type === "cancelled") {
      toast("Connection cancelled");
      return;
    }
    setAddWalletResult(result);
  };

  const handleRenameSelectedWallet = async () => {
    if (!dbUser || selectedWalletId === null) {
      toast.error("Select a wallet first.");
      return;
    }
    const currentLabel = selectedWallet?.label || "";
    const nextLabel = window.prompt("Wallet label", currentLabel);
    if (nextLabel === null) {
      return;
    }

    try {
      const response = await authedFetchClient(getBearerToken, '/api/wallets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletId: selectedWalletId, label: nextLabel }),
      });
      await parseApiResponse<{ label?: string | null }>(response);

      toast.success("Wallet label updated.");
      await refreshWallets();
    } catch (error: any) {
      console.error("Error renaming wallet:", error);
      toast.error(error.message || "Failed to rename wallet.");
    }
  };

  const getWalletLabel = (wallet: any, index: number) => `${wallet.label || `Wallet ${index + 1}`} (${shortenAddress(wallet.wallet_address)})`;
  const activeWalletText = selectedWalletId === null
    ? "All wallets"
    : (() => {
        const idx = wallets.findIndex(w => w.id === selectedWalletId);
        return selectedWallet ? getWalletLabel(selectedWallet, idx >= 0 ? idx : 0) : "Wallet";
      })();

  return (
    <div className="flex flex-col items-end gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-56 justify-between">
            {loading ? "Loading..." : activeWalletText}
            <ChevronsUpDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuItem onSelect={() => setSelectedWalletId(null)} className="flex items-center justify-between">
            <span>All wallets</span>
            {selectedWalletId === null && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
          {wallets.map((wallet, index) => (
            <DropdownMenuItem
              key={wallet.id}
              onSelect={() => setSelectedWalletId(wallet.id)}
              className="flex items-center justify-between"
            >
              <span>{getWalletLabel(wallet, index)}</span>
              {selectedWalletId === wallet.id && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleRenameSelectedWallet} disabled={selectedWalletId === null || !dbUser}>
            Rename Selected Wallet
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              void runAddCurrentWallet();
            }}
            disabled={!dbUser || isAddingWallet}
          >
            {isAddingWallet ? "Connecting..." : "Add Current Wallet"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleManageWallets} disabled={!dbUser}>
            Manage Wallets
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Badge variant="secondary" className="max-w-56 truncate">
        Active: {activeWalletText}
      </Badge>

      <Dialog
        open={addWalletResult !== null}
        onOpenChange={(open) => {
          if (!open) setAddWalletResult(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {addWalletResult?.type === "success" && "Wallet added"}
              {addWalletResult?.type === "already_added" && "Wallet already added"}
              {addWalletResult?.type === "linked_elsewhere" && "Wallet already linked"}
              {addWalletResult?.type === "limit_reached" && "Wallet limit reached"}
              {addWalletResult?.type === "signature_rejected" && "Signature required"}
              {addWalletResult?.type === "error" &&
                (addWalletResult.code === "bad_request" || addWalletResult.code === "wallet_validation_failed"
                  ? "Couldn't add wallet"
                  : "Something went wrong")}
            </DialogTitle>
            <DialogDescription>
              {addWalletResult?.type === "success" &&
                `${shortenAddress(addWalletResult.wallet.wallet_address)} is now connected.`}
              {addWalletResult?.type === "already_added" &&
                `${shortenAddress(addWalletResult.wallet.wallet_address)} is already in your wallets.`}
              {addWalletResult?.type === "linked_elsewhere" &&
                "This wallet is already linked to another account."}
              {addWalletResult?.type === "limit_reached" &&
                `You've reached your wallet limit (${addWalletResult.limit ?? 3}). Upgrade to add more wallets.`}
              {addWalletResult?.type === "signature_rejected" &&
                "We need a signature to prove you own this wallet. Please try again."}
              {addWalletResult?.type === "error" &&
                (addWalletResult.code === "bad_request" || addWalletResult.code === "wallet_validation_failed"
                  ? "Please try again."
                  : "Please try again in a moment.")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-wrap gap-2 sm:justify-end">
            {addWalletResult?.type === "success" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setAddWalletResult(null);
                  }}
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setAddWalletResult(null);
                    routeToTrades();
                  }}
                >
                  View Trades
                </Button>
              </>
            )}

            {addWalletResult?.type === "already_added" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setAddWalletResult(null);
                    handleManageWallets();
                  }}
                >
                  Manage wallets
                </Button>
                <Button
                  onClick={() => {
                    setSelectedWalletId(addWalletResult.wallet.id);
                    setAddWalletResult(null);
                  }}
                >
                  Switch to this wallet
                </Button>
              </>
            )}

            {addWalletResult?.type === "linked_elsewhere" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setAddWalletResult(null);
                    window.open("mailto:support@tradelog.app", "_blank", "noopener,noreferrer");
                  }}
                >
                  Contact support
                </Button>
                <Button
                  onClick={() => {
                    setAddWalletResult(null);
                    void runAddCurrentWallet();
                  }}
                >
                  Use a different wallet
                </Button>
              </>
            )}

            {addWalletResult?.type === "limit_reached" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setAddWalletResult(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setAddWalletResult(null);
                    handleManageWallets();
                  }}
                >
                  Manage wallets
                </Button>
                <Button
                  onClick={() => {
                    setAddWalletResult(null);
                    router.push("/upgrade");
                  }}
                >
                  Upgrade
                </Button>
              </>
            )}

            {addWalletResult?.type === "signature_rejected" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setAddWalletResult(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    setAddWalletResult(null);
                    void runAddCurrentWallet();
                  }}
                >
                  Try again
                </Button>
              </>
            )}

            {addWalletResult?.type === "error" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setAddWalletResult(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    setAddWalletResult(null);
                    void runAddCurrentWallet();
                  }}
                >
                  Retry
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
