"use client";

import { useCallback, useState } from "react";
import { authedFetchClient } from "@/lib/authedFetch";
import { JournalEvent } from "@/lib/types";
import { TradeMetrics, computeTradeMetrics } from "@/app/lib/tradeMetrics";
import type {
  DataQualitySummary,
  FeeSlippageSummary,
  StructuredAnalysis,
} from "@/lib/ai/structuredAnalysis";

type AnalysisSuccess = {
  text: string;
  model: string | null;
  structured?: unknown;
  data_quality?: unknown;
  fee_slippage_summary?: unknown;
};

type AnalysisError = {
  error: string;
};

type JournalAnalysisTrade = {
  is_journaled?: boolean;
  token_symbol: string;
  realized_pnl_usd: number;
  realized_pnl_percent?: number;
  hold_time_minutes?: number;
  tags?: string[];
  notes?: string;
  what_went_well?: string;
  what_went_wrong?: string;
  what_will_i_do_differently?: string;
  setup_tag?: string;
  entry_reason?: string;
  entry_delay_seconds?: number;
  position_size_usd?: number;
  position_size_sol?: number;
  wallet_equity_usd_at_entry?: number;
  risk_pct_of_wallet?: number;
  mae_percent?: number;
  mfe_percent?: number;
  time_of_day_bucket?: string;
  exit_plan?: string;
  did_follow_plan?: boolean;
  stop_type?: string;
  take_profit_rules?: string;
  fee_usd?: number;
  slippage_percent?: number;
  price_impact?: number;
  date: string;
};

export type AnalysisScope = "JOURNALED" | "ALL";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseSuccess(body: unknown): AnalysisSuccess | null {
  if (!isRecord(body)) return null;
  if (typeof body.text !== "string") return null;
  const model = typeof body.model === "string" ? body.model : null;
  return { text: body.text, model, structured: body.structured };
}

function parseError(body: unknown): AnalysisError | null {
  if (!isRecord(body)) return null;
  if (typeof body.error !== "string") return null;
  return { error: body.error };
}

function parseStructuredAnalysis(value: unknown): StructuredAnalysis | null {
  if (!isRecord(value)) return null;
  if (typeof value.title !== "string") return null;
  if (typeof value.one_line_summary !== "string") return null;
  if (!isRecord(value.key_leak)) return null;
  if (typeof value.key_leak.label !== "string") return null;
  if (!Array.isArray(value.key_leak.evidence) || !Array.isArray(value.key_leak.fix)) return null;
  if (!Array.isArray(value.goals_next_10)) return null;
  if (!Array.isArray(value.sections)) return null;

  const sections = value.sections
    .map((section): StructuredAnalysis["sections"][number] | null => {
      if (!isRecord(section)) return null;
      if (typeof section.id !== "string" || section.id.length === 0) return null;
      if (typeof section.label !== "string" || section.label.length === 0) return null;
      if (!Array.isArray(section.bullets)) return null;
      const bullets = section.bullets.filter((bullet): bullet is string => typeof bullet === "string");
      if (bullets.length === 0) return null;
      if (
        !["snapshot", "execution", "behavior", "quant", "simulation", "plan"].includes(section.id)
      ) {
        return null;
      }
      return {
        id: section.id as StructuredAnalysis["sections"][number]["id"],
        label: section.label,
        bullets,
      };
    })
    .filter((section): section is StructuredAnalysis["sections"][number] => section !== null);

  if (sections.length !== 6) return null;

  const evidence = value.key_leak.evidence.filter((item): item is string => typeof item === "string");
  const fix = value.key_leak.fix.filter((item): item is string => typeof item === "string");
  if (evidence.length === 0 || fix.length === 0) return null;

  const goalsNext10 = value.goals_next_10
    .map((goal): StructuredAnalysis["goals_next_10"][number] | null => {
      if (!isRecord(goal)) return null;
      if (typeof goal.metric !== "string") return null;
      if (!["win_rate", "avg_loss", "expectancy", "risk_reward", "streak"].includes(goal.metric)) {
        return null;
      }
      if (typeof goal.target !== "string" || typeof goal.why !== "string") return null;
      return {
        metric: goal.metric as StructuredAnalysis["goals_next_10"][number]["metric"],
        target: goal.target,
        why: goal.why,
      };
    })
    .filter((goal): goal is StructuredAnalysis["goals_next_10"][number] => goal !== null);

  if (goalsNext10.length === 0) return null;

  return {
    title: value.title,
    sections,
    one_line_summary: value.one_line_summary,
    key_leak: {
      label: value.key_leak.label,
      evidence,
      fix,
    },
    goals_next_10: goalsNext10,
  };
}

function parseDataQuality(value: unknown): DataQualitySummary | null {
  if (!isRecord(value)) return null;
  if (!isRecord(value.coverage)) return null;
  if (typeof value.score !== "number") return null;
  if (!Array.isArray(value.warnings)) return null;
  const warnings = value.warnings.filter((warning): warning is string => typeof warning === "string");
  if (
    typeof value.coverage.notes_percent !== "number" ||
    typeof value.coverage.tags_percent !== "number" ||
    typeof value.coverage.hold_time_percent !== "number" ||
    typeof value.coverage.risk_or_position_percent !== "number"
  ) {
    return null;
  }
  return {
    score: value.score,
    coverage: {
      notes_percent: value.coverage.notes_percent,
      tags_percent: value.coverage.tags_percent,
      hold_time_percent: value.coverage.hold_time_percent,
      risk_or_position_percent: value.coverage.risk_or_position_percent,
    },
    warnings,
  };
}

