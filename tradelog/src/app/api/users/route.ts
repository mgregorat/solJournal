import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    const { privy_did, email } = await request.json();

    if (!privy_did) {
      return NextResponse.json({ error: 'privy_did is required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .upsert({ privy_did, email }, { onConflict: 'privy_did' })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Failed to sync user' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Request error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
