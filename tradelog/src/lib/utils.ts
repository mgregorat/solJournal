import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { JournalEvent } from '@/lib/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isTradeJournaled(trade: Partial<JournalEvent>): boolean {
  // Prefer explicit persisted journal flag when present.
  if (trade.is_journaled) return true;

  // Backward-compat fallback for legacy rows without explicit flag.
  return (
    !!trade.notes ||
    !!trade.what_went_well ||
    !!trade.what_went_wrong ||
    !!trade.what_will_i_do_differently
  );
}

export function shortenAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.substring(0, chars)}...${address.substring(address.length - chars)}`;
}