function parseFeeSlippageSummary(value: unknown): FeeSlippageSummary | null {
  if (!isRecord(value)) return null;
  const avgFeeUsd =
    value.avg_fee_usd === null || typeof value.avg_fee_usd === "number" ? value.avg_fee_usd : null;
  const avgSlippagePercent =
    value.avg_slippage_percent === null || typeof value.avg_slippage_percent === "number"
      ? value.avg_slippage_percent
      : null;
  const slippageOver3Percent =
    typeof value.slippage_over_3_percent === "number" ? value.slippage_over_3_percent : 0;
  const feesAsPercentOfAvgWin =
    value.fees_as_percent_of_avg_win === null || typeof value.fees_as_percent_of_avg_win === "number"
      ? value.fees_as_percent_of_avg_win
      : null;

  return {
    avg_fee_usd: avgFeeUsd,
    avg_slippage_percent: avgSlippagePercent,
    slippage_over_3_percent: slippageOver3Percent,
    fees_as_percent_of_avg_win: feesAsPercentOfAvgWin,
  };
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
  if (typeof trade.realized_pnl_usd !== "number") return null;

  const closedAt = toIsoString(trade.date);
  if (!closedAt) return null;

  const openedAt = toIsoString(trade.journal_updated_at || trade.date);
  const holdTimeMinutes =
    openedAt && closedAt
      ? Math.max(0, Math.round((new Date(closedAt).getTime() - new Date(openedAt).getTime()) / 60000))
      : undefined;

  return {
    is_journaled: !!trade.is_journaled,
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
    setup_tag: normalizeText(trade.setup_tag),
    entry_reason: normalizeText(trade.entry_reason),
    entry_delay_seconds:
      typeof trade.entry_delay_seconds === "number" ? trade.entry_delay_seconds : undefined,
    position_size_usd: typeof trade.position_size_usd === "number" ? trade.position_size_usd : undefined,
    position_size_sol: typeof trade.position_size_sol === "number" ? trade.position_size_sol : undefined,
    wallet_equity_usd_at_entry:
      typeof trade.wallet_equity_usd_at_entry === "number"
        ? trade.wallet_equity_usd_at_entry
        : undefined,
    risk_pct_of_wallet:
      typeof trade.risk_pct_of_wallet === "number" ? trade.risk_pct_of_wallet : undefined,
    mae_percent: typeof trade.mae_percent === "number" ? trade.mae_percent : undefined,
    mfe_percent: typeof trade.mfe_percent === "number" ? trade.mfe_percent : undefined,
    time_of_day_bucket: normalizeText(trade.time_of_day_bucket),
    exit_plan: normalizeText(trade.exit_plan),
    did_follow_plan:
      typeof trade.did_follow_plan === "boolean" ? trade.did_follow_plan : undefined,
    stop_type: normalizeText(trade.stop_type),
    take_profit_rules: normalizeText(trade.take_profit_rules),
    fee_usd: typeof trade.fee_usd === "number" ? trade.fee_usd : undefined,
    slippage_percent:
      typeof trade.slippage_percent === "number"
        ? trade.slippage_percent
        : typeof trade.price_impact === "number"
          ? trade.price_impact
          : undefined,
    price_impact: typeof trade.price_impact === "number" ? trade.price_impact : undefined,
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
  const [analysisText, setAnalysisText] = useState<string | null>(null);
  const [analysisStructured, setAnalysisStructured] = useState<StructuredAnalysis | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<TradeMetrics | null>(null);
  const [dataQuality, setDataQuality] = useState<DataQualitySummary | null>(null);
  const [feeSlippageSummary, setFeeSlippageSummary] = useState<FeeSlippageSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = useCallback(
    async (
      journaledTrades: JournalEvent[],
      walletId?: number | null,
      scope: AnalysisScope = "JOURNALED"
    ): Promise<boolean> => {
      const normalizedTrades = journaledTrades
        .map(mapTradeForAnalysis)
        .filter((trade): trade is JournalAnalysisTrade => trade !== null)
        .filter((trade) => (scope === "JOURNALED" ? trade.is_journaled : true))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      if (normalizedTrades.length < 5) {
        setError(
          scope === "JOURNALED"
            ? "Minimum 5 journaled trades required"
            : "Minimum 5 closed trades required"
        );
        return false;
      }

      setLoading(true);
      setError(null);
      setModel(null);

      try {
        const response = await authedFetchClient(getBearerToken, "/api/journal/ai-analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trades: normalizedTrades,
            walletId: walletId ?? null,
            scope,
            analysis_scope: scope === "ALL" ? "all_closed" : "journaled_only",
          }),
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

        setAnalysisText(parsed.text);
        setAnalysisStructured(parseStructuredAnalysis(parsed.structured));
        setDataQuality(parseDataQuality(parsed.data_quality));
        setFeeSlippageSummary(parseFeeSlippageSummary(parsed.fee_slippage_summary));
        setModel(parsed.model);
        const filteredSourceTrades =
          scope === "JOURNALED"
            ? journaledTrades.filter((trade) => trade.is_journaled)
            : journaledTrades;
        setMetrics(computeMetricsFromTrades(filteredSourceTrades));
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
    analysis: analysisText,
    analysisText,
    analysisStructured,
    model,
    metrics,
    dataQuality,
    feeSlippageSummary,
    error,
    runAnalysis,
  };
}
