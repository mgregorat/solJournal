import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import { requireOwnedWallet, requireUser } from '@/app/lib/authorization';
import { throwHttp, withTiming } from '@/app/lib/http';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    return withTiming(request, async () => {
        const { searchParams } = new URL(request.url);
        const walletAddress = searchParams.get('walletAddress');
        const walletIdStr = searchParams.get('walletId');
        const dbUser = await requireUser(request);
        const parsedWalletId = walletIdStr ? parseInt(walletIdStr, 10) : null;
        if (walletIdStr && isNaN(parsedWalletId as number)) {
            throwHttp("bad_request", "Invalid walletId format", 400);
        }
        const ownedWallet = await requireOwnedWallet(request, dbUser, parsedWalletId, walletAddress);
        const ownedWalletId = ownedWallet.id;
        
        const [{ data: trades, error: tradesError }, { data: allJournalEntries, error: journalError }] = await Promise.all([
            supabaseAdmin
                .from('synced_trades')
                .select('*')
                .eq('user_id', dbUser.id)
                .eq('wallet_id', ownedWalletId)
                .order('trade_date', { ascending: false }),
            supabaseAdmin
                .from('journal_entries')
                .select('*')
                // Don't filter by user_id here since it's not working - get all and filter client-side
        ]);
        
        // Filter journal entries client-side since the server-side filter isn't working
        const journalEntries = allJournalEntries?.filter(entry => entry.user_id === dbUser.id && entry.wallet_id === ownedWalletId) || [];

        if (tradesError) {
            throwHttp("internal_error", "Failed to fetch journaled trades", 500);
        }
        if (journalError) {
            throwHttp("internal_error", "Failed to fetch journaled trades", 500);
        }

        // Create journal map for fast lookup
        const journalMap: Record<string, any> = journalEntries?.reduce((acc, entry) => {
            acc[entry.tx_hash as string] = entry;
            return acc;
        }, {} as Record<string, any>) || {};

        // Filter trades that have journal entries and transform them
        const journaledTrades = trades?.filter(trade => {
            return !!journalMap[trade.tx_hash as string];
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

        return journaledTrades;
    });
} 
