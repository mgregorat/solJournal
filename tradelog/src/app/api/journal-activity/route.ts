import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const walletAddress = searchParams.get('walletAddress');

    if (!userId || !walletAddress) {
        return NextResponse.json({ error: 'userId and walletAddress are required' }, { status: 400 });
    }

    try {
        console.log(`Fetching journal activity for user ${userId} and wallet ${walletAddress}...`);
        
        const { data: trades, error } = await supabaseAdmin
            .from('synced_trades')
            .select('*')
            .eq('user_id', userId)
            .eq('wallet_address', walletAddress)
            .order('trade_date', { ascending: false });

        if (error) {
            console.error('Failed to fetch journal activity from Supabase:', error);
            throw error;
        }

        console.log(`Successfully fetched ${trades.length} trades for user ${userId} and wallet ${walletAddress}.`);
        return NextResponse.json(trades);

    } catch (error: any) {
        console.error(`An error occurred while fetching journal activity for user ${userId}:`, error);
        return NextResponse.json({ error: 'Failed to fetch journal activity', details: error.message }, { status: 500 });
    }
} 