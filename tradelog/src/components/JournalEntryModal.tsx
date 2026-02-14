"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { MultiSelect } from "@/components/ui/multi-select";
import toast from "react-hot-toast";
import { authedFetchClient, parseApiResponse } from "@/lib/authedFetch";

type JournalInitialValues = {
  notes?: string;
  tags?: string[];
  what_went_well?: string;
  what_went_wrong?: string;
  what_will_i_do_differently?: string;
  is_flagged?: boolean;
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
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNotes(initialValues.notes || "");
    setTags(initialValues.tags || []);
    setWhatWentWell(initialValues.what_went_well || "");
    setWhatWentWrong(initialValues.what_went_wrong || "");
    setWhatWillIDoDifferently(initialValues.what_will_i_do_differently || "");
  }, [open, initialValues]);

  const title = useMemo(
    () => (tokenSymbol ? `${tokenSymbol} Trade Details` : "Trade Details"),
    [tokenSymbol]
  );

  const handleSave = async () => {
    if (!walletId || !tx_hash) return;
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
        }),
      });

      const payload = await parseApiResponse<any>(response);
      const savedJournalEntry = Array.isArray(payload) ? payload[0] : payload;
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
      <DialogContent className="bg-gray-900 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <h4 className="font-semibold mb-2 text-gray-400">Trade Notes</h4>
            <Textarea
              placeholder="Add your thoughts on this trade..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
