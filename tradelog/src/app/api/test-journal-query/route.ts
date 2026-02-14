import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import { requireInternalRequest } from '@/app/lib/authorization';
import { throwHttp, withTiming } from '@/app/lib/http';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    return withTiming(request, async () => {
        requireInternalRequest(request);
        const { searchParams } = new URL(request.url);
        const targetUserIdStr = searchParams.get('targetUserId');

        if (!targetUserIdStr) {
            throwHttp("bad_request", "targetUserId is required", 400);
        }

        const targetUserId = parseInt(targetUserIdStr, 10);
        if (isNaN(targetUserId)) {
            throwHttp("bad_request", "Invalid targetUserId format", 400);
        }

        const { data: allEntries, error: allError } = await supabaseAdmin
            .from('journal_entries')
            .select('*');

        const { data: userEntries1, error: userError1 } = await supabaseAdmin
            .from('journal_entries')
            .select('*')
            .eq('user_id', targetUserId);
            
        const { data: userEntries2, error: userError2 } = await supabaseAdmin
            .from('journal_entries')
            .select('*')
            .eq('user_id', targetUserId.toString());
            
        const { data: userEntries3, error: userError3 } = await supabaseAdmin
            .from('journal_entries')
            .select('*')
            .eq('user_id', '1');

        const { data: rlsCheck, error: rlsError } = await supabaseAdmin
            .from('journal_entries')
            .select('*', { count: 'exact' });

        const { createClient } = await import('@supabase/supabase-js');
        const directClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_KEY!,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                },
                db: {
                    schema: 'public'
                }
            }
        );
        
        const { data: directEntries, error: directError } = await directClient
            .from('journal_entries')
            .select('*')
            .eq('user_id', 1);

        return {
          data: {
            allCount: allEntries?.length || 0,
            userCount1: userEntries1?.length || 0,
            userCount2: userEntries2?.length || 0,
            userCount3: userEntries3?.length || 0,
            allEntries: allEntries,
            userEntries1: userEntries1,
            userEntries2: userEntries2,
            userEntries3: userEntries3,
            directEntries: directEntries,
            errors: { allError, userError1, userError2, userError3, rlsError, directError }
          },
        };
    });
}
