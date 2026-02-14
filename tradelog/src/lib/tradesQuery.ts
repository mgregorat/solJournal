import { createApiClient } from "@/lib/apiClient";

export type TradeTypeFilter = "all" | "buy" | "sell";
export type JournaledFilter = "all" | "journaled" | "unjournaled";
export type TradeSortField = "trade_date" | "total_value_usd" | "realized_pnl_usd";
export type TradeSortDirection = "asc" | "desc";

export type TradeListItem = {
  id: number;
  wallet_id: number | null;
  wallet_address: string;
  token_symbol: string;
  token_address: string;
  trade_type: "buy" | "sell";
  amount: number;
  price: number;
  total_value: number;
  total_value_usd: number;
  trade_date: string;
  source: string;
  transaction_hash: string;
  realized_pnl_usd: number | null;
  is_journaled: boolean;
};

export type TradesPageData = {
  items: TradeListItem[];
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
  sort: TradeSortField;
  dir: TradeSortDirection;
};

export type TradesQueryParams = {
  walletId?: number | null;
  walletAddress?: string | null;
  q?: string;
  type?: TradeTypeFilter;
  journaled?: JournaledFilter;
  dateFrom?: string;
  dateTo?: string;
  sort?: TradeSortField;
  dir?: TradeSortDirection;
  limit?: number;
  cursor?: string | null;
};

export const DEFAULT_TRADES_QUERY: Required<
  Pick<TradesQueryParams, "type" | "journaled" | "sort" | "dir" | "limit">
> = {
  type: "all",
  journaled: "all",
  sort: "trade_date",
  dir: "desc",
  limit: 50,
};

export function buildTradesQueryString(params: TradesQueryParams): string {
  const merged: TradesQueryParams = {
    ...DEFAULT_TRADES_QUERY,
    ...params,
  };
  const qs = new URLSearchParams();

  if (merged.walletId !== undefined && merged.walletId !== null) {
    qs.set("walletId", String(merged.walletId));
  } else if (merged.walletAddress) {
    qs.set("walletAddress", merged.walletAddress);
  }

  if (merged.q && merged.q.trim().length > 0) qs.set("q", merged.q.trim());
  if (merged.type && merged.type !== "all") qs.set("type", merged.type);
  if (merged.journaled && merged.journaled !== "all") qs.set("journaled", merged.journaled);
  if (merged.dateFrom) qs.set("dateFrom", merged.dateFrom);
  if (merged.dateTo) qs.set("dateTo", merged.dateTo);
  if (merged.sort) qs.set("sort", merged.sort);
  if (merged.dir) qs.set("dir", merged.dir);
  if (merged.limit) qs.set("limit", String(merged.limit));
  if (merged.cursor) qs.set("cursor", merged.cursor);

  return qs.toString();
}

export async function fetchTradesPage(
  getAccessToken: (() => Promise<string | null | undefined>) | undefined,
  params: TradesQueryParams,
  init?: RequestInit
): Promise<TradesPageData> {
  const api = createApiClient({ getAccessToken });
  const qs = buildTradesQueryString(params);
  return api.get<TradesPageData>(`/api/trades${qs ? `?${qs}` : ""}`, init);
}
