"use client";

import { useWalletFilter } from "@/app/contexts/WalletFilterContext";
import { useWallet } from "@solana/wallet-adapter-react";
import { User } from "@/lib/types";
import { shortenAddress } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronsUpDown } from "lucide-react";
import toast from 'react-hot-toast';

interface WalletSelectorProps {
  dbUser: User | null;
}

export const WalletSelector = ({ dbUser }: WalletSelectorProps) => {
  const { wallets, selectedWalletId, setSelectedWalletId, refreshWallets, loading } = useWalletFilter();
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

  const selectedWallet = selectedWalletId === null
    ? { label: "All Wallets" }
    : wallets.find(w => w.id === selectedWalletId);

  const getWalletLabel = (wallet: any) => {
    return `${wallet.label || 'Wallet'} (${shortenAddress(wallet.wallet_address)})`;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-48 justify-between">
          {loading ? "Loading..." : (selectedWallet ? (selectedWallet.label === 'All Wallets' ? 'All Wallets' : getWalletLabel(selectedWallet)) : "Select a wallet")}
          <ChevronsUpDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48">
        <DropdownMenuItem onSelect={() => setSelectedWalletId(null)}>
          All Wallets
        </DropdownMenuItem>
        {wallets.map((wallet) => (
          <DropdownMenuItem key={wallet.id} onSelect={() => setSelectedWalletId(wallet.id)}>
            {getWalletLabel(wallet)}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleAddCurrentWallet} disabled={!connected}>
          Add Current Wallet
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
