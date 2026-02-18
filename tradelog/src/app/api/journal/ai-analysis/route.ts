import { NextRequest, NextResponse } from "next/server";
import { openrouter } from "@/lib/openrouter";
import type {
  DataQualitySummary,
  FeeSlippageSummary,
  StructuredAnalysis,
} from "@/lib/ai/structuredAnalysis";

type IncomingTrade = {
  is_journaled?: unknown;
  token_symbol?: unknown;
  realized_pnl_usd?: unknown;
  realized_pnl_percent?: unknown;
  hold_time_minutes?: unknown;
  tags?: unknown;
  notes?: unknown;
  what_went_well?: unknown;
  what_went_wrong?: unknown;
  what_will_i_do_differently?: unknown;
  setup_tag?: unknown;
  entry_reason?: unknown;
  entry_delay_seconds?: unknown;
  position_size_usd?: unknown;
  position_size_sol?: unknown;
  wallet_equity_usd_at_entry?: unknown;
  risk_pct_of_wallet?: unknown;
  mae_percent?: unknown;
  mfe_percent?: unknown;
  time_of_day_bucket?: unknown;
  exit_plan?: unknown;
  did_follow_plan?: unknown;
  stop_type?: unknown;
  take_profit_rules?: unknown;
  fee_usd?: unknown;
  slippage_percent?: unknown;
  price_impact?: unknown;
  date?: unknown;
};

type NormalizedTrade = {
  is_journaled: boolean;
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
  date: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toFiniteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toOptionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const cleaned = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return cleaned.length > 0 ? cleaned : undefined;
}

function normalizeTrade(value: unknown): NormalizedTrade | null {
  if (!isRecord(value)) return null;

  const trade = value as IncomingTrade;
  const tokenSymbol = toOptionalString(trade.token_symbol);
  const realizedPnlUsd = toFiniteNumber(trade.realized_pnl_usd);
  const dateString = toOptionalString(trade.date);
  const dateMs = dateString ? new Date(dateString).getTime() : NaN;

  if (!tokenSymbol || realizedPnlUsd === null || !Number.isFinite(dateMs)) {
    return null;
  }

  const realizedPnlPercent = toFiniteNumber(trade.realized_pnl_percent) ?? undefined;
  const holdTimeMinutes = toFiniteNumber(trade.hold_time_minutes) ?? undefined;
  const didFollowPlan =
    typeof trade.did_follow_plan === "boolean" ? trade.did_follow_plan : undefined;

  return {
    is_journaled: Boolean(trade.is_journaled),
    token_symbol: tokenSymbol,
    realized_pnl_usd: realizedPnlUsd,
    realized_pnl_percent: realizedPnlPercent,
    hold_time_minutes: holdTimeMinutes,
    tags: toOptionalStringArray(trade.tags),
    notes: toOptionalString(trade.notes),
    what_went_well: toOptionalString(trade.what_went_well),
    what_went_wrong: toOptionalString(trade.what_went_wrong),
    what_will_i_do_differently: toOptionalString(trade.what_will_i_do_differently),
    setup_tag: toOptionalString(trade.setup_tag),
    entry_reason: toOptionalString(trade.entry_reason),
    entry_delay_seconds: toFiniteNumber(trade.entry_delay_seconds) ?? undefined,
    position_size_usd: toFiniteNumber(trade.position_size_usd) ?? undefined,
    position_size_sol: toFiniteNumber(trade.position_size_sol) ?? undefined,
    wallet_equity_usd_at_entry: toFiniteNumber(trade.wallet_equity_usd_at_entry) ?? undefined,
    risk_pct_of_wallet: toFiniteNumber(trade.risk_pct_of_wallet) ?? undefined,
    mae_percent: toFiniteNumber(trade.mae_percent) ?? undefined,
    mfe_percent: toFiniteNumber(trade.mfe_percent) ?? undefined,
    time_of_day_bucket: toOptionalString(trade.time_of_day_bucket),
    exit_plan: toOptionalString(trade.exit_plan),
    did_follow_plan: didFollowPlan,
    stop_type: toOptionalString(trade.stop_type),
    take_profit_rules: toOptionalString(trade.take_profit_rules),
    fee_usd: toFiniteNumber(trade.fee_usd) ?? undefined,
    slippage_percent:
      toFiniteNumber(trade.slippage_percent) ?? toFiniteNumber(trade.price_impact) ?? undefined,
    date: new Date(dateMs).toISOString(),
  };
}

