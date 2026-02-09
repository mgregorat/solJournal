import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import { Trade } from '@/lib/types';
import { isTradeJournaled } from '@/lib/utils'; // Make sure this is imported

export const dynamic = 'force-dynamic';

interface JournalEvent {
  id: string;
  status: 'CLOSED' | 'OPEN';
  token_symbol: string;
  token_logo?: string;
  token_address: string;
  date: string;
  sell_value_usd?: number;
  cost_basis_usd?: number;
  realized_pnl_usd?: number;
  realized_pnl_percent?: number;
  sell_tx_hash?: string;
  held_amount?: number;
  avg_buy_price?: number;
  total_cost?: number;
  current_price?: number;
  current_value_usd?: number;
  unrealized_pnl_usd?: number;
  unrealized_pnl_percent?: number;
  notes?: string;
  tags?: string[];
  is_flagged?: boolean;
  journal_entry_id?: string;
  what_went_well?: string;
  what_went_wrong?: string;
  what_will_i_do_differently?: string;
  is_journaled?: boolean;
}

interface EnrichedTrade extends Trade {
    notes?: string;
    tags?: string[];
    is_flagged?: boolean;
    journal_entry_id?: string;
    what_went_well?: string;
    what_went_wrong?: string;
    what_will_i_do_differently?: string;
    is_journaled?: boolean;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userIdStr = searchParams.get('userId');
    const walletAddress = searchParams.get('walletAddress');

    if (!userIdStr || !walletAddress) {
        return NextResponse.json({ error: 'userId and walletAddress are required' }, { status: 400 });
    }

    const userId = parseInt(userIdStr, 10);
    if (isNaN(userId)) {
        return NextResponse.json({ error: 'Invalid userId format' }, { status: 400 });
    }

