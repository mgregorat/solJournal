"use client";

import { useWalletFilter } from "@/app/contexts/WalletFilterContext";
import { useWallet } from "@solana/wallet-adapter-react";
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
import { Check, ChevronsUpDown } from "lucide-react";
import toast from 'react-hot-toast';

interface WalletSelectorProps {
  dbUser: User | null;
}

export const WalletSelector = ({ dbUser }: WalletSelectorProps) => {
  const { wallets, selectedWalletId, selectedWallet, setSelectedWalletId, refreshWallets, loading } = useWalletFilter();
  const { publicKey, connected } = useWallet();

  const handleAddCurrentWallet = async () => {
    if (!publicKey || !dbUser) {
      toast.error("Please connect your wallet first.");
      return;
    }

    const walletAddress = publicKey.toBase58();

    try {
      const response = await fetch('/api/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: dbUser.id, walletAddress }),
      });

      if (!response.ok) {
        throw new Error("Failed to add wallet");
      }
      
      const newWallet = await response.json();
      
      toast.success("Wallet added successfully!");
      
      await refreshWallets();

      // Auto-select the newly added wallet
      if (newWallet && newWallet.id) {
        setSelectedWalletId(newWallet.id);
      }

    } catch (error) {
      console.error("Error adding wallet:", error);
      toast.error("An error occurred while adding the wallet.");
    }
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
      const response = await fetch('/api/wallets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: dbUser.id, walletId: selectedWalletId, label: nextLabel }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to rename wallet");
      }

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
          <DropdownMenuItem onSelect={handleAddCurrentWallet} disabled={!connected}>
            Add Current Wallet
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Badge variant="secondary" className="max-w-56 truncate">
        Active: {activeWalletText}
      </Badge>
    </div>
  );
};
