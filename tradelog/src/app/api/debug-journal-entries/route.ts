import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        console.log(`[DEBUG] Checking all journal entries in database`);
        console.log(`[DEBUG] Using URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
        console.log(`[DEBUG] Service key present: ${!!process.env.SUPABASE_SERVICE_KEY}`);
        console.log(`[DEBUG] Service key starts with: ${process.env.SUPABASE_SERVICE_KEY?.substring(0, 20)}...`);
        
        // Get all journal entries with different approaches
        const { data: allEntries, error: allError } = await supabaseAdmin
            .from('journal_entries')
            .select('*')
            .order('created_at', { ascending: false });
            
        console.log(`[DEBUG] All entries query result:`, allEntries?.length || 0, 'entries');
        console.log(`[DEBUG] All entries:`, allEntries);
        
        // Try with no cache
        const { data: noCacheEntries, error: noCacheError } = await supabaseAdmin
            .from('journal_entries')
            .select('*')
            .order('created_at', { ascending: false });
            
        console.log(`[DEBUG] No cache entries:`, noCacheEntries?.length || 0);

        return NextResponse.json({
            allEntries,
            noCacheEntries,
            allError,
            noCacheError,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        console.error(`[DEBUG] Error:`, error.message);
        return NextResponse.json({ error: 'Failed to debug journal entries', details: error.message }, { status: 500 });
    }
} 