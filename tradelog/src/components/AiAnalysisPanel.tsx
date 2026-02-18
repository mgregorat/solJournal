"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TradeMetrics } from "@/app/lib/tradeMetrics";
import type { AnalysisScope } from "@/app/hooks/useJournalAiAnalysis";
import type {
  DataQualitySummary,
  FeeSlippageSummary,
  StructuredAnalysis,
} from "@/lib/ai/structuredAnalysis";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronUp, Copy, RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  model?: string | null;
  structured?: StructuredAnalysis | null;
  analysisScope?: AnalysisScope;
  onAnalysisScopeChange?: (scope: AnalysisScope) => void;
  journaledEligibleCount?: number;
  allClosedEligibleCount?: number;
  dataQuality?: DataQualitySummary | null;
  feeSlippageSummary?: FeeSlippageSummary | null;
};

type SectionTabKey =
  | "snapshot"
  | "execution"
  | "behavior"
  | "quant"
  | "simulation"
  | "plan";

const SECTION_TABS: { key: SectionTabKey; label: string }[] = [
  { key: "snapshot", label: "Snapshot" },
  { key: "execution", label: "Execution" },
  { key: "behavior", label: "Behavior" },
  { key: "quant", label: "Quant" },
  { key: "simulation", label: "Simulation" },
  { key: "plan", label: "Action Plan" },
];

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

function parseSectionKey(heading: string): SectionTabKey | null {
  const normalized = heading.toLowerCase();
  if (normalized.includes("performance snapshot")) return "snapshot";
  if (normalized.includes("execution")) return "execution";
  if (normalized.includes("behavior")) return "behavior";
  if (normalized.includes("quant")) return "quant";
  if (normalized.includes("simulation")) return "simulation";
  if (normalized.includes("action plan")) return "plan";
  return null;
}

