import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userIdStr = searchParams.get('userId');

    if (!userIdStr) {
        return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const userId = parseInt(userIdStr, 10);
    if (isNaN(userId)) {
        return NextResponse.json({ error: 'Invalid userId format' }, { status: 400 });
    }

    try {
        console.log(`[TEST] Testing journal_entries query for userId: ${userId}`);
        
        // Test basic query
        const { data: allEntries, error: allError } = await supabaseAdmin
            .from('journal_entries')
            .select('*');
            
        console.log(`[TEST] All journal entries query - Count: ${allEntries?.length || 0}, Error:`, allError);
        
        // Test filtered query with different approaches
        const { data: userEntries1, error: userError1 } = await supabaseAdmin
            .from('journal_entries')
            .select('*')
            .eq('user_id', userId);
            
        const { data: userEntries2, error: userError2 } = await supabaseAdmin
            .from('journal_entries')
            .select('*')
            .eq('user_id', userId.toString());
            
        const { data: userEntries3, error: userError3 } = await supabaseAdmin
            .from('journal_entries')
            .select('*')
            .eq('user_id', '1');
            
        console.log(`[TEST] Query 1 (userId as number) - Count: ${userEntries1?.length || 0}, Error:`, userError1);
        console.log(`[TEST] Query 2 (userId as string) - Count: ${userEntries2?.length || 0}, Error:`, userError2);
        console.log(`[TEST] Query 3 (literal '1') - Count: ${userEntries3?.length || 0}, Error:`, userError3);
        console.log(`[TEST] Query 1 entries:`, userEntries1);
        console.log(`[TEST] Query 2 entries:`, userEntries2);
        console.log(`[TEST] Query 3 entries:`, userEntries3);

        // Check if RLS is enabled and try bypassing it
        const { data: rlsCheck, error: rlsError } = await supabaseAdmin
            .from('journal_entries')
            .select('*', { count: 'exact' });
            
        console.log(`[TEST] RLS check - Count: ${rlsCheck?.length || 0}, Error:`, rlsError);
        
        // Try with different service role options
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
            
        console.log(`[TEST] Direct client query - Count: ${directEntries?.length || 0}, Error:`, directError);
        console.log(`[TEST] Direct client entries:`, directEntries);

        return NextResponse.json({
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
        });

    } catch (error: any) {
        console.error(`[TEST] Error:`, error.message);
        return NextResponse.json({ error: 'Failed to test journal query', details: error.message }, { status: 500 });
    }
} 