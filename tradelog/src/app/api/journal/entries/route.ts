import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userIdStr = searchParams.get('userId');
    const walletIdStr = searchParams.get('walletId');

    if (!userIdStr) {
        return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const userId = parseInt(userIdStr, 10);
    if (isNaN(userId)) {
        return NextResponse.json({ error: 'Invalid userId format' }, { status: 400 });
    }

    try {
        console.log(`[API /journal/entries] Received request for userId: ${userId}`);
        // The service key should be a long string of characters. If it's short or 'undefined', this is the problem.
        console.log(`[API /journal/entries] SUPABASE_SERVICE_KEY loaded as: ${process.env.SUPABASE_SERVICE_KEY}`);

        let query = supabaseAdmin
            .from('journal_entries')
            .select('*')
            .eq('user_id', userId);

        if (walletIdStr !== null) {
            const walletId = parseInt(walletIdStr, 10);
            if (!isNaN(walletId)) {
                query = query.eq('wallet_id', walletId);
            }
        }

        const { data: journalEntries, error: journalError } = await query;

        if (journalError) {
            console.error('[API /journal/entries] Supabase error:', journalError);
            throw journalError;
        }

        return NextResponse.json(journalEntries || []);

    } catch (error: any) {
        console.error(`[API /journal/entries] An error occurred fetching journal entries for user ${userId}:`, error.message);
        return NextResponse.json({ error: 'Failed to fetch journal entries', details: error.message }, { status: 500 });
    }
}