    try {
        console.log(`Fetching data for user: ${userId}, wallet: ${walletAddress}`);

        const [{ data: trades, error: tradesError }, { data: allJournalEntries, error: journalError }] = await Promise.all([
            supabaseAdmin
                .from('trades')
                .select('*')
                .eq('user_id', userId)
                .eq('wallet_address', walletAddress)
                .order('trade_date', { ascending: true }),
            supabaseAdmin
                .from('journal_entries')
                .select('*')
                .order('created_at', { ascending: false })
        ]);

        // Filter journal entries client-side since server-side eq() filtering isn't working
        const journalEntries = (allJournalEntries?.filter(entry => entry.user_id === userId) || []) as any[];

        if (tradesError) throw tradesError;
        if (journalError) throw journalError;

        console.log(`[JOURNAL-ACTIVITY] Fetched ${trades?.length || 0} trades and ${allJournalEntries?.length || 0} total journal entries.`);
        console.log(`[JOURNAL-ACTIVITY] Raw journal entries:`, allJournalEntries);
        console.log(`[JOURNAL-ACTIVITY] After client-side filtering: ${journalEntries.length} journal entries for user ${userId}`);
        console.log(`[JOURNAL-ACTIVITY] Filtered journal entries:`, journalEntries);

        const journalMap: Record<string, any> = journalEntries.reduce((acc, entry) => {
            acc[entry.tx_hash as string] = entry;
            return acc;
        }, {} as Record<string, any>);

        console.log(`[JOURNAL-ACTIVITY] Journal Map created with ${Object.keys(journalMap).length} entries`);
        if (Object.keys(journalMap).length > 0) {
            console.log(`[JOURNAL-ACTIVITY] Journal Map keys:`, Object.keys(journalMap));
        }

        const tradesWithJournalData = trades.map(t => {
            const journalEntry = journalMap[t.tx_hash as string];
            const enrichedTrade = {
                ...t,
                notes: journalEntry?.notes,
                tags: journalEntry?.tags || [],
                is_flagged: journalEntry?.is_flagged || false,
                journal_entry_id: journalEntry?.id,
                what_went_well: journalEntry?.what_went_well,
                what_went_wrong: journalEntry?.what_went_wrong,
                what_will_i_do_differently: journalEntry?.what_will_i_do_differently,
                is_journaled: false // Default to false
            };

            // Use the new, stricter definition of "journaled"
            enrichedTrade.is_journaled = isTradeJournaled(enrichedTrade);
            
            return enrichedTrade;
        }) as EnrichedTrade[];

        const tradesWithNotesCount = tradesWithJournalData.filter(t => t.notes).length;
        console.log(`Total trades with notes after merge: ${tradesWithNotesCount}`);

        const tradesByToken = tradesWithJournalData.reduce((acc, trade) => {
            if (!acc[trade.token_address]) acc[trade.token_address] = [];
            acc[trade.token_address].push(trade);
            return acc;
        }, {} as Record<string, EnrichedTrade[]>);

        const journalEvents: JournalEvent[] = [];
        const openPositionTokens: string[] = [];

        for (const tokenAddress in tradesByToken) {
            let totalAmount = 0;
            let totalCost = 0;
            let lastBuyDate = '';
            const journaledBuys = new Map<string, { notes: string[], tags: Set<string> }>();

            for (const trade of tradesByToken[tokenAddress]) {
                if (trade.event_type === 'buy') {
                    totalAmount += trade.token_amount;
                    totalCost += trade.cost_usd;
                    lastBuyDate = trade.trade_date;

                    if (trade.notes || (trade.tags && trade.tags.length > 0)) {
                        if (!journaledBuys.has(tokenAddress)) {
                            journaledBuys.set(tokenAddress, { notes: [], tags: new Set() });
                        }
                        const entry = journaledBuys.get(tokenAddress)!;
                        if (trade.notes) entry.notes.push(trade.notes);
                        trade.tags?.forEach((tag: string) => entry.tags.add(tag));
                    }

                } else if (trade.event_type === 'sell' && totalAmount > 0) {
                    const avgBuyPrice = totalCost / totalAmount;
                    const costForThisSell = avgBuyPrice * trade.token_amount;
                    const pnl = trade.cost_usd - costForThisSell;

                    const aggregatedNotes = journaledBuys.get(tokenAddress)?.notes.join('\n\n') || '';
                    const aggregatedTags = Array.from(journaledBuys.get(tokenAddress)?.tags || []);

                    const eventToPush: JournalEvent = {
                        id: trade.transaction_hash,
                        transaction_hash: trade.transaction_hash,
                        wallet_id: trade.wallet_id,
                        status: 'CLOSED',
                        token_symbol: trade.token_symbol,
                        token_logo: trade.token_logo,
                        token_address: trade.token_address,
                        date: trade.trade_date,
                        sell_value_usd: trade.cost_usd,
                        cost_basis_usd: costForThisSell,
                        realized_pnl_usd: pnl,
                        realized_pnl_percent: costForThisSell > 0 ? (pnl / costForThisSell) * 100 : 0,
                        sell_tx_hash: trade.transaction_hash,
                        notes: trade.notes || aggregatedNotes,
                        tags: [...new Set([...(trade.tags || []), ...aggregatedTags])],
                        is_flagged: trade.is_flagged,
                        journal_entry_id: trade.journal_entry_id,
                        what_went_well: trade.what_went_well,
                        what_went_wrong: trade.what_went_wrong,
                        what_will_i_do_differently: trade.what_will_i_do_differently,
                        is_journaled: trade.is_journaled,
                    };

                    console.log(`Creating CLOSED event for ${trade.tx_hash}. Notes: ${eventToPush.notes}`);
                    journalEvents.push(eventToPush);

                    totalCost -= costForThisSell;
                    totalAmount -= trade.token_amount;

                    if (totalAmount < 1e-9) {
                        journaledBuys.delete(tokenAddress);
                    }
                }
            }

            if (totalAmount > 1e-9) {
                openPositionTokens.push(tokenAddress);
                const firstTrade = tradesByToken[tokenAddress][0];
                journalEvents.push({
                    id: tokenAddress,
                    transaction_hash: undefined,
                    wallet_id: firstTrade.wallet_id,
                    status: 'OPEN',
                    token_symbol: firstTrade.token_symbol,
                    token_logo: firstTrade.token_logo,
                    token_address: tokenAddress,
                    date: lastBuyDate,
                    held_amount: totalAmount,
                    avg_buy_price: totalCost / totalAmount,
                    total_cost: totalCost,
                    notes: undefined,
                    tags: [],
                    is_flagged: false,
                    is_journaled: false,
                });
            }
        }

        if (openPositionTokens.length > 0) {
            const priceUrl = `https://api.dexscreener.com/latest/dex/tokens/${openPositionTokens.join(',')}`;
            const priceResponse = await fetch(priceUrl);
            const priceData = await priceResponse.json();
            const priceMap = (priceData.pairs || []).reduce((acc: any, pair: any) => {
                acc[pair.baseToken.address] = parseFloat(pair.priceUsd);
                return acc;
            }, {} as Record<string, number>);

            for (const event of journalEvents) {
                if (event.status === 'OPEN' && priceMap[event.token_address]) {
                    event.current_price = priceMap[event.token_address];
                    if (event.held_amount && event.current_price) {
                        event.current_value_usd = event.held_amount * event.current_price;
                        if (event.total_cost) {
                            event.unrealized_pnl_usd = event.current_value_usd - event.total_cost;
                            event.unrealized_pnl_percent = (event.unrealized_pnl_usd / event.total_cost) * 100;
                        }
                    }
                }
            }
        }

        const sortedEvents = journalEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        sortedEvents.forEach(event => {
          if (!event.tags) {
            event.tags = [];
          }
        });

        return NextResponse.json(sortedEvents);

    } catch (error: any) {
        console.error(`An error occurred during P&L calculation for user ${userId}:`, error);
        return NextResponse.json({ error: 'Failed to calculate P&L', details: error.message }, { status: 500 });
    }
} 