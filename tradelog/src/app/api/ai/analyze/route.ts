import { NextRequest } from "next/server";
import { withTiming, throwHttp } from "@/app/lib/http";
import { computeTradeMetrics } from "@/app/lib/tradeMetrics";
import { requireUser } from "@/app/lib/authorization";
import { openRouterChatCompletion } from "@/app/lib/openrouter";

type AnalyzeTradeInput = {
  pnl_usd: number;
  opened_at: string;
  closed_at: string;
};

type AnalyzeRequestBody = {
  journaledTrades?: AnalyzeTradeInput[];
};

function isValidDate(value: string): boolean {
  const ms = new Date(value).getTime();
  return Number.isFinite(ms);
}

export async function POST(req: NextRequest) {
  return withTiming(req, async () => {
    const dbUser = await requireUser(req);
    void dbUser;
    // TODO: enforce AI feature entitlement / daily quota per user

    const body = (await req.json().catch(() => ({}))) as AnalyzeRequestBody;
    const journaledTrades = body?.journaledTrades;

    if (journaledTrades === undefined) {
      throwHttp("bad_request", "journaledTrades required", 400);
    }

    if (!Array.isArray(journaledTrades)) {
      throwHttp("bad_request", "journaledTrades must be array", 400);
    }

    if (journaledTrades.length === 0) {
      return {
        analysis: "Not enough data to analyze trades.",
        metrics: computeTradeMetrics([]),
      };
    }

    const normalizedTrades = journaledTrades.map((trade) => {
      if (
        typeof trade?.pnl_usd !== "number" ||
        typeof trade?.opened_at !== "string" ||
        typeof trade?.closed_at !== "string" ||
        !isValidDate(trade.opened_at) ||
        !isValidDate(trade.closed_at)
      ) {
        throwHttp("bad_request", "Invalid trade payload", 400);
      }

      return {
        pnl_usd: trade.pnl_usd,
        opened_at: new Date(trade.opened_at),
        closed_at: new Date(trade.closed_at),
      };
    });

    const metrics = computeTradeMetrics(normalizedTrades);

    const systemPrompt =
      "You are a professional quantitative trading coach. Analyze the user's performance metrics objectively. Be direct, structured, and actionable. Avoid hype language. Focus on risk management, consistency, and behavioral patterns.";

    const userPrompt = [
      "Analyze the following trading metrics:",
      `- totalTrades: ${metrics.totalTrades}`,
      `- winRate: ${metrics.winRate}`,
      `- avgWin: ${metrics.avgWin}`,
      `- avgLoss: ${metrics.avgLoss}`,
      `- profitFactor: ${metrics.profitFactor === null ? "null" : metrics.profitFactor}`,
      `- largestWin: ${metrics.largestWin}`,
      `- largestLoss: ${metrics.largestLoss}`,
      `- avgHoldTimeMinutes: ${metrics.avgHoldTimeMinutes}`,
      "",
      "Return exactly these sections:",
      "1) Overall performance assessment",
      "2) Risk management critique",
      "3) Behavioral insight",
      "4) 3 specific improvement actions",
    ].join("\n");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);
    let analysis = "";
    try {
      const completion = await openRouterChatCompletion({
        model: "openai/gpt-4o-mini",
        temperature: 0.4,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        signal: controller.signal,
      });

      if (!completion.ok) {
        if (completion.status === 429) {
          throwHttp("rate_limited", "Rate limited", 429);
        }
        if (completion.status === 408 || completion.status === 504) {
          throwHttp("provider_timeout", "AI provider timeout", 504);
        }
        throwHttp("provider_unavailable", "AI analysis unavailable", 502);
      }

      const completionJson = completion.json as {
        choices?: Array<{ message?: { content?: string | null } }>;
      };

      analysis =
        completionJson.choices?.[0]?.message?.content?.trim() ||
        "Analysis unavailable.";
    } catch (error: unknown) {
      const errorName = typeof error === "object" && error !== null && "name" in error
        ? String((error as { name?: string }).name)
        : "";
      if (errorName === "AbortError" || errorName === "TimeoutError") {
        throwHttp("provider_timeout", "AI provider timeout", 504);
      }
      if (error instanceof Error && error.message.includes("OPENROUTER_API_KEY")) {
        throwHttp("provider_unavailable", "AI analysis unavailable", 502);
      }
      const status = typeof error === "object" && error !== null && "status" in error
        ? Number((error as { status?: number }).status)
        : NaN;
      if (status === 429) {
        throwHttp("rate_limited", "Rate limited", 429);
      }
      throwHttp("provider_unavailable", "AI analysis unavailable", 502);
    } finally {
      clearTimeout(timeoutId);
    }

    return {
      analysis,
      metrics,
    };
  });
}
