"use client";

import { Loader2 } from "lucide-react";

export function LoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] bg-background text-foreground">
      <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
      <h2 className="text-2xl font-semibold mb-2">Loading Your Dashboard...</h2>
      <p className="text-muted-foreground">Fetching your trades, holdings, and latest market data.</p>
    </div>
  );
} 