import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import { isTradeJournaled } from '@/lib/utils'; // Make sure this is imported

export const dynamic = 'force-dynamic';

interface JournalEvent {
  id: string;
  transaction_hash?: string;
  wallet_id?: number;
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

interface EnrichedTrade {
    transaction_hash?: string;
    trade_date: string;
    event_type: 'buy' | 'sell';
    token_address: string;
    token_symbol: string;
    token_logo?: string;
    token_amount: number;
    cost_usd: number;
    price_usd: number;
    wallet_id?: number;
    trade_type?: 'buy' | 'sell';
    amount?: number;
    total_value?: number;
    price?: number;
    tx_hash?: string;
    tags?: string[];
    notes?: string;
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
    const walletIdStr = searchParams.get('walletId');

    if (!userIdStr || !walletAddress) {
        return NextResponse.json({ error: 'userId and walletAddress are required' }, { status: 400 });
    }

    const userId = parseInt(userIdStr, 10);
    if (isNaN(userId)) {
        return NextResponse.json({ error: 'Invalid userId format' }, { status: 400 });
    }

    try {
        console.log(`Fetching data for user: ${userId}, wallet: ${walletAddress}, walletId: ${walletIdStr || 'All'}`);

        let tradesQuery = supabaseAdmin
            .from('trades')
            .select('*')
            .eq('user_id', userId)
            .order('trade_date', { ascending: true });

        if (walletIdStr) {
            const walletId = parseInt(walletIdStr, 10);
            if (!isNaN(walletId)) {
                tradesQuery = tradesQuery.eq('wallet_id', walletId);
            }
        }

        const [{ data: trades, error: tradesError }, { data: allJournalEntries, error: journalError }] = await Promise.all([
            tradesQuery,
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
            if (entry?.tx_hash) {
                acc[entry.tx_hash as string] = entry;
            }
            return acc;
        }, {} as Record<string, any>);

        console.log(`[JOURNAL-ACTIVITY] Journal Map created with ${Object.keys(journalMap).length} entries`);
        if (Object.keys(journalMap).length > 0) {
            console.log(`[JOURNAL-ACTIVITY] Journal Map keys:`, Object.keys(journalMap));
        }

        const normalizedTrades: EnrichedTrade[] = (trades || []).map((t: any) => {
            const transaction_hash = (t.transaction_hash || t.tx_hash) as string | undefined;
            const event_type = (t.event_type || t.trade_type) as 'buy' | 'sell' | undefined;
            const token_amount = Number(t.token_amount ?? t.amount ?? 0);
            const cost_usd = Number(t.cost_usd ?? t.total_value ?? 0);
            const price_usd = Number(t.price_usd ?? t.price ?? (token_amount > 0 ? cost_usd / token_amount : 0));
            const trade_date = (t.trade_date || t.created_at || new Date().toISOString()) as string;
            return {
                ...t,
                transaction_hash,
                event_type,
                token_amount,
                cost_usd,
                price_usd,
                trade_date,
            };
        }).filter((t: EnrichedTrade) => !!t.token_address && !!t.event_type);

        const tradesWithJournalData = normalizedTrades.map(t => {
            const journalEntry = t.transaction_hash ? journalMap[t.transaction_hash] : undefined;
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
            enrichedTrade.is_journaled = isTradeJournaled({
                notes: enrichedTrade.notes,
                what_went_well: enrichedTrade.what_went_well,
                what_went_wrong: enrichedTrade.what_went_wrong,
                what_will_i_do_differently: enrichedTrade.what_will_i_do_differently,
            });
            
            return enrichedTrade;
        }) as EnrichedTrade[];

        const tradesWithNotesCount = tradesWithJournalData.filter(t => t.notes).length;
        console.log(`Total trades with notes after merge: ${tradesWithNotesCount}`);

        const tradesByToken = tradesWithJournalData.reduce((acc, trade) => {
            if (!acc[trade.token_address]) acc[trade.token_address] = [];
            acc[trade.token_address].push(trade);
            return acc;
        }, {} as Record<string, EnrichedTrade[]>);

        let journalEvents: JournalEvent[] = [];
        const openPositionTokens: string[] = [];

        for (const tokenAddress in tradesByToken) {
            let totalAmount = 0;
            let totalCost = 0;
            let lastBuyDate = '';
            const journaledBuys = new Map<string, { notes: string[], tags: Set<string> }>();

            const tokenTrades = [...tradesByToken[tokenAddress]].sort(
                (a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime()
            );

            for (const trade of tokenTrades) {
                if (trade.event_type === 'buy') {
                    totalAmount += Number(trade.token_amount);
                    totalCost += Number(trade.cost_usd);
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
                    const costForThisSell = avgBuyPrice * Number(trade.token_amount);
                    const pnl = Number(trade.cost_usd) - costForThisSell;

                    const aggregatedNotes = journaledBuys.get(tokenAddress)?.notes.join('\n\n') || '';
                    const aggregatedTags = Array.from(journaledBuys.get(tokenAddress)?.tags || []);

                    const eventToPush: JournalEvent = {
                        id: trade.transaction_hash || `${trade.token_address}-${trade.trade_date}-sell`,
                        transaction_hash: trade.transaction_hash,
                        wallet_id: trade.wallet_id,
                        status: 'CLOSED',
                        token_symbol: trade.token_symbol,
                        token_logo: trade.token_logo,
                        token_address: trade.token_address,
                        date: trade.trade_date,
                        sell_value_usd: Number(trade.cost_usd),
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

                    console.log(`Creating CLOSED event for ${trade.transaction_hash || 'N/A'}. Notes: ${eventToPush.notes}`);
                    journalEvents.push(eventToPush);

                    totalCost -= costForThisSell;
                    totalAmount -= Number(trade.token_amount);

                    if (totalAmount < 1e-9) {
                        journaledBuys.delete(tokenAddress);
                    }
                }
            }

            if (totalAmount > 1e-9) {
                openPositionTokens.push(tokenAddress);
                const firstTrade = tokenTrades[0];
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

        // Fallback: if aggregation produced no events, return raw trades as events
        if (journalEvents.length === 0 && tradesWithJournalData.length > 0) {
            const positions = new Map<string, { amount: number; cost: number }>();
            const tradesForFallback = [...tradesWithJournalData].sort(
                (a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime()
            );

            journalEvents = tradesForFallback.map((trade) => {
                const eventType = trade.event_type || trade.trade_type || 'buy';
                const tokenAddress = trade.token_address;
                const costUsd = typeof trade.cost_usd === 'string' ? parseFloat(trade.cost_usd) : Number(trade.cost_usd);
                const tokenAmount = typeof trade.token_amount === 'string' ? parseFloat(trade.token_amount) : Number(trade.token_amount);
                const priceUsd = typeof trade.price_usd === 'string' ? parseFloat(trade.price_usd) : Number(trade.price_usd);
                const existingPosition = positions.get(tokenAddress) || { amount: 0, cost: 0 };
                const isSell = eventType === 'sell';

                let costBasisUsd: number | undefined;
                let realizedPnlUsd: number | undefined;
                let realizedPnlPercent: number | undefined;

                if (!isSell) {
                    positions.set(tokenAddress, {
                        amount: existingPosition.amount + tokenAmount,
                        cost: existingPosition.cost + costUsd,
                    });
                } else if (existingPosition.amount > 0) {
                    const avgCost = existingPosition.cost / existingPosition.amount;
                    costBasisUsd = avgCost * tokenAmount;
                    realizedPnlUsd = costUsd - costBasisUsd;
                    realizedPnlPercent = costBasisUsd > 0 ? (realizedPnlUsd / costBasisUsd) * 100 : 0;
                    positions.set(tokenAddress, {
                        amount: Math.max(0, existingPosition.amount - tokenAmount),
                        cost: Math.max(0, existingPosition.cost - costBasisUsd),
                    });
                }

                return {
                    id: trade.transaction_hash || `${trade.token_address}-${trade.trade_date}-${eventType}`,
                    transaction_hash: trade.transaction_hash,
                    wallet_id: trade.wallet_id,
                    status: isSell ? 'CLOSED' : 'OPEN',
                    token_symbol: trade.token_symbol,
                    token_logo: trade.token_logo,
                    token_address: tokenAddress,
                    date: trade.trade_date,
                    sell_value_usd: isSell ? costUsd : undefined,
                    cost_basis_usd: costBasisUsd,
                    realized_pnl_usd: realizedPnlUsd,
                    realized_pnl_percent: realizedPnlPercent,
                    sell_tx_hash: isSell ? trade.transaction_hash : undefined,
                    held_amount: !isSell ? tokenAmount : undefined,
                    avg_buy_price: !isSell ? priceUsd : undefined,
                    total_cost: !isSell ? costUsd : undefined,
                    notes: trade.notes,
                    tags: trade.tags || [],
                    is_flagged: trade.is_flagged,
                    journal_entry_id: trade.journal_entry_id,
                    what_went_well: trade.what_went_well,
                    what_went_wrong: trade.what_went_wrong,
                    what_will_i_do_differently: trade.what_will_i_do_differently,
                    is_journaled: trade.is_journaled,
                };
            });
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
