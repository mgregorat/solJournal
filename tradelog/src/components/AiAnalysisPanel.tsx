"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TradeMetrics } from "@/app/lib/tradeMetrics";
import { ChevronDown, ChevronUp, Copy, RefreshCw } from "lucide-react";

type AiAnalysisPanelProps = {
  loading: boolean;
  analysis: string | null;
  metrics: TradeMetrics | null;
  error: string | null;
  eligibleTradesCount: number;
  minTradesRequired?: number;
  isOpen: boolean;
  onToggleOpen: () => void;
  onRunAnalysis: () => Promise<boolean | void>;
  lastUpdatedAt: Date | null;
  cooldownSeconds?: number;
};

function formatCurrency(value: number): string {
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatProfitFactor(value: number | null): string {
  if (value === null) return "—";
  return value.toFixed(2);
}

function formatHoldTime(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0m";
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  if (hours <= 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function renderAnalysisLines(analysis: string) {
  const lines = analysis
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const elements: JSX.Element[] = [];

  let index = 0;
  while (index < lines.length) {
    const line = lines[index];

    if (/^\d+\)/.test(line)) {
      elements.push(
        <h4 key={`analysis-header-${index}`} className="font-semibold text-sm mt-3 first:mt-0">
          {line}
        </h4>
      );
      index += 1;
      continue;
    }

    if (/^[-*•]\s+/.test(line)) {
      const bullets: string[] = [];
      let bulletIndex = index;
      while (bulletIndex < lines.length && /^[-*•]\s+/.test(lines[bulletIndex])) {
        bullets.push(lines[bulletIndex].replace(/^[-*•]\s+/, ""));
        bulletIndex += 1;
      }

      elements.push(
        <ul key={`analysis-bullets-${index}`} className="list-disc pl-5">
          {bullets.map((bullet, bulletOffset) => (
            <li
              key={`analysis-bullet-${index}-${bulletOffset}`}
              className="text-sm text-foreground/90 leading-relaxed"
            >
              {bullet}
            </li>
          ))}
        </ul>
      );

      index = bulletIndex;
      continue;
    }

    elements.push(
      <p key={`analysis-line-${index}`} className="text-sm text-foreground/90 leading-relaxed">
        {line}
      </p>
    );
    index += 1;
  }

  return elements;
}

export function AiAnalysisPanel({
  loading,
  analysis,
  metrics,
  error,
  eligibleTradesCount,
  minTradesRequired = 5,
  isOpen,
  onToggleOpen,
  onRunAnalysis,
  lastUpdatedAt,
  cooldownSeconds = 30,
}: AiAnalysisPanelProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!lastUpdatedAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [lastUpdatedAt]);

  const cooldownRemaining = useMemo(() => {
    if (!lastUpdatedAt) return 0;
    const cooldownEnd = lastUpdatedAt.getTime() + cooldownSeconds * 1000;
    return Math.max(0, Math.ceil((cooldownEnd - now) / 1000));
  }, [cooldownSeconds, lastUpdatedAt, now]);
  const isCoolingDown = cooldownRemaining > 0;

  const isDisabled = loading || eligibleTradesCount < minTradesRequired || isCoolingDown;
  const disableReason =
    eligibleTradesCount < minTradesRequired
      ? `Minimum ${minTradesRequired} journaled trades required`
      : isCoolingDown
        ? `Ready in ${cooldownRemaining}s`
        : undefined;

  const summaryItems = useMemo(() => {
    if (!metrics) return [];
    return [
      { label: "Total Trades", value: String(metrics.totalTrades) },
      { label: "Win Rate", value: `${metrics.winRate.toFixed(1)}%` },
      { label: "Profit Factor", value: formatProfitFactor(metrics.profitFactor) },
      { label: "Avg Win", value: formatCurrency(metrics.avgWin) },
      { label: "Avg Loss", value: formatCurrency(metrics.avgLoss) },
      { label: "Avg Hold Time", value: formatHoldTime(metrics.avgHoldTimeMinutes) },
      { label: "Largest Win", value: formatCurrency(metrics.largestWin) },
      { label: "Largest Loss", value: formatCurrency(metrics.largestLoss) },
    ];
  }, [metrics]);

  const handleCopy = async () => {
    if (!analysis || !navigator?.clipboard) return;
    await navigator.clipboard.writeText(analysis);
    setCopyStatus("copied");
    setTimeout(() => setCopyStatus("idle"), 1200);
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="flex items-center gap-2 text-left"
            onClick={onToggleOpen}
          >
            <CardTitle>AI Performance Analysis</CardTitle>
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <Button
            size="sm"
            onClick={() => void onRunAnalysis()}
            disabled={isDisabled}
            title={disableReason}
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Analyzing...
              </span>
            ) : (
              "Run AI Analysis"
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {eligibleTradesCount < minTradesRequired && (
          <p className="text-xs text-muted-foreground">
            Minimum 5 journaled trades required
          </p>
        )}
        {isCoolingDown && !loading && (
          <p className="text-xs text-muted-foreground">
            Ready in {cooldownRemaining}s
          </p>
        )}

        {error && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error === "Please sign in" ? "Please sign in to run analysis." : error}
          </div>
        )}

        {summaryItems.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            {summaryItems.map((item) => (
              <div key={item.label}>
                <p className="text-muted-foreground">{item.label}</p>
                <p>{item.value}</p>
              </div>
            ))}
          </div>
        )}

        {isOpen && analysis && (
          <div className="rounded-md border border-border bg-background/40 p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">AI Coach Notes</h3>
              <Button size="sm" variant="outline" onClick={() => void handleCopy()}>
                <Copy className="h-3.5 w-3.5 mr-1" />
                {copyStatus === "copied" ? "Copied" : "Copy"}
              </Button>
            </div>
            <div className="space-y-2">{renderAnalysisLines(analysis)}</div>
            {lastUpdatedAt && (
              <p className="text-xs text-muted-foreground">
                Last updated {lastUpdatedAt.toLocaleString()}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
