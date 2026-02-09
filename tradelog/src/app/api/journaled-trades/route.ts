import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

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
        console.log(`[API /journaled-trades] Fetching journaled trades for userId: ${userId}, wallet: ${walletAddress}`);

        // Fetch trades and journal entries separately, then merge
        console.log(`[API /journaled-trades] About to query journal_entries with userId: ${userId}`);
        
        const [{ data: trades, error: tradesError }, { data: allJournalEntries, error: journalError }] = await Promise.all([
            supabaseAdmin
                .from('synced_trades')
                .select('*')
                .eq('user_id', userId)
                .eq('wallet_address', walletAddress)
                .order('trade_date', { ascending: false }),
            supabaseAdmin
                .from('journal_entries')
                .select('*')
                // Don't filter by user_id here since it's not working - get all and filter client-side
        ]);
        
        // Filter journal entries client-side since the server-side filter isn't working
        const journalEntries = allJournalEntries?.filter(entry => entry.user_id === userId) || [];
        
        console.log(`[API /journaled-trades] Journal query completed. Error:`, journalError);
        console.log(`[API /journaled-trades] All journal entries:`, allJournalEntries?.length || 0);
        console.log(`[API /journaled-trades] Filtered journal entries:`, journalEntries.length);

        if (tradesError) {
            console.error('[API /journaled-trades] Trades error:', tradesError);
            throw tradesError;
        }
        if (journalError) {
            console.error('[API /journaled-trades] Journal error:', journalError);
            throw journalError;
        }

        console.log(`[API /journaled-trades] Fetched ${trades?.length || 0} trades and ${journalEntries?.length || 0} journal entries`);

        // Log some sample data for debugging
        if (trades && trades.length > 0) {
            console.log(`[API /journaled-trades] Sample trade tx_hash:`, trades[0].tx_hash);
        }
        if (journalEntries && journalEntries.length > 0) {
            console.log(`[API /journaled-trades] Sample journal tx_hash:`, journalEntries[0].tx_hash);
        }

        // Create journal map for fast lookup
        const journalMap: Record<string, any> = journalEntries?.reduce((acc, entry) => {
            acc[entry.tx_hash as string] = entry;
            return acc;
        }, {} as Record<string, any>) || {};

        console.log(`[API /journaled-trades] Journal Map has ${Object.keys(journalMap).length} entries`);
        console.log(`[API /journaled-trades] Journal Map keys:`, Object.keys(journalMap));

        // Filter trades that have journal entries and transform them
        const journaledTrades = trades?.filter(trade => {
            const hasJournal = !!journalMap[trade.tx_hash as string];
            if (hasJournal) {
                console.log(`[API /journaled-trades] Found journaled trade:`, trade.tx_hash);
            }
            return hasJournal;
        })
            .map(trade => {
                const journalEntry = journalMap[trade.tx_hash as string];
                return {
                    id: trade.tx_hash,
                    status: trade.event_type === 'sell' ? 'CLOSED' : 'OPEN',
                    token_symbol: trade.token_symbol,
                    token_logo: trade.token_logo,
                    token_address: trade.token_address,
                    date: trade.trade_date,
                    notes: journalEntry?.notes,
                    tags: journalEntry?.tags || [],
                    is_flagged: journalEntry?.is_flagged || false,
                    what_went_well: journalEntry?.what_went_well,
                    what_went_wrong: journalEntry?.what_went_wrong,
                    what_will_i_do_differently: journalEntry?.what_will_i_do_differently,
                    is_journaled: true,
                    // Include other trade data
                    sell_value_usd: trade.event_type === 'sell' ? trade.cost_usd : undefined,
                    cost_basis_usd: trade.cost_usd,
                    realized_pnl_usd: trade.event_type === 'sell' ? trade.realized_pnl_usd : undefined,
                    journal_entry_id: journalEntry?.id,
                    // Include raw trade data for debugging
                    raw_trade: trade,
                    raw_journal: journalEntry
                };
                         }) || [];

        console.log(`[API /journaled-trades] Returning ${journaledTrades.length} journaled trades`);
        
        return NextResponse.json(journaledTrades);

    } catch (error: any) {
        console.error(`[API /journaled-trades] Error:`, error.message);
        return NextResponse.json({ error: 'Failed to fetch journaled trades', details: error.message }, { status: 500 });
    }
} 