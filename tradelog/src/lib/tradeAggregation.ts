import type { TradeListItem } from "@/lib/tradesQuery";

export type TradeRow = TradeListItem;

export type AggregatedTokenRow = {
  token_symbol: string;
  token_symbol_key: string;
  position_qty: number;
  avg_cost_usd_per_token: number;
  realized_pnl_usd: number;
  total_buy_usd: number;
  total_sell_usd: number;
  total_buy_qty: number;
  total_sell_qty: number;
  trade_count: number;
  buy_count: number;
  sell_count: number;
  last_trade_at: string;
  has_invalid_sell_sequence: boolean;
};

type MutableAggregate = AggregatedTokenRow;

function toSafeNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function aggregateTradesByToken(trades: TradeRow[]): AggregatedTokenRow[] {
  const grouped = new Map<string, TradeRow[]>();

  for (const trade of trades) {
    const symbol = (trade.token_symbol || "").trim();
    if (!symbol) continue;
    const key = symbol.toUpperCase();
    const existing = grouped.get(key);
    if (existing) {
      existing.push(trade);
    } else {
      grouped.set(key, [trade]);
    }
  }

  const aggregates: AggregatedTokenRow[] = [];

  for (const [symbolKey, tokenTrades] of grouped.entries()) {
    const sorted = [...tokenTrades].sort(
      (a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime()
    );

    const aggregate: MutableAggregate = {
      token_symbol: sorted[0]?.token_symbol ?? symbolKey,
      token_symbol_key: symbolKey,
      position_qty: 0,
      avg_cost_usd_per_token: 0,
      realized_pnl_usd: 0,
      total_buy_usd: 0,
      total_sell_usd: 0,
      total_buy_qty: 0,
      total_sell_qty: 0,
      trade_count: 0,
      buy_count: 0,
      sell_count: 0,
      last_trade_at: sorted[0]?.trade_date ?? new Date(0).toISOString(),
      has_invalid_sell_sequence: false,
    };

    for (const trade of sorted) {
      const qty = Math.max(0, toSafeNumber(trade.amount));
      const price = Math.max(0, toSafeNumber(trade.price));
      const fallbackTotal = qty * price;
      const totalUsd = Math.max(
        0,
        toSafeNumber(trade.total_value_usd) || toSafeNumber(trade.total_value) || fallbackTotal
      );
      const tradeType = trade.trade_type;

      aggregate.trade_count += 1;
      if (new Date(trade.trade_date).getTime() > new Date(aggregate.last_trade_at).getTime()) {
        aggregate.last_trade_at = trade.trade_date;
      }

      if (tradeType === "buy") {
        const currentCost = aggregate.position_qty * aggregate.avg_cost_usd_per_token;
        const addedCost = qty * price;
        const newQty = aggregate.position_qty + qty;
        const newCost = currentCost + addedCost;

        aggregate.position_qty = newQty;
        aggregate.avg_cost_usd_per_token = newQty > 0 ? newCost / newQty : 0;
        aggregate.total_buy_usd += totalUsd;
        aggregate.total_buy_qty += qty;
        aggregate.buy_count += 1;
        continue;
      }

      if (tradeType === "sell") {
        aggregate.sell_count += 1;
        aggregate.total_sell_usd += totalUsd;
        aggregate.total_sell_qty += qty;

        if (aggregate.position_qty <= 0 || aggregate.avg_cost_usd_per_token <= 0) {
          aggregate.has_invalid_sell_sequence = true;
          continue;
        }

        const matchedQty = Math.min(qty, aggregate.position_qty);
        const unmatchedQty = Math.max(0, qty - aggregate.position_qty);
        if (unmatchedQty > 0) {
          aggregate.has_invalid_sell_sequence = true;
        }

        aggregate.realized_pnl_usd +=
          matchedQty * (price - aggregate.avg_cost_usd_per_token);
        aggregate.position_qty = Math.max(0, aggregate.position_qty - qty);
        if (aggregate.position_qty === 0) {
          aggregate.avg_cost_usd_per_token = 0;
        }
      }
    }

    aggregates.push(aggregate);
  }

  return aggregates;
}