function summarizeTrades(trades: NormalizedTrade[]) {
  const total = trades.length;
  const wins = trades.filter((trade) => trade.realized_pnl_usd > 0);
  const losses = trades.filter((trade) => trade.realized_pnl_usd < 0);
  const netPnl = trades.reduce((sum, trade) => sum + trade.realized_pnl_usd, 0);
  const totalWins = wins.reduce((sum, trade) => sum + trade.realized_pnl_usd, 0);
  const totalLossAbs = Math.abs(
    losses.reduce((sum, trade) => sum + trade.realized_pnl_usd, 0)
  );

  return {
    total_trades: total,
    win_count: wins.length,
    loss_count: losses.length,
    win_rate_percent: total > 0 ? (wins.length / total) * 100 : 0,
    net_pnl_usd: netPnl,
    avg_pnl_usd: total > 0 ? netPnl / total : 0,
    avg_win_usd: wins.length > 0 ? totalWins / wins.length : 0,
    avg_loss_usd: losses.length > 0 ? totalLossAbs / losses.length : 0,
  };
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function variance(values: number[]): number | null {
  if (values.length === 0) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
}

function stdDev(values: number[]): number | null {
  const varValue = variance(values);
  return varValue === null ? null : Math.sqrt(varValue);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function extractMessageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((part) => {
      if (!isRecord(part)) return "";
      const text = part.text;
      return typeof text === "string" ? text : "";
    })
    .join("\n")
    .trim();
}

function parseStructuredAnalysis(value: unknown): StructuredAnalysis | null {
  if (!isRecord(value)) return null;
  if (typeof value.title !== "string" || typeof value.one_line_summary !== "string") return null;
  if (!isRecord(value.key_leak)) return null;
  if (typeof value.key_leak.label !== "string") return null;
  if (!Array.isArray(value.key_leak.evidence) || !Array.isArray(value.key_leak.fix)) return null;
  if (!Array.isArray(value.goals_next_10) || !Array.isArray(value.sections)) return null;

  const validSectionIds = new Set(["snapshot", "execution", "behavior", "quant", "simulation", "plan"]);
  const sections = value.sections
    .map((section): StructuredAnalysis["sections"][number] | null => {
      if (!isRecord(section)) return null;
      if (typeof section.id !== "string" || !validSectionIds.has(section.id)) return null;
      if (typeof section.label !== "string" || !Array.isArray(section.bullets)) return null;
      const bullets = section.bullets.filter((bullet): bullet is string => typeof bullet === "string");
      if (bullets.length === 0) return null;
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

  const validGoalMetrics = new Set(["win_rate", "avg_loss", "expectancy", "risk_reward", "streak"]);
  const goals = value.goals_next_10
    .map((goal): StructuredAnalysis["goals_next_10"][number] | null => {
      if (!isRecord(goal)) return null;
      if (
        typeof goal.metric !== "string" ||
        !validGoalMetrics.has(goal.metric) ||
        typeof goal.target !== "string" ||
        typeof goal.why !== "string"
      ) {
        return null;
      }
      return {
        metric: goal.metric as StructuredAnalysis["goals_next_10"][number]["metric"],
        target: goal.target,
        why: goal.why,
      };
    })
    .filter((goal): goal is StructuredAnalysis["goals_next_10"][number] => goal !== null);

  if (goals.length === 0) return null;

  return {
    title: value.title,
    one_line_summary: value.one_line_summary,
    key_leak: {
      label: value.key_leak.label,
      evidence,
      fix,
    },
    goals_next_10: goals,
    sections,
  };
}

function structuredToText(structured: StructuredAnalysis): string {
  const lines: string[] = [structured.title, structured.one_line_summary, ""];
  for (const section of structured.sections) {
    lines.push(section.label);
    for (const bullet of section.bullets) {
      lines.push(`- ${bullet}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as unknown;
    if (!isRecord(body) || !Array.isArray(body.trades)) {
      return NextResponse.json({ error: "Invalid payload: trades is required" }, { status: 400 });
    }

    const requestedScope =
      body.scope === "ALL" || body.analysis_scope === "all_closed" ? "all_closed" : "journaled_only";

    const normalizedTradesAll = body.trades
      .map(normalizeTrade)
      .filter((trade): trade is NormalizedTrade => trade !== null)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const normalizedTrades =
      requestedScope === "journaled_only"
        ? normalizedTradesAll.filter((trade) => trade.is_journaled)
        : normalizedTradesAll;

    if (normalizedTrades.length === 0) {
      return NextResponse.json({ error: "Invalid payload: no valid trades" }, { status: 400 });
    }

    const cappedTrades = normalizedTrades.slice(0, 50);
    const summary = summarizeTrades(normalizedTrades);
    const wins = normalizedTrades.filter((trade) => trade.realized_pnl_usd > 0);
    const losses = normalizedTrades.filter((trade) => trade.realized_pnl_usd < 0);
    const breakevens = normalizedTrades.filter((trade) => trade.realized_pnl_usd === 0);
    const totalTrades = normalizedTrades.length;

    const avgWinUsd =
      wins.length > 0
        ? wins.reduce((sum, trade) => sum + trade.realized_pnl_usd, 0) / wins.length
        : 0;
    const avgLossUsd =
      losses.length > 0
        ? Math.abs(losses.reduce((sum, trade) => sum + trade.realized_pnl_usd, 0)) / losses.length
        : 0;
    const winRatePercent = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0;
    const lossRatePercent = totalTrades > 0 ? (losses.length / totalTrades) * 100 : 0;
    const breakevenRatePercent = totalTrades > 0 ? (breakevens.length / totalTrades) * 100 : 0;
    const winRate = totalTrades > 0 ? wins.length / totalTrades : 0;
    const lossRate = totalTrades > 0 ? losses.length / totalTrades : 0;
    const riskRewardRatio = avgLossUsd > 0 ? avgWinUsd / avgLossUsd : null;
    const expectancyUsd = winRate * avgWinUsd - lossRate * avgLossUsd;

    const holdTimes = normalizedTrades
      .map((trade) => trade.hold_time_minutes)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const avgHoldTimeMinutes =
      holdTimes.length > 0
        ? holdTimes.reduce((sum, value) => sum + value, 0) / holdTimes.length
        : null;

    const tokenStatsMap = new Map<
      string,
      { trade_count: number; net_pnl_usd: number; win_count: number }
    >();
    for (const trade of normalizedTrades) {
      const existing = tokenStatsMap.get(trade.token_symbol);
      if (existing) {
        existing.trade_count += 1;
        existing.net_pnl_usd += trade.realized_pnl_usd;
        if (trade.realized_pnl_usd > 0) existing.win_count += 1;
      } else {
        tokenStatsMap.set(trade.token_symbol, {
          trade_count: 1,
          net_pnl_usd: trade.realized_pnl_usd,
          win_count: trade.realized_pnl_usd > 0 ? 1 : 0,
        });
      }
    }

    const tokenStats = Array.from(tokenStatsMap.entries())
      .map(([token_symbol, stats]) => ({
        token_symbol,
        trade_count: stats.trade_count,
        net_pnl_usd: stats.net_pnl_usd,
        win_rate_percent: stats.trade_count > 0 ? (stats.win_count / stats.trade_count) * 100 : 0,
        avg_pnl_usd: stats.trade_count > 0 ? stats.net_pnl_usd / stats.trade_count : 0,
      }))
      .sort((a, b) => a.net_pnl_usd - b.net_pnl_usd)
      .slice(0, 5);

    let maxLossStreak = 0;
    let currentLossRun = 0;
    let maxWinStreak = 0;
    let currentWinRun = 0;
    for (const trade of normalizedTrades) {
      if (trade.realized_pnl_usd < 0) {
        currentLossRun += 1;
        currentWinRun = 0;
      } else if (trade.realized_pnl_usd > 0) {
        currentWinRun += 1;
        currentLossRun = 0;
      } else {
        currentLossRun = 0;
        currentWinRun = 0;
      }

      if (currentLossRun > maxLossStreak) maxLossStreak = currentLossRun;
      if (currentWinRun > maxWinStreak) maxWinStreak = currentWinRun;
    }

    let currentLossStreak = 0;
    for (const trade of normalizedTrades) {
      if (trade.realized_pnl_usd < 0) {
        currentLossStreak += 1;
      } else {
        break;
      }
    }

    const sortedPnlValues = normalizedTrades
      .map((trade) => trade.realized_pnl_usd)
      .sort((a, b) => a - b);
    const medianPnlUsd =
      sortedPnlValues.length === 0
        ? null
        : sortedPnlValues.length % 2 === 1
          ? sortedPnlValues[Math.floor(sortedPnlValues.length / 2)]
          : (sortedPnlValues[sortedPnlValues.length / 2 - 1] +
              sortedPnlValues[sortedPnlValues.length / 2]) /
            2;

    const tagCounts = new Map<string, number>();
    for (const trade of normalizedTrades) {
      for (const tag of trade.tags ?? []) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }
    const tagsSummary = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const setupPerformanceMap = new Map<
      string,
      {
        trades: number;
        wins: number;
        net_pnl_usd: number;
        hold_times: number[];
        maes: number[];
        mfes: number[];
      }
    >();
    for (const trade of normalizedTrades) {
      const key = trade.setup_tag || "unknown";
      const existing =
        setupPerformanceMap.get(key) ??
        { trades: 0, wins: 0, net_pnl_usd: 0, hold_times: [], maes: [], mfes: [] };
      existing.trades += 1;
      if (trade.realized_pnl_usd > 0) existing.wins += 1;
      existing.net_pnl_usd += trade.realized_pnl_usd;
      if (typeof trade.hold_time_minutes === "number") existing.hold_times.push(trade.hold_time_minutes);
      if (typeof trade.mae_percent === "number") existing.maes.push(trade.mae_percent);
      if (typeof trade.mfe_percent === "number") existing.mfes.push(trade.mfe_percent);
      setupPerformanceMap.set(key, existing);
    }

    const setupPerformance = Array.from(setupPerformanceMap.entries())
      .map(([setup_tag, stats]) => ({
        setup_tag,
        trades: stats.trades,
        win_rate_percent: stats.trades > 0 ? (stats.wins / stats.trades) * 100 : 0,
        net_pnl_usd: stats.net_pnl_usd,
        expectancy_usd: stats.trades > 0 ? stats.net_pnl_usd / stats.trades : 0,
        avg_hold_time_minutes: average(stats.hold_times),
        avg_mae_percent: average(stats.maes),
        avg_mfe_percent: average(stats.mfes),
      }))
      .sort((a, b) => b.trades - a.trades);

    const realizedPnlPercents = normalizedTrades
      .map((trade) => trade.realized_pnl_percent)
      .filter((value): value is number => typeof value === "number");
    const mfePercents = normalizedTrades
      .map((trade) => trade.mfe_percent)
      .filter((value): value is number => typeof value === "number");
    const maePercents = normalizedTrades
      .map((trade) => trade.mae_percent)
      .filter((value): value is number => typeof value === "number");
    const mfeCaptureRatios = normalizedTrades
      .map((trade) => {
        if (typeof trade.mfe_percent !== "number") return null;
        if (typeof trade.realized_pnl_percent !== "number") return null;
        if (trade.mfe_percent <= 0) return null;
        return (trade.realized_pnl_percent / trade.mfe_percent) * 100;
      })
      .filter((value): value is number => value !== null);
    const largeAdverseTrades = normalizedTrades.filter(
      (trade) => typeof trade.mae_percent === "number" && trade.mae_percent <= -20
    );
    const largeAdverseSmallRealizedLossCount = largeAdverseTrades.filter(
      (trade) =>
        typeof trade.realized_pnl_percent === "number" && trade.realized_pnl_percent > -10
    ).length;
    const largeAdverseLargeRealizedLossCount = largeAdverseTrades.filter(
      (trade) =>
        typeof trade.realized_pnl_percent === "number" && trade.realized_pnl_percent <= -20
    ).length;
    const gaveBackCount = normalizedTrades.filter(
      (trade) =>
        typeof trade.mfe_percent === "number" &&
        typeof trade.realized_pnl_percent === "number" &&
        trade.mfe_percent > 0 &&
        trade.realized_pnl_percent < trade.mfe_percent * 0.5
    ).length;

    const executionLeakage = {
      avg_mfe_percent: average(mfePercents),
      avg_mae_percent: average(maePercents),
      avg_realized_pnl_percent: average(realizedPnlPercents),
      avg_mfe_capture_ratio_percent: average(mfeCaptureRatios),
      gave_back_trade_count: gaveBackCount,
      gave_back_trade_percent:
        totalTrades > 0 ? (gaveBackCount / totalTrades) * 100 : 0,
      large_adverse_move_count: largeAdverseTrades.length,
      large_adverse_small_realized_loss_count: largeAdverseSmallRealizedLossCount,
      large_adverse_large_realized_loss_count: largeAdverseLargeRealizedLossCount,
    };

    const riskPctValues = normalizedTrades
      .map((trade) => trade.risk_pct_of_wallet)
      .filter((value): value is number => typeof value === "number");
    const sizingConsistency = {
      samples: riskPctValues.length,
      avg_risk_pct_of_wallet: average(riskPctValues),
      variance_risk_pct_of_wallet: variance(riskPctValues),
      stddev_risk_pct_of_wallet: stdDev(riskPctValues),
      max_risk_pct_of_wallet:
        riskPctValues.length > 0 ? Math.max(...riskPctValues) : null,
    };

    const timeBucketMap = new Map<
      string,
      { trades: number; wins: number; net_pnl_usd: number }
    >();
    for (const trade of normalizedTrades) {
      const bucket = trade.time_of_day_bucket || "unknown";
      const entry = timeBucketMap.get(bucket) ?? { trades: 0, wins: 0, net_pnl_usd: 0 };
      entry.trades += 1;
      if (trade.realized_pnl_usd > 0) entry.wins += 1;
      entry.net_pnl_usd += trade.realized_pnl_usd;
      timeBucketMap.set(bucket, entry);
    }
    const timeOfDayPerformance = Array.from(timeBucketMap.entries())
      .map(([bucket, stats]) => ({
        bucket,
        trades: stats.trades,
        win_rate_percent: stats.trades > 0 ? (stats.wins / stats.trades) * 100 : 0,
        net_pnl_usd: stats.net_pnl_usd,
        expectancy_usd: stats.trades > 0 ? stats.net_pnl_usd / stats.trades : 0,
      }))
      .sort((a, b) => b.trades - a.trades);

    const tokenCountMap = new Map<string, number>();
    for (const trade of normalizedTrades) {
      tokenCountMap.set(trade.token_symbol, (tokenCountMap.get(trade.token_symbol) ?? 0) + 1);
    }
    const tokenCounts = Array.from(tokenCountMap.entries())
      .map(([token_symbol, trades]) => ({ token_symbol, trades }))
      .sort((a, b) => b.trades - a.trades);
    const topTokenCount = tokenCounts[0]?.trades ?? 0;
    const tokenRotation = {
      unique_tokens: tokenCounts.length,
      top_token_symbol: tokenCounts[0]?.token_symbol ?? null,
      top_token_share_percent:
        totalTrades > 0 ? (topTokenCount / totalTrades) * 100 : 0,
      herfindahl_index:
        totalTrades > 0
          ? tokenCounts.reduce((sum, token) => {
              const share = token.trades / totalTrades;
              return sum + share * share;
            }, 0)
          : 0,
    };

    const sampleWeight = clamp(totalTrades / 30, 0, 1);
    const expectancyComponent = clamp(expectancyUsd / 25, -1, 1);
    const winRateComponent = clamp((winRatePercent - 50) / 50, -1, 1);
    const rrComponent = clamp(((riskRewardRatio ?? 1) - 1) / 1.5, -1, 1);
    const edgeScore =
      clamp(
        50 + (expectancyComponent * 0.45 + winRateComponent * 0.35 + rrComponent * 0.2) * sampleWeight * 50,
        0,
        100
      );

    const aiInputCompleteness = {
      setup_tag_samples: normalizedTrades.filter((t) => !!t.setup_tag).length,
      position_size_usd_samples: normalizedTrades.filter((t) => typeof t.position_size_usd === "number").length,
      wallet_equity_samples: normalizedTrades.filter((t) => typeof t.wallet_equity_usd_at_entry === "number").length,
      risk_pct_samples: normalizedTrades.filter((t) => typeof t.risk_pct_of_wallet === "number").length,
      mae_samples: normalizedTrades.filter((t) => typeof t.mae_percent === "number").length,
      mfe_samples: normalizedTrades.filter((t) => typeof t.mfe_percent === "number").length,
      entry_delay_samples: normalizedTrades.filter((t) => typeof t.entry_delay_seconds === "number").length,
      time_bucket_samples: normalizedTrades.filter((t) => !!t.time_of_day_bucket).length,
      exit_plan_samples: normalizedTrades.filter((t) => !!t.exit_plan).length,
      did_follow_plan_samples: normalizedTrades.filter((t) => typeof t.did_follow_plan === "boolean").length,
    };

    const coverage = {
      notes_percent:
        totalTrades > 0
          ? (normalizedTrades.filter((trade) => !!trade.notes).length / totalTrades) * 100
          : 0,
      tags_percent:
        totalTrades > 0
          ? (normalizedTrades.filter((trade) => (trade.tags?.length ?? 0) > 0).length / totalTrades) * 100
          : 0,
      hold_time_percent:
        totalTrades > 0
          ? (normalizedTrades.filter((trade) => typeof trade.hold_time_minutes === "number").length /
              totalTrades) *
            100
          : 0,
      risk_or_position_percent:
        totalTrades > 0
          ? (normalizedTrades.filter(
              (trade) =>
                typeof trade.risk_pct_of_wallet === "number" ||
                typeof trade.position_size_usd === "number" ||
                typeof trade.position_size_sol === "number"
            ).length /
              totalTrades) *
            100
          : 0,
    };
    const dataQualityScore = Math.round(
      clamp(
        coverage.notes_percent * 0.25 +
          coverage.tags_percent * 0.2 +
          coverage.hold_time_percent * 0.25 +
          coverage.risk_or_position_percent * 0.3,
        0,
        100
      )
    );
    const dataQualityWarnings: string[] = [];
    if (coverage.hold_time_percent < 40) {
      dataQualityWarnings.push(
        `Hold time missing on ${Math.round(100 - coverage.hold_time_percent)}% of trades -> execution coaching is limited`
      );
    }
    if (coverage.risk_or_position_percent < 50) {
      dataQualityWarnings.push(
        `Risk/position sizing missing on ${Math.round(100 - coverage.risk_or_position_percent)}% of trades -> sizing coaching confidence is reduced`
      );
    }
    if (coverage.notes_percent < 40) {
      dataQualityWarnings.push(
        `Notes missing on ${Math.round(100 - coverage.notes_percent)}% of trades -> behavior pattern detection is weaker`
      );
    }
    const dataQuality: DataQualitySummary = {
      score: dataQualityScore,
      coverage,
      warnings: dataQualityWarnings,
    };

    const fees = normalizedTrades
      .map((trade) => trade.fee_usd)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const slippages = normalizedTrades
      .map((trade) => trade.slippage_percent)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const avgFeeUsd = average(fees);
    const avgSlippagePercent = average(slippages);
    const feeSlippageSummary: FeeSlippageSummary = {
      avg_fee_usd: avgFeeUsd,
      avg_slippage_percent: avgSlippagePercent,
      slippage_over_3_percent:
        totalTrades > 0 ? (slippages.filter((value) => value > 3).length / totalTrades) * 100 : 0,
      fees_as_percent_of_avg_win:
        avgFeeUsd !== null && avgWinUsd > 0 ? (avgFeeUsd / avgWinUsd) * 100 : null,
    };

    const walletId =
      typeof body.walletId === "number" && Number.isFinite(body.walletId) ? body.walletId : null;

    const payload = {
      wallet_id: walletId,
      analysis_scope: requestedScope,
      total_received_trades: normalizedTradesAll.length,
      total_after_scope_filter: normalizedTrades.length,
      included_trades: cappedTrades.length,
      truncated: normalizedTrades.length > cappedTrades.length,
      summary,
      derived_metrics: {
        avg_win_usd: avgWinUsd,
        avg_loss_usd: avgLossUsd,
        win_rate_percent: winRatePercent,
        loss_rate_percent: lossRatePercent,
        breakeven_rate_percent: breakevenRatePercent,
        risk_reward_ratio: riskRewardRatio,
        expectancy_usd: expectancyUsd,
        avg_hold_time_minutes: avgHoldTimeMinutes,
        hold_time_samples: holdTimes.length,
      },
      memecoin_context: {
        token_stats: tokenStats,
        streaks: {
          max_loss_streak: maxLossStreak,
          current_loss_streak: currentLossStreak,
          max_win_streak: maxWinStreak,
        },
        pnl_distribution: {
          wins: wins.length,
          losses: losses.length,
          breakevens: breakevens.length,
          median_pnl_usd: medianPnlUsd,
        },
        tags_summary: tagsSummary,
      },
      setup_performance: setupPerformance,
      execution_leakage: executionLeakage,
      sizing_consistency: sizingConsistency,
      time_of_day_performance: timeOfDayPerformance,
      token_rotation: tokenRotation,
      data_quality: dataQuality,
      fee_slippage_summary: feeSlippageSummary,
      edge_score: {
        score: edgeScore,
        sample_weight: sampleWeight,
        components: {
          expectancy_component: expectancyComponent,
          win_rate_component: winRateComponent,
          risk_reward_component: rrComponent,
        },
      },
      ai_input_completeness: aiInputCompleteness,
      trades: cappedTrades,
    };

    const systemPrompt = [
      "You are an elite Solana memecoin trencher performance coach.",
      "Use only the provided payload values. Output STRICT JSON only with no markdown or backticks.",
      "Schema:",
      '{"title":"AI Coach Review","one_line_summary":"string","key_leak":{"label":"string","evidence":["string"],"fix":["string"]},"goals_next_10":[{"metric":"win_rate|avg_loss|expectancy|risk_reward|streak","target":"string","why":"string"}],"sections":[{"id":"snapshot","label":"Performance Snapshot","bullets":["string"]},{"id":"execution","label":"Execution","bullets":["string"]},{"id":"behavior","label":"Behavior","bullets":["string"]},{"id":"quant","label":"Quant","bullets":["string"]},{"id":"simulation","label":"Simulation","bullets":["string"]},{"id":"plan","label":"Action Plan","bullets":["string"]}]}',
      "Hard rules:",
      "- Never output the phrase 'Not provided'.",
      "- Use at most 2 bullets total containing 'Insufficient data to infer ...'.",
      "- Include numeric values in every section.",
      "- Keep each section to max 8 bullets.",
      "- Simulation section must include exactly two bullets named 'Scenario A:' and 'Scenario B:' with explicit calculations.",
      "- Scenario A: increase win_rate_percent by +5 points (cap at 100), keep avg win/loss constant, recompute expectancy and 30-trade projection.",
      "- Scenario B: reduce avg_loss_usd by 20%, keep win rate and avg win constant, recompute expectancy and 30-trade projection.",
      "- Plan section must include exactly 3 bullets, each with a metric target and threshold for next 10 trades.",
      "- Execution bullets must discuss fee burn, slippage thresholds, MAE/MFE and stop discipline when data exists.",
      "- For missing data, include capture instruction and keep insufficiency statements only in execution or plan.",
    ].join(" ");

    const userPrompt = `Analyze payload and return strict JSON.\n${JSON.stringify(payload)}`;

    const completion = await openrouter.chat.completions.create({
      model: "meta-llama/llama-4-scout",
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const rawText = extractMessageText(completion.choices[0]?.message?.content);
    let structured: StructuredAnalysis | null = null;
    try {
      structured = parseStructuredAnalysis(JSON.parse(rawText) as unknown);
    } catch {
      structured = null;
    }
    const text = structured ? structuredToText(structured) : rawText;

    return NextResponse.json({
      text,
      model: completion.model,
      structured,
      data_quality: dataQuality,
      fee_slippage_summary: feeSlippageSummary,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
