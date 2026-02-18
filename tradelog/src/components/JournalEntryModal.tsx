"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import toast from "react-hot-toast";
import { authedFetchClient, parseApiResponse } from "@/lib/authedFetch";
import { ChevronDown, ChevronUp, Info } from "lucide-react";

type JournalInitialValues = {
  notes?: string;
  tags?: string[];
  what_went_well?: string;
  what_went_wrong?: string;
  what_will_i_do_differently?: string;
  is_flagged?: boolean;
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
};

type JournalEntryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: number;
  walletId: number;
  tx_hash: string;
  initialValues: JournalInitialValues;
  onSaved?: (savedJournalEntry: any) => void;
  tokenSymbol?: string;
  tradeDate?: string;
  sellTxHash?: string;
};

const tagOptions = [
  { label: "Scalp", value: "Scalp" },
  { label: "Swing", value: "Swing" },
  { label: "Long-Term", value: "Long-Term" },
  { label: "Alpha Call", value: "Alpha Call" },
  { label: "FOMO", value: "FOMO" },
  { label: "Exit Early", value: "Exit Early" },
  { label: "Hype", value: "Hype" },
  { label: "Rug", value: "Rug" },
  { label: "Success", value: "Success" },
  { label: "Mistake", value: "Mistake" },
];

const setupTagOptions = [
  "pumpfun_graduation_dip",
  "breakout",
  "reversal",
  "cto_takeover",
  "influencer_call",
  "fresh_launch",
  "liquidity_spike",
  "other",
];

const stopTypeOptions = ["hard_stop", "mental_stop", "structure", "none"];

function InfoHint({ text }: { text: string }) {
  return (
    <button
      type="button"
      className="inline-flex items-center text-gray-500 hover:text-gray-300"
      title={text}
      aria-label={text}
    >
      <Info className="h-3.5 w-3.5" />
    </button>
  );
}

