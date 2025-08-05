import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { JournalEvent } from '@/lib/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const isTradeJournaled = (trade: JournalEvent): boolean => {
  return !!(
    trade.is_journaled ||
    trade.notes ||
    (trade.tags && trade.tags.length > 0) ||
    trade.what_went_well ||
    trade.what_went_wrong ||
    trade.what_will_i_do_differently
  );
};
