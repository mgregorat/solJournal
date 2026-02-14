"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import { TradeListItem } from "@/lib/tradesQuery";

type TradeDrawerProps = {
  open: boolean;
  trade: TradeListItem | null;
  onOpenChange: (open: boolean) => void;
  onToggleJournaled: (trade: TradeListItem) => Promise<void>;
  isUpdatingJournaled: boolean;
};

function formatCurrency(value: number | null): string {
  if (value === null) return "N/A";
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function TradeDrawer({
  open,
  trade,
  onOpenChange,
  onToggleJournaled,
  isUpdatingJournaled,
}: TradeDrawerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-auto right-0 top-0 h-screen max-w-md translate-x-0 translate-y-0 rounded-none border-l border-border bg-background p-6">
        {!trade ? null : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between gap-2">
                <span>{trade.token_symbol}</span>
                <Badge variant={trade.trade_type === "buy" ? "default" : "destructive"}>
                  {trade.trade_type.toUpperCase()}
                </Badge>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date</span>
                <span>{new Date(trade.trade_date).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Wallet</span>
                <span className="max-w-[220px] truncate">{trade.wallet_address}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span>{trade.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Price</span>
                <span>${trade.price.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Value</span>
                <span>{formatCurrency(trade.total_value_usd)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Realized PnL</span>
                <span>{formatCurrency(trade.realized_pnl_usd)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Journal Status</span>
                <Badge variant={trade.is_journaled ? "default" : "secondary"}>
                  {trade.is_journaled ? "Journaled" : "Not Journaled"}
                </Badge>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() =>
                  window.open(`https://solscan.io/tx/${trade.transaction_hash}`, "_blank", "noopener,noreferrer")
                }
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Solscan
              </Button>
              <Button
                className="flex-1"
                disabled={isUpdatingJournaled || !trade.wallet_id}
                onClick={() => onToggleJournaled(trade)}
              >
                {isUpdatingJournaled
                  ? "Updating..."
                  : trade.is_journaled
                    ? "Mark Unjournaled"
                    : "Mark Journaled"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