export function JournalEntryModal({
  open,
  onOpenChange,
  userId,
  walletId,
  tx_hash,
  initialValues,
  onSaved,
  tokenSymbol,
  tradeDate,
  sellTxHash,
}: JournalEntryModalProps) {
  const { getAccessToken } = usePrivy();
  const getBearerToken = async () => (await getAccessToken?.()) || null;
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [whatWentWell, setWhatWentWell] = useState("");
  const [whatWentWrong, setWhatWentWrong] = useState("");
  const [whatWillIDoDifferently, setWhatWillIDoDifferently] = useState("");
  const [setupTag, setSetupTag] = useState<string>("other");
  const [entryReason, setEntryReason] = useState("");
  const [entryDelaySeconds, setEntryDelaySeconds] = useState("");
  const [positionSizeUsd, setPositionSizeUsd] = useState("");
  const [positionSizeSol, setPositionSizeSol] = useState("");
  const [walletEquityAtEntryUsd, setWalletEquityAtEntryUsd] = useState("");
  const [riskPctOfWallet, setRiskPctOfWallet] = useState("");
  const [maePercent, setMaePercent] = useState("");
  const [mfePercent, setMfePercent] = useState("");
  const [timeOfDayBucket, setTimeOfDayBucket] = useState<string>("us_am");
  const [exitPlan, setExitPlan] = useState("");
  const [didFollowPlan, setDidFollowPlan] = useState<string>("unknown");
  const [stopType, setStopType] = useState<string>("none");
  const [takeProfitRules, setTakeProfitRules] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNotes(initialValues.notes || "");
    setTags(initialValues.tags || []);
    setWhatWentWell(initialValues.what_went_well || "");
    setWhatWentWrong(initialValues.what_went_wrong || "");
    setWhatWillIDoDifferently(initialValues.what_will_i_do_differently || "");
    setSetupTag(initialValues.setup_tag || "other");
    setEntryReason(initialValues.entry_reason || "");
    setEntryDelaySeconds(
      typeof initialValues.entry_delay_seconds === "number"
        ? String(initialValues.entry_delay_seconds)
        : ""
    );
    setPositionSizeUsd(
      typeof initialValues.position_size_usd === "number" ? String(initialValues.position_size_usd) : ""
    );
    setPositionSizeSol(
      typeof initialValues.position_size_sol === "number" ? String(initialValues.position_size_sol) : ""
    );
    setWalletEquityAtEntryUsd(
      typeof initialValues.wallet_equity_usd_at_entry === "number"
        ? String(initialValues.wallet_equity_usd_at_entry)
        : ""
    );
    setRiskPctOfWallet(
      typeof initialValues.risk_pct_of_wallet === "number" ? String(initialValues.risk_pct_of_wallet) : ""
    );
    setMaePercent(typeof initialValues.mae_percent === "number" ? String(initialValues.mae_percent) : "");
    setMfePercent(typeof initialValues.mfe_percent === "number" ? String(initialValues.mfe_percent) : "");
    setTimeOfDayBucket(initialValues.time_of_day_bucket || "us_am");
    setExitPlan(initialValues.exit_plan || "");
    setDidFollowPlan(
      typeof initialValues.did_follow_plan === "boolean"
        ? initialValues.did_follow_plan
          ? "yes"
          : "no"
        : "unknown"
    );
    setStopType(initialValues.stop_type || "none");
    setTakeProfitRules(initialValues.take_profit_rules || "");
  }, [open, initialValues]);

  const title = useMemo(
    () => (tokenSymbol ? `${tokenSymbol} Trade Details` : "Trade Details"),
    [tokenSymbol]
  );

  const computedRiskPctDisplay = useMemo(() => {
    const parsed = Number(riskPctOfWallet);
    if (!Number.isFinite(parsed)) {
      return "—";
    }
    return `${parsed.toFixed(2)}%`;
  }, [riskPctOfWallet]);

  const showPositionSizeSolField = useMemo(
    () => positionSizeSol.trim().length > 0 || typeof initialValues.position_size_sol === "number",
    [initialValues.position_size_sol, positionSizeSol]
  );

  const handleSave = async () => {
    if (!walletId || !tx_hash) return;
    const parseNumeric = (value: string): number | undefined => {
      if (!value.trim()) return undefined;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    };

    const parsedPositionSizeUsd = parseNumeric(positionSizeUsd);
    const parsedWalletEquityAtEntryUsd = parseNumeric(walletEquityAtEntryUsd);
    const computedRiskPct = parseNumeric(riskPctOfWallet);

    setIsSaving(true);
    try {
      const response = await authedFetchClient(getBearerToken, "/api/journal/flag", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tx_hash,
          walletId,
          is_journaled: true,
          is_flagged: initialValues.is_flagged,
          notes,
          tags,
          what_went_well: whatWentWell,
          what_went_wrong: whatWentWrong,
          what_will_i_do_differently: whatWillIDoDifferently,
          setup_tag: setupTag || undefined,
          entry_reason: entryReason || undefined,
          entry_delay_seconds: parseNumeric(entryDelaySeconds),
          position_size_usd: parsedPositionSizeUsd,
          position_size_sol: parseNumeric(positionSizeSol),
          wallet_equity_usd_at_entry: parsedWalletEquityAtEntryUsd,
          risk_pct_of_wallet: computedRiskPct,
          mae_percent: parseNumeric(maePercent),
          mfe_percent: parseNumeric(mfePercent),
          time_of_day_bucket: timeOfDayBucket || undefined,
          exit_plan: exitPlan || undefined,
          did_follow_plan:
            didFollowPlan === "yes" ? true : didFollowPlan === "no" ? false : undefined,
          stop_type: stopType || undefined,
          take_profit_rules: takeProfitRules || undefined,
        }),
      });

      const payload = await parseApiResponse<any>(response);
      const normalizedPayload = payload?.journalEntry ?? payload;
      const savedJournalEntry = Array.isArray(normalizedPayload) ? normalizedPayload[0] : normalizedPayload;
      if (!savedJournalEntry) {
        throw new Error("Save returned no journal entry");
      }

      onSaved?.(savedJournalEntry);
      toast.success("Saved");
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || "Failed to save journal entry");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-700 text-white max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="rounded-md border border-gray-700 p-3 space-y-3">
            <h4 className="font-semibold text-gray-300">Minimum Viable Journal</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-sm text-gray-400 mb-1">Setup Tag</p>
                <Select value={setupTag} onValueChange={setSetupTag}>
                  <SelectTrigger className="bg-gray-800 border-gray-600">
                    <SelectValue placeholder="Select setup" />
                  </SelectTrigger>
                  <SelectContent>
                    {setupTagOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">Followed Exit Plan?</p>
                <Select value={didFollowPlan} onValueChange={setDidFollowPlan}>
                  <SelectTrigger className="bg-gray-800 border-gray-600">
                    <SelectValue placeholder="Select answer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">Entry Reason (short)</p>
              <Input
                placeholder="Why did you enter this trade?"
                value={entryReason}
                onChange={(e) => setEntryReason(e.target.value)}
                className="bg-gray-800 border-gray-600"
              />
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-gray-400">What went well?</h4>
              <Textarea
                placeholder="What went well with this trade?"
                value={whatWentWell}
                onChange={(e) => setWhatWentWell(e.target.value)}
                className="bg-gray-800 border-gray-600"
              />
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-gray-400">What went wrong?</h4>
              <Textarea
                placeholder="What went wrong with this trade?"
                value={whatWentWrong}
                onChange={(e) => setWhatWentWrong(e.target.value)}
                className="bg-gray-800 border-gray-600"
              />
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-gray-400">What will you do differently?</h4>
              <Textarea
                placeholder="What will you do differently next time?"
                value={whatWillIDoDifferently}
                onChange={(e) => setWhatWillIDoDifferently(e.target.value)}
                className="bg-gray-800 border-gray-600"
              />
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-gray-400">Tags (up to 5)</h4>
              <MultiSelect
                options={tagOptions}
                onValueChange={(value) => {
                  if (value.length <= 5) setTags(value);
                }}
                defaultValue={tags}
                placeholder="Select up to 5 tags..."
                className="w-full"
              />
            </div>
          </div>

          <div className="rounded-md border border-gray-700 p-3 space-y-3">
            <button
              type="button"
              className="w-full flex items-center justify-between text-left"
              onClick={() => setIsAdvancedOpen((prev) => !prev)}
              aria-expanded={isAdvancedOpen}
              aria-controls="journal-advanced-fields"
            >
              <span className="font-semibold text-gray-300">Advanced (optional)</span>
              {isAdvancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {isAdvancedOpen && (
              <div id="journal-advanced-fields" className="space-y-3">
                <div>
                  <div className="mb-2 flex items-center gap-1">
                    <h4 className="font-semibold text-gray-400">Trade Notes</h4>
                    <InfoHint text="Freeform context for this trade. AI uses this to identify behavioral patterns and setup execution details." />
                  </div>
                  <Textarea
                    placeholder="Add your thoughts on this trade..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="bg-gray-800 border-gray-600"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="mb-1 flex items-center gap-1">
                      <p className="text-sm text-gray-400">Stop Type</p>
                      <InfoHint text="Defines how risk was controlled: hard stop, mental stop, structure, or none." />
                    </div>
                    <Select value={stopType} onValueChange={setStopType}>
                      <SelectTrigger className="bg-gray-800 border-gray-600">
                        <SelectValue placeholder="Select stop type" />
                      </SelectTrigger>
                      <SelectContent>
                        {stopTypeOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center gap-1">
                      <p className="text-sm text-gray-400">Time of day bucket</p>
                      <InfoHint text="Tracks session timing (Asia/EU/US) to find when your edge is strongest." />
                    </div>
                    <Select value={timeOfDayBucket} onValueChange={setTimeOfDayBucket}>
                      <SelectTrigger className="bg-gray-800 border-gray-600">
                        <SelectValue placeholder="Select bucket" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asia">Asia</SelectItem>
                        <SelectItem value="eu">EU</SelectItem>
                        <SelectItem value="us_am">US AM</SelectItem>
                        <SelectItem value="us_pm">US PM</SelectItem>
                        <SelectItem value="late_night">Late night</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center gap-1">
                      <p className="text-sm text-gray-400">Position size (USD)</p>
                      <InfoHint text="Dollar amount allocated to the trade. Used for sizing discipline and risk consistency analytics." />
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Position size (USD)"
                      value={positionSizeUsd}
                      onChange={(e) => setPositionSizeUsd(e.target.value)}
                      className="bg-gray-800 border-gray-600"
                    />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center gap-1">
                      <p className="text-sm text-gray-400">Wallet equity at entry (USD)</p>
                      <InfoHint text="Estimated wallet value when entering this trade. Allows risk% normalization across trades." />
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Wallet equity at entry (USD)"
                      value={walletEquityAtEntryUsd}
                      onChange={(e) => setWalletEquityAtEntryUsd(e.target.value)}
                      className="bg-gray-800 border-gray-600"
                    />
                  </div>
                  {showPositionSizeSolField && (
                    <div>
                      <div className="mb-1 flex items-center gap-1">
                        <p className="text-sm text-gray-400">Position size (SOL)</p>
                        <InfoHint text="Native SOL size for the position. Useful when sizing in SOL rather than USD." />
                      </div>
                      <Input
                        type="number"
                        step="0.0001"
                        placeholder="Position size (SOL)"
                        value={positionSizeSol}
                        onChange={(e) => setPositionSizeSol(e.target.value)}
                        className="bg-gray-800 border-gray-600"
                      />
                    </div>
                  )}
                  <div>
                    <div className="mb-1 flex items-center gap-1">
                      <p className="text-sm text-gray-400">Risk % of wallet</p>
                      <InfoHint text="Percent of wallet at risk for this trade. Drives R-multiple and risk-discipline coaching." />
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Risk % of wallet"
                      value={riskPctOfWallet}
                      onChange={(e) => setRiskPctOfWallet(e.target.value)}
                      className="bg-gray-800 border-gray-600"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Risk % of wallet powers R-multiple and discipline coaching.
                </p>
                <div className="rounded-md border border-gray-700 bg-gray-900/50 px-3 py-2">
                  <p className="text-xs text-gray-400">Current Risk %</p>
                  <p className="text-sm text-gray-200">{computedRiskPctDisplay}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <div className="mb-1 flex items-center gap-1">
                      <p className="text-sm text-gray-400">Entry delay (seconds)</p>
                      <InfoHint text="How late you entered relative to when the setup first appeared. Helps identify chasing behavior." />
                    </div>
                    <Input
                      type="number"
                      step="1"
                      placeholder="Entry delay (seconds)"
                      value={entryDelaySeconds}
                      onChange={(e) => setEntryDelaySeconds(e.target.value)}
                      className="bg-gray-800 border-gray-600"
                    />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center gap-1">
                      <p className="text-sm text-gray-400">MAE %</p>
                      <InfoHint text="Maximum adverse excursion. Worst drawdown during trade before exit." />
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="MAE %"
                      value={maePercent}
                      onChange={(e) => setMaePercent(e.target.value)}
                      className="bg-gray-800 border-gray-600"
                    />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center gap-1">
                      <p className="text-sm text-gray-400">MFE %</p>
                      <InfoHint text="Maximum favorable excursion. Best unrealized gain during trade before exit." />
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="MFE %"
                      value={mfePercent}
                      onChange={(e) => setMfePercent(e.target.value)}
                      className="bg-gray-800 border-gray-600"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  MAE/MFE powers execution, stop-loss, and take-profit coaching.
                </p>
                <div>
                  <div className="mb-1 flex items-center gap-1">
                    <p className="text-sm text-gray-400">Exit plan</p>
                    <InfoHint text="Pre-defined conditions for scaling out or exiting. Used to measure plan-following discipline." />
                  </div>
                  <Textarea
                    placeholder="Exit plan"
                    value={exitPlan}
                    onChange={(e) => setExitPlan(e.target.value)}
                    className="bg-gray-800 border-gray-600"
                  />
                </div>
                <div>
                  <div className="mb-1 flex items-center gap-1">
                    <p className="text-sm text-gray-400">Take profit rules</p>
                    <InfoHint text="Specific take-profit framework (partials, trail, targets). Helps coach winner management." />
                  </div>
                  <Textarea
                    placeholder="Take profit rules (optional)"
                    value={takeProfitRules}
                    onChange={(e) => setTakeProfitRules(e.target.value)}
                    className="bg-gray-800 border-gray-600"
                  />
                </div>
              </div>
            )}
          </div>

          {tradeDate && (
            <div className="text-xs text-gray-500 pt-4 border-t border-gray-700">
              <p>Sold on {new Date(tradeDate).toLocaleString()}</p>
              {sellTxHash && (
                <a
                  href={`https://solscan.io/tx/${sellTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  View Sale on Solscan
                </a>
              )}
            </div>
          )}
        </div>

        <Button onClick={handleSave} className="mt-4" disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
