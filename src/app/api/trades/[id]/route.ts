import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import { NextRequest, NextResponse } from 'next/server';

// TODO: Get from auth once implemented
const FAKE_USER_ID = "55555555-5555-5555-5555-555555555555"; 

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    const tradeId = params.id;
    try {
        const tradeData = await req.json();

        // Use admin client to bypass RLS for direct updates
        const { data, error } = await supabaseAdmin
            .from('trades')
            .update(tradeData)
            .eq('id', tradeId)
            .select()
            .single();

        if (error) {
            console.error('Error updating trade:', error);
            if (error.code === 'PGRST116') { // PostgREST error for no rows found
                return NextResponse.json({ error: `Trade with id ${tradeId} not found.` }, { status: 404 });
            }
            throw new Error(error.message);
        }

        return NextResponse.json({ message: 'Trade updated successfully', trade: data });
    } catch (error: any) {
        console.error(`Caught error in PUT /api/trades/${tradeId}:`, error);
        return NextResponse.json({ error: error.message || 'Failed to update trade' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    const tradeId = params.id;
    try {
        const { error, count } = await supabaseAdmin
            .from('trades')
            .delete({ count: 'exact' })
            .eq('id', tradeId);

        if (error) {
            console.error('Error deleting trade:', error);
            throw new Error(error.message);
        }
        
        if (count === 0) {
            return NextResponse.json({ error: `Trade with id ${tradeId} not found.` }, { status: 404 });
        }

        return NextResponse.json({ message: 'Trade deleted successfully' }, { status: 200 });
    } catch (error: any) {
        console.error(`Caught error in DELETE /api/trades/${tradeId}:`, error);
        return NextResponse.json({ error: error.message || 'Failed to delete trade' }, { status: 500 });
    }
} 