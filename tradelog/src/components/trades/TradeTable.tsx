"use client";

import { CSSProperties, memo, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { TradeListItem } from "@/lib/tradesQuery";

const ROW_HEIGHT = 56;
const VIEWPORT_HEIGHT = 520;
const OVERSCAN = 8;

type TradeTableProps = {
  rows: TradeListItem[];
  showWalletColumn: boolean;
  walletLabelById: Map<number, string>;
  onRowClick: (trade: TradeListItem) => void;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
};

type TradeRowProps = {
  trade: TradeListItem;
  showWalletColumn: boolean;
  walletLabelById: Map<number, string>;
  onRowClick: (trade: TradeListItem) => void;
  style: CSSProperties;
};

const TradeRow = memo(function TradeRow({
  trade,
  showWalletColumn,
  walletLabelById,
  onRowClick,
  style,
}: TradeRowProps) {
  const walletLabel =
    trade.wallet_id && walletLabelById.get(trade.wallet_id)
      ? walletLabelById.get(trade.wallet_id)
      : trade.wallet_address;

  return (
    <button
      type="button"
      style={style}
      className="absolute left-0 right-0 grid grid-cols-12 items-center border-b border-border px-3 text-left text-sm hover:bg-accent/40"
      onClick={() => onRowClick(trade)}
    >
      <span className="col-span-2 truncate">{new Date(trade.trade_date).toLocaleString()}</span>
      <span className={`col-span-1 capitalize ${trade.trade_type === "buy" ? "text-green-400" : "text-red-400"}`}>
        {trade.trade_type}
      </span>
      {showWalletColumn && <span className="col-span-3 truncate">{walletLabel}</span>}
      <span className={`${showWalletColumn ? "col-span-2" : "col-span-3"} truncate`}>{trade.token_symbol}</span>
      <span className="col-span-1 text-right">{trade.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
      <span className="col-span-1 text-right">${trade.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
      <span className="col-span-2 text-right">
        ${trade.total_value_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </button>
  );
});

export function TradeTable({
  rows,
  showWalletColumn,
  walletLabelById,
  onRowClick,
  isLoading,
  isError,
  errorMessage,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: TradeTableProps) {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleRange = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const end = Math.min(rows.length, Math.ceil((scrollTop + VIEWPORT_HEIGHT) / ROW_HEIGHT) + OVERSCAN);
    return { start, end };
  }, [rows.length, scrollTop]);

  const visibleRows = rows.slice(visibleRange.start, visibleRange.end);
  const totalHeight = rows.length * ROW_HEIGHT;

  if (isLoading && rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Loading trades...</p>;
  }
  if (isError) {
    return <p className="text-sm text-red-400">{errorMessage || "Failed to load trades"}</p>;
  }
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No trades found for the selected filters.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-12 border-b border-border px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">
        <span className="col-span-2">Date</span>
        <span className="col-span-1">Type</span>
        {showWalletColumn && <span className="col-span-3">Wallet</span>}
        <span className={`${showWalletColumn ? "col-span-2" : "col-span-3"}`}>Token</span>
        <span className="col-span-1 text-right">Amount</span>
        <span className="col-span-1 text-right">Price</span>
        <span className="col-span-2 text-right">Total</span>
      </div>

      <div
        className="relative overflow-auto rounded-md border border-border"
        style={{ height: VIEWPORT_HEIGHT }}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        <div style={{ height: totalHeight, position: "relative" }}>
          {visibleRows.map((trade, index) => {
            const absoluteIndex = visibleRange.start + index;
            return (
              <TradeRow
                key={trade.id}
                trade={trade}
                showWalletColumn={showWalletColumn}
                walletLabelById={walletLabelById}
                onRowClick={onRowClick}
                style={{
                  top: absoluteIndex * ROW_HEIGHT,
                  height: ROW_HEIGHT,
                }}
              />
            );
          })}
        </div>
      </div>

      {hasMore && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={onLoadMore} disabled={isLoadingMore}>
            {isLoadingMore ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
