import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    const { user_id, wallet_address } = await request.json();

    if (!user_id || !wallet_address) {
      return NextResponse.json({ error: 'user_id and wallet_address are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('wallets')
      .upsert({ user_id, wallet_address }, { onConflict: 'wallet_address' })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Failed to save wallet' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Request error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const user_id = searchParams.get('user_id');

        if (!user_id) {
            return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('wallets')
            .select('*')
            .eq('user_id', user_id);

        if (error) {
            console.error('Supabase error:', error);
            return NextResponse.json({ error: 'Failed to fetch wallets' }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Request error:', error);
        return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
    }
}
