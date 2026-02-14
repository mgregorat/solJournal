"use client";

import { usePrivy } from "@privy-io/react-auth";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Wallet } from "lucide-react";
import { Button } from "./ui/button";

export function WalletConnection() {
  const { login } = usePrivy();

  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="items-center">
          <Wallet size={48} className="text-green-400 mb-4" />
          <CardTitle>Welcome to Tradelog</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Log in to access your dashboard and linked wallets.
          </p>
          <div className="flex justify-center">
            <Button onClick={login}>Login</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 
