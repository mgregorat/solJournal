import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { JournalEvent } from '@/lib/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isTradeJournaled(trade: Partial<JournalEvent>): boolean {
  // A trade is considered journaled if it has notes or any reflection content.
  // The presence of a flag alone does not count.
  return (
    !!trade.notes ||
    !!trade.what_went_well ||
    !!trade.what_went_wrong ||
    !!trade.what_will_i_do_differently
  );
}
