export type AnalysisSectionId =
  | "snapshot"
  | "execution"
  | "behavior"
  | "quant"
  | "simulation"
  | "plan";

export type StructuredAnalysisGoalMetric =
  | "win_rate"
  | "avg_loss"
  | "expectancy"
  | "risk_reward"
  | "streak";

export type StructuredAnalysisSection = {
  id: AnalysisSectionId;
  label: string;
  bullets: string[];
};

export type StructuredAnalysis = {
  title: string;
  one_line_summary: string;
  key_leak: {
    label: string;
    evidence: string[];
    fix: string[];
  };
  goals_next_10: Array<{
    metric: StructuredAnalysisGoalMetric;
    target: string;
    why: string;
  }>;
  sections: StructuredAnalysisSection[];
};

export type DataQualitySummary = {
  score: number;
  coverage: {
    notes_percent: number;
    tags_percent: number;
    hold_time_percent: number;
    risk_or_position_percent: number;
  };
  warnings: string[];
};

export type FeeSlippageSummary = {
  avg_fee_usd: number | null;
  avg_slippage_percent: number | null;
  slippage_over_3_percent: number;
  fees_as_percent_of_avg_win: number | null;
};
