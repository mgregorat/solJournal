"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAddCurrentWallet } from "@/lib/hooks/useAddCurrentWallet";

type FirstWalletEmptyStateProps = {
  title?: string;
  body?: string;
  className?: string;
};

export function FirstWalletEmptyState({
  title = "Add your first wallet",
  body = "Connect Phantom to add your current wallet and start tracking trades.",
  className = "",
}: FirstWalletEmptyStateProps) {
  const [importAddress, setImportAddress] = useState("");
  const {
    handleAddCurrentWallet,
    handleImportWalletAddress,
    isAddingWallet,
    isImportingWallet,
  } = useAddCurrentWallet();

  const onImport = async () => {
    const result = await handleImportWalletAddress(importAddress);
    if (result?.id) {
      setImportAddress("");
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">{body}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={handleAddCurrentWallet} disabled={isAddingWallet}>
            {isAddingWallet ? "Connecting..." : "Add Current Wallet"}
          </Button>
          <div className="flex w-full gap-2">
            <Input
              value={importAddress}
              onChange={(event) => setImportAddress(event.target.value)}
              placeholder="Paste wallet address"
              aria-label="Wallet address"
            />
            <Button
              variant="outline"
              onClick={onImport}
              disabled={isImportingWallet || importAddress.trim().length === 0}
            >
              {isImportingWallet ? "Importing..." : "Import wallet address"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

