import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import { requireOwnedWallet, requireUser } from '@/app/lib/authorization';
import { throwHttp, withTiming } from '@/app/lib/http';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    return withTiming(request, async () => {
        const { searchParams } = new URL(request.url);
        const walletIdStr = searchParams.get('walletId');
        const dbUser = await requireUser(request);

        let query = supabaseAdmin
            .from('journal_entries')
            .select('*')
            .eq('user_id', dbUser.id);

        if (walletIdStr !== null) {
            const walletId = parseInt(walletIdStr, 10);
            if (isNaN(walletId)) {
                throwHttp("bad_request", "Invalid walletId format", 400);
            }
            const ownedWallet = await requireOwnedWallet(request, dbUser, walletId, null);
            query = query.eq('wallet_id', ownedWallet.id);
        }

        const { data: journalEntries, error: journalError } = await query;

        if (journalError) {
            throwHttp("internal_error", "Failed to fetch journal entries", 500);
        }

        return journalEntries || [];
    });
}
