import { NextRequest, NextResponse } from "next/server";
import { openrouter } from "@/lib/openrouter";

type IncomingTrade = {
  token_symbol?: unknown;
  realized_pnl_usd?: unknown;
  realized_pnl_percent?: unknown;
  hold_time_minutes?: unknown;
  tags?: unknown;
  notes?: unknown;
  what_went_well?: unknown;
  what_went_wrong?: unknown;
  what_will_i_do_differently?: unknown;
  date?: unknown;
};

type NormalizedTrade = {
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

  return {
    token_symbol: tokenSymbol,
    realized_pnl_usd: realizedPnlUsd,
    realized_pnl_percent: realizedPnlPercent,
    hold_time_minutes: holdTimeMinutes,
    tags: toOptionalStringArray(trade.tags),
    notes: toOptionalString(trade.notes),
    what_went_well: toOptionalString(trade.what_went_well),
    what_went_wrong: toOptionalString(trade.what_went_wrong),
    what_will_i_do_differently: toOptionalString(trade.what_will_i_do_differently),
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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as unknown;
    if (!isRecord(body) || !Array.isArray(body.trades)) {
      return NextResponse.json({ error: "Invalid payload: trades is required" }, { status: 400 });
    }

    const normalizedTrades = body.trades
      .map(normalizeTrade)
      .filter((trade): trade is NormalizedTrade => trade !== null)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (normalizedTrades.length === 0) {
      return NextResponse.json({ error: "Invalid payload: no valid trades" }, { status: 400 });
    }

    const cappedTrades = normalizedTrades.slice(0, 50);
    const summary = summarizeTrades(normalizedTrades);
    const walletId =
      typeof body.walletId === "number" && Number.isFinite(body.walletId) ? body.walletId : null;

    const payload = {
      wallet_id: walletId,
      total_received_trades: normalizedTrades.length,
      included_trades: cappedTrades.length,
      truncated: normalizedTrades.length > cappedTrades.length,
      summary,
      trades: cappedTrades,
    };

    const systemPrompt =
      "You are an experienced trading coach. Provide concise, practical feedback based on the user's journaled trades. " +
      "Use this structure exactly: 1) Performance Snapshot 2) What You Are Doing Well 3) Risk/Behavior Patterns 4) Action Plan. " +
      "Under sections 2-4, use bullet points. Keep tone direct and actionable.";

    const userPrompt = `Analyze these journaled trades:\n${JSON.stringify(payload)}`;

    const completion = await openrouter.chat.completions.create({
      model: "meta-llama/llama-4-scout",
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const text = extractMessageText(completion.choices[0]?.message?.content);

    return NextResponse.json({
      text,
      model: completion.model,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
