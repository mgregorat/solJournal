"use client";

import { WalletConnectButton } from "./WalletConnectButton";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Wallet } from "lucide-react";

export function WalletConnection() {
  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="items-center">
          <Wallet size={48} className="text-green-400 mb-4" />
          <CardTitle>Connect Your Wallet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Please connect a Solana wallet to start tracking your trades.
          </p>
          <div className="flex justify-center">
            <WalletConnectButton />
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 