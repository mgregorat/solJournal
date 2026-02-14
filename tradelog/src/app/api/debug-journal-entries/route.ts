import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import { requireInternalRequest } from '@/app/lib/authorization';
import { throwHttp, withTiming } from '@/app/lib/http';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    return withTiming(request, async () => {
        requireInternalRequest(request);

        const { data: allEntries, error: allError } = await supabaseAdmin
            .from('journal_entries')
            .select('*')
            .order('created_at', { ascending: false });

        const { data: noCacheEntries, error: noCacheError } = await supabaseAdmin
            .from('journal_entries')
            .select('*')
            .order('created_at', { ascending: false });

        if (allError || noCacheError) {
            throwHttp("internal_error", "Failed to fetch debug journal entries", 500);
        }

        return {
          data: {
            allEntries,
            noCacheEntries,
            timestamp: new Date().toISOString()
          },
        };
    });
}
