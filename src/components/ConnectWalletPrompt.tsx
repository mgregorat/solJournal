"use client";

import { usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CandlestickChart } from "lucide-react";

export default function ConnectWalletPrompt() {
  const { login } = usePrivy();

  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="items-center">
          <CandlestickChart size={48} className="text-green-400 mb-4" />
          <CardTitle>Welcome to Tradelog</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">Please connect your wallet to view your dashboard.</p>
          <div className="flex justify-center">
            <Button onClick={login}>Login</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 