"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Button } from "./ui/button";
import { CheckCircle, Loader2, LogOut, Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export function WalletConnectButton() {
  const { publicKey, connected, connecting, wallet, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [isStuckConnecting, setIsStuckConnecting] = useState(false);

  const handleConnectClick = useCallback(() => {
    setVisible(true);
  }, [setVisible]);

  const handleDisconnectClick = useCallback(() => {
    disconnect();
  }, [disconnect]);

  const handleRetryClick = useCallback(async () => {
    try {
      await disconnect();
    } catch {
      // ignore disconnect errors during retry
    } finally {
      setIsStuckConnecting(false);
      setVisible(true);
    }
  }, [disconnect, setVisible]);

  useEffect(() => {
    if (!connecting) {
      setIsStuckConnecting(false);
      return;
    }
    const timeout = setTimeout(() => {
      setIsStuckConnecting(true);
    }, 8000);
    return () => clearTimeout(timeout);
  }, [connecting]);

  const base58 = publicKey?.toBase58();
  const shortAddress = base58
    ? `${base58.slice(0, 4)}...${base58.slice(-4)}`
    : "";

  if (connecting) {
    if (isStuckConnecting) {
      return (
        <Button onClick={handleRetryClick} className="w-full">
          <Wallet className="mr-2 h-4 w-4" />
          Retry Connection
        </Button>
      );
    }
    return (
      <Button disabled className="w-full flex justify-center items-center">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Connecting...
      </Button>
    );
  }

  if (connected && base58) {
    return (
      <div className="flex flex-col items-center space-y-2">
        <div className="flex items-center text-sm text-green-400">
            <CheckCircle className="h-4 w-4 mr-2" />
            <span>Connected: {shortAddress}</span>
        </div>
        <Button onClick={handleDisconnectClick} variant="outline" size="sm" className="w-full">
            <LogOut className="mr-2 h-4 w-4" />
            Disconnect
        </Button>
      </div>
    );
  }

  return (
    <Button onClick={handleConnectClick} className="w-full">
      <Wallet className="mr-2 h-4 w-4" />
      Connect Wallet
    </Button>
  );
} 
