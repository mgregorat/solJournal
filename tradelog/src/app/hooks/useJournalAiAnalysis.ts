"use client";

import { useCallback, useState } from "react";
import { authedFetchClient } from "@/lib/authedFetch";
import { JournalEvent } from "@/lib/types";
import { TradeMetrics, computeTradeMetrics } from "@/app/lib/tradeMetrics";

type AnalysisSuccess = {
  text: string;
  model: string;
};

type AnalysisError = {
  error: string;
};

type JournalAnalysisTrade = {
  token_symbol: string;
  realized_pnl_usd: number;
  realized_pnl_percent?: number;
  hold_time_minutes?: number;
  tags?: string[];
  notes?: string;
  what_went_well?: string;
  what_went_wrong?: string;
  what_will_i_do_differently?: string;
  date: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseSuccess(body: unknown): AnalysisSuccess | null {
  if (!isRecord(body)) return null;
  if (typeof body.text !== "string") return null;
  if (typeof body.model !== "string") return null;
  return { text: body.text, model: body.model };
}

function parseError(body: unknown): AnalysisError | null {
  if (!isRecord(body)) return null;
  if (typeof body.error !== "string") return null;
  return { error: body.error };
}

function toIsoString(value: string | undefined): string | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

function normalizeText(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function mapTradeForAnalysis(trade: JournalEvent): JournalAnalysisTrade | null {
  if (trade.status !== "CLOSED") return null;
  if (!trade.is_journaled) return null;
  if (typeof trade.realized_pnl_usd !== "number") return null;

  const closedAt = toIsoString(trade.date);
  if (!closedAt) return null;

  const openedAt = toIsoString(trade.journal_updated_at || trade.date);
  const holdTimeMinutes =
    openedAt && closedAt
      ? Math.max(0, Math.round((new Date(closedAt).getTime() - new Date(openedAt).getTime()) / 60000))
      : undefined;

  return {
    token_symbol: trade.token_symbol,
    realized_pnl_usd: trade.realized_pnl_usd,
    realized_pnl_percent:
      typeof trade.realized_pnl_percent === "number" ? trade.realized_pnl_percent : undefined,
    hold_time_minutes: holdTimeMinutes,
    tags: Array.isArray(trade.tags) ? trade.tags : undefined,
    notes: normalizeText(trade.notes),
    what_went_well: normalizeText(trade.what_went_well),
    what_went_wrong: normalizeText(trade.what_went_wrong),
    what_will_i_do_differently: normalizeText(trade.what_will_i_do_differently),
    date: closedAt,
  };
}

function computeMetricsFromTrades(journaledTrades: JournalEvent[]): TradeMetrics {
  const metricsInput = journaledTrades
    .map((trade) => {
      if (trade.status !== "CLOSED") return null;
      if (typeof trade.realized_pnl_usd !== "number") return null;

      const closedAt = toIsoString(trade.date);
      const openedAt = toIsoString(trade.journal_updated_at || trade.date);
      if (!closedAt || !openedAt) return null;

      return {
        pnl_usd: trade.realized_pnl_usd,
        opened_at: new Date(openedAt),
        closed_at: new Date(closedAt),
      };
    })
    .filter((trade): trade is { pnl_usd: number; opened_at: Date; closed_at: Date } => trade !== null);

  return computeTradeMetrics(metricsInput);
}

export function useJournalAiAnalysis(getBearerToken: () => Promise<string | null>) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<TradeMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = useCallback(
    async (journaledTrades: JournalEvent[], walletId?: number | null): Promise<boolean> => {
      const normalizedTrades = journaledTrades
        .map(mapTradeForAnalysis)
        .filter((trade): trade is JournalAnalysisTrade => trade !== null)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      if (normalizedTrades.length < 5) {
        setError("Minimum 5 journaled trades required");
        return false;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await authedFetchClient(getBearerToken, "/api/journal/ai-analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trades: normalizedTrades, walletId: walletId ?? null }),
        });

        const body = (await response.json().catch(() => null)) as unknown;
        if (!response.ok) {
          const parsedError = parseError(body);
          setError(parsedError?.error || "AI analysis unavailable");
          return false;
        }

        const parsed = parseSuccess(body);
        if (!parsed) {
          setError("AI analysis unavailable");
          return false;
        }

        setAnalysis(parsed.text);
        setMetrics(computeMetricsFromTrades(journaledTrades));
        return true;
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

