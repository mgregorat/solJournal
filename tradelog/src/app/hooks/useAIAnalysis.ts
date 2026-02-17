"use client";

import { useCallback, useState } from "react";
import { authedFetchClient } from "@/lib/authedFetch";
import { JournalEvent } from "@/lib/types";
import { TradeMetrics } from "@/app/lib/tradeMetrics";

type AnalysisResponse = {
  analysis: string;
  metrics: TradeMetrics;
};

type ContractSuccess<T> = {
  ok: true;
  data: T;
  meta?: {
    requestId?: string;
    route?: string;
    method?: string;
    durationMs?: number;
  };
};

type ContractError = {
  ok: false;
  error?: {
    code?: string;
    message?: string;
  };
  meta?: {
    requestId?: string;
    route?: string;
    method?: string;
    durationMs?: number;
  };
};

type AnalyzePayloadTrade = {
  pnl_usd: number;
  opened_at: string;
  closed_at: string;
};

function toIsoString(value: string | undefined): string | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function mapTradeForAnalysis(trade: JournalEvent): AnalyzePayloadTrade | null {
  if (trade.status !== "CLOSED") return null;
  if (!trade.is_journaled) return null;
  if (typeof trade.realized_pnl_usd !== "number") return null;

  const closedAt = toIsoString(trade.date);
  const openedAt = toIsoString(trade.journal_updated_at || trade.date);

  if (!closedAt || !openedAt) return null;

  return {
    pnl_usd: trade.realized_pnl_usd,
    opened_at: openedAt,
    closed_at: closedAt,
  };
}

export function useAIAnalysis(
  getBearerToken: () => Promise<string | null>
) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<TradeMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = useCallback(
    async (journaledTrades: JournalEvent[]): Promise<boolean> => {
      const payloadTrades = journaledTrades
        .map(mapTradeForAnalysis)
        .filter((trade): trade is AnalyzePayloadTrade => trade !== null);

      if (payloadTrades.length < 5) {
        setError("Minimum 5 journaled trades required");
        return false;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await authedFetchClient(getBearerToken, "/api/ai/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ journaledTrades: payloadTrades }),
        });

        const body = (await response.json().catch(() => null)) as
          | ContractSuccess<AnalysisResponse>
          | ContractError
          | null;

        if (body && typeof body === "object" && "ok" in body) {
          if (body.ok) {
            setAnalysis(body.data.analysis || null);
            setMetrics(body.data.metrics || null);
            return true;
          }

          const code = body.error?.code || "unknown_error";
          if (code === "unauthorized") {
            setError("Please sign in");
          } else if (code === "rate_limited") {
            setError("Rate limited, try again later");
          } else if (code === "provider_timeout") {
            setError("AI timed out, try again");
          } else if (code === "provider_unavailable") {
            setError("AI unavailable");
          } else if (code === "bad_request") {
            setError("Not enough data / invalid trades payload");
          } else {
            setError(body.error?.message || "AI analysis unavailable");
          }
          return false;
        }

        if (!response.ok) {
          setError("AI unavailable");
          return false;
        }

        setError("AI unavailable");
        return false;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "AI analysis unavailable");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [getBearerToken]
  );

  return {
    loading,
    analysis,
    metrics,
    error,
    runAnalysis,
  };
}
