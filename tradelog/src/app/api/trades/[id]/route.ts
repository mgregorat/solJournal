import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import { NextRequest } from 'next/server';
import { requireUser } from '@/app/lib/authorization';
import { throwHttp, withTiming } from '@/app/lib/http';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    return withTiming(req, async () => {
        const tradeId = params.id;
        const dbUser = await requireUser(req);
        const tradeData = await req.json();

        // Use admin client to bypass RLS for direct updates
        const { data, error } = await supabaseAdmin
            .from('trades')
            .update(tradeData)
            .eq('id', tradeId)
            .eq('user_id', dbUser.id)
            .select()
            .single();

        if (error) {
            if (error.code === 'PGRST116') { // PostgREST error for no rows found
                throwHttp("not_found", `Trade with id ${tradeId} not found.`, 404);
            }
            throwHttp("internal_error", "Failed to update trade", 500);
        }

        return { trade: data };
    });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    return withTiming(req, async () => {
        const tradeId = params.id;
        const dbUser = await requireUser(req);
        const { error, count } = await supabaseAdmin
            .from('trades')
            .delete({ count: 'exact' })
            .eq('id', tradeId)
            .eq('user_id', dbUser.id);

        if (error) {
            throwHttp("internal_error", "Failed to delete trade", 500);
        }
        
        if (count === 0) {
            throwHttp("not_found", `Trade with id ${tradeId} not found.`, 404);
        }

        return { success: true };
    });
} 