function parseAnalysisSections(analysis: string): Record<SectionTabKey, string[]> | null {
  const lines = analysis
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const sections: Record<SectionTabKey, string[]> = {
    snapshot: [],
    execution: [],
    behavior: [],
    quant: [],
    simulation: [],
    plan: [],
  };
  let currentSection: SectionTabKey | null = null;
  let foundHeading = false;

  for (const line of lines) {
    const headingMatch = line.match(/^\d+\)\s+(.+)$/);
    if (headingMatch) {
      currentSection = parseSectionKey(headingMatch[1]);
      foundHeading = foundHeading || currentSection !== null;
      continue;
    }

    if (currentSection && /^-\s+/.test(line)) {
      sections[currentSection].push(line.replace(/^-\s+/, ""));
      continue;
    }

    if (currentSection && /^\d+[.)]\s+/.test(line)) {
      sections[currentSection].push(line.replace(/^\d+[.)]\s+/, ""));
    }
  }

  if (!foundHeading) return null;
  return sections;
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
  model = null,
  structured = null,
  analysisScope = "JOURNALED",
  onAnalysisScopeChange,
  journaledEligibleCount,
  allClosedEligibleCount,
  dataQuality,
  feeSlippageSummary,
}: AiAnalysisPanelProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
  const [now, setNow] = useState(Date.now());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lastOpenedAnalysis, setLastOpenedAnalysis] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SectionTabKey>("snapshot");

  useEffect(() => {
    if (!lastUpdatedAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [lastUpdatedAt]);

  useEffect(() => {
    if (!analysis || analysis === lastOpenedAnalysis) return;
    setIsModalOpen(true);
    setLastOpenedAnalysis(analysis);
  }, [analysis, lastOpenedAnalysis]);

  const parsedSections = useMemo(() => {
    if (structured && structured.sections.length > 0) {
      const mapped: Record<SectionTabKey, string[]> = {
        snapshot: [],
        execution: [],
        behavior: [],
        quant: [],
        simulation: [],
        plan: [],
      };
      for (const section of structured.sections) {
        mapped[section.id] = section.bullets;
      }
      return mapped;
    }

    if (analysis) {
      return parseAnalysisSections(analysis);
    }
    return null;
  }, [analysis, structured]);

  const cooldownRemaining = useMemo(() => {
    if (!lastUpdatedAt) return 0;
    const cooldownEnd = lastUpdatedAt.getTime() + cooldownSeconds * 1000;
    return Math.max(0, Math.ceil((cooldownEnd - now) / 1000));
  }, [cooldownSeconds, lastUpdatedAt, now]);
  const isCoolingDown = cooldownRemaining > 0;

  const effectiveEligibleTradesCount =
    analysisScope === "ALL"
      ? (allClosedEligibleCount ?? eligibleTradesCount)
      : (journaledEligibleCount ?? eligibleTradesCount);

  const isDisabled = loading || effectiveEligibleTradesCount < minTradesRequired || isCoolingDown;
  const disableReason =
    effectiveEligibleTradesCount < minTradesRequired
      ? `Minimum ${minTradesRequired} ${
          analysisScope === "JOURNALED" ? "journaled" : "closed"
        } trades required`
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
    if (!navigator?.clipboard) return;
    const copyText = structured
      ? [
          structured.title,
          structured.one_line_summary,
          "",
          `Key Leak: ${structured.key_leak.label}`,
          "Evidence:",
          ...structured.key_leak.evidence.map((item) => `- ${item}`),
          "Fix:",
          ...structured.key_leak.fix.map((item) => `- ${item}`),
          "",
          "Goals (Next 10 Trades):",
          ...structured.goals_next_10.map(
            (goal) => `- ${goal.metric}: ${goal.target} (${goal.why})`
          ),
          "",
          ...structured.sections.flatMap((section) => [
            section.label,
            ...section.bullets.map((bullet) => `- ${bullet}`),
            "",
          ]),
        ]
          .join("\n")
          .trim()
      : analysis;

    if (!copyText) return;
    await navigator.clipboard.writeText(copyText);
    setCopyStatus("copied");
    setTimeout(() => setCopyStatus("idle"), 1200);
  };

  const handleRegenerate = async () => {
    await onRunAnalysis();
  };

  return (
    <>
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
          {effectiveEligibleTradesCount < minTradesRequired && (
            <p className="text-xs text-muted-foreground">
              {analysisScope === "JOURNALED"
                ? "Minimum 5 journaled trades required"
                : "Minimum 5 closed trades required"}
            </p>
          )}
          <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/40 px-3 py-2">
            <div className="space-y-0.5">
              <Label htmlFor="analysis-scope-select" className="text-xs">
                Analysis Scope
              </Label>
              <p className="text-[11px] text-muted-foreground">
                {analysisScope === "JOURNALED"
                  ? `${journaledEligibleCount ?? eligibleTradesCount} eligible trades`
                  : `${allClosedEligibleCount ?? eligibleTradesCount} eligible trades`}
              </p>
            </div>
            <Select
              value={analysisScope}
              onValueChange={(value) => onAnalysisScopeChange?.(value as AnalysisScope)}
            >
              <SelectTrigger id="analysis-scope-select" className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="JOURNALED">Journaled only (best)</SelectItem>
                <SelectItem value="ALL">All closed trades (fast)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {dataQuality && (
            <div className="rounded-md border border-border bg-background/40 px-3 py-2 text-sm">
              <p>
                Data quality: <span className="font-medium">{Math.round(dataQuality.score)}/100</span>
              </p>
              {dataQuality.score < 50 && (
                <p className="mt-1 text-yellow-300 text-xs">
                  Journal 5 more trades with risk% + exit plan for better coaching
                </p>
              )}
            </div>
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

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>AI Coach Review</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {model ? `Model: ${model}` : "Model unavailable"}
            </p>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto rounded-md border border-border bg-background/40 p-4 space-y-3">
            {structured && (
              <div className="space-y-3 rounded-md border border-border bg-background/60 p-3">
                <p className="text-base font-semibold">{structured.one_line_summary}</p>
                <div className="rounded-md border border-border bg-background/40 p-3 space-y-2">
                  <p className="text-sm font-medium">Key Leak: {structured.key_leak.label}</p>
                  <div className="text-sm">
                    <p className="font-medium">Evidence</p>
                    <ul className="list-disc pl-5">
                      {structured.key_leak.evidence.map((item, idx) => (
                        <li key={`evidence-${idx}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="text-sm">
                    <p className="font-medium">Fix</p>
                    <ul className="list-disc pl-5">
                      {structured.key_leak.fix.map((item, idx) => (
                        <li key={`fix-${idx}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium">Goals (Next 10 Trades)</p>
                  <ul className="list-disc pl-5 text-sm">
                    {structured.goals_next_10.map((goal, idx) => (
                      <li key={`goal-${idx}`}>
                        <span className="font-medium">{goal.metric}</span>: {goal.target} - {goal.why}
                      </li>
                    ))}
                  </ul>
                </div>
                {feeSlippageSummary && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div className="rounded border border-border px-2 py-1">
                      Avg fee/trade:{" "}
                      {feeSlippageSummary.avg_fee_usd === null
                        ? "—"
                        : formatCurrency(feeSlippageSummary.avg_fee_usd)}
                    </div>
                    <div className="rounded border border-border px-2 py-1">
                      Avg slippage:{" "}
                      {feeSlippageSummary.avg_slippage_percent === null
                        ? "—"
                        : `${feeSlippageSummary.avg_slippage_percent.toFixed(2)}%`}
                    </div>
                    <div className="rounded border border-border px-2 py-1">
                      Fees vs avg win:{" "}
                      {feeSlippageSummary.fees_as_percent_of_avg_win === null
                        ? "—"
                        : `${feeSlippageSummary.fees_as_percent_of_avg_win.toFixed(1)}%`}
                    </div>
                  </div>
                )}
              </div>
            )}
            {parsedSections ? (
              <Tabs
                value={activeTab}
                onValueChange={(value) => setActiveTab(value as SectionTabKey)}
                className="space-y-3"
              >
                <TabsList className="w-full justify-start overflow-x-auto">
                  {SECTION_TABS.map((section) => (
                    <TabsTrigger key={section.key} value={section.key}>
                      {section.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {SECTION_TABS.map((section) => (
                  <TabsContent key={section.key} value={section.key}>
                    {parsedSections[section.key].length > 0 ? (
                      <ul className="list-disc pl-5 space-y-2">
                        {parsedSections[section.key].map((bullet, bulletIndex) => (
                          <li
                            key={`${section.key}-${bulletIndex}`}
                            className="text-sm text-foreground/90 leading-relaxed"
                          >
                            {bullet}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No bullets generated for this section. Regenerate or add more journal details.
                      </p>
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            ) : analysis ? (
              <div className="space-y-2">{renderAnalysisLines(analysis)}</div>
            ) : null}
            {analysis && (
              <p className="text-xs text-muted-foreground">
                {lastUpdatedAt ? `Generated ${lastUpdatedAt.toLocaleTimeString()}` : "Generated just now"}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Close
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleCopy()}
              disabled={!analysis}
            >
              <Copy className="h-3.5 w-3.5 mr-1" />
              {copyStatus === "copied" ? "Copied" : "Copy"}
            </Button>
            <Button onClick={() => void handleRegenerate()} disabled={isDisabled}>
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Analyzing...
                </span>
              ) : (
                "Regenerate"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
