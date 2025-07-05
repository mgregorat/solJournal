import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import { NextRequest, NextResponse } from 'next/server';

// This API route uses the admin client to bypass RLS for MVP development.
// When real authentication is added, we will revisit RLS and client usage.

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const walletAddress = searchParams.get('walletAddress');
    const walletAddresses = searchParams.get('walletAddresses');

    if (!walletAddress && !walletAddresses) {
        return NextResponse.json({ error: 'walletAddress or walletAddresses is required' }, { status: 400 });
    }

    try {
        let query = supabaseAdmin
            .from('trades')
            .select('*')
            .order('trade_date', { ascending: false });
        
        if (walletAddresses) {
            const addresses = walletAddresses.split(',');
            query = query.in('wallet_address', addresses);
        } else if (walletAddress) {
            query = query.eq('wallet_address', walletAddress);
        }

        const { data: trades, error } = await query;

        if (error) {
            console.error('Error fetching trades:', error);
            throw new Error(error.message);
        }

        return NextResponse.json(trades);
    } catch (error: any) {
        console.error("Caught error in GET /api/trades:", error);
        return NextResponse.json({ error: error.message || 'Failed to fetch trades' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const rawData = await req.json();

        // Basic validation
        const requiredFields = ['wallet_address', 'token_symbol', 'token_address', 'trade_type', 'amount', 'price', 'total_value', 'trade_date'];
        for (const field of requiredFields) {
            if (!rawData[field]) {
                return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
            }
        }
        
        const tradeToInsert: any = {
            wallet_address: rawData.wallet_address,
            token_symbol: rawData.token_symbol,
            token_address: rawData.token_address,
            trade_type: rawData.trade_type,
            amount: rawData.amount,
            price: rawData.price,
            total_value: rawData.total_value,
            trade_date: rawData.trade_date,
            notes: rawData.notes,
            emotion_tags: rawData.emotion_tags,
            source: rawData.source,
        };

        if (rawData.setup_id) {
            tradeToInsert.setup_id = rawData.setup_id;
        }

        const { data, error } = await supabaseAdmin
            .from('trades')
            .insert([tradeToInsert])
            .select()
            .single();

        if (error) {
            console.error('Error creating trade:', error);
            throw new Error(error.message);
        }

        return NextResponse.json({ message: 'Trade created successfully', trade: data }, { status: 201 });
    } catch (error: any) {
        console.error("Caught error in POST /api/trades:", error);
        return NextResponse.json({ error: error.message || 'Failed to create trade' }, { status: 500 });
    }
} 