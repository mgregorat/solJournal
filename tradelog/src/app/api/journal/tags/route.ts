import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';

export async function PATCH(request: Request) {
  try {
    const { tx_hash, tags, userId } = await request.json();

    if (!tx_hash || !userId) {
      return NextResponse.json({ error: 'Transaction hash and user ID are required' }, { status: 400 });
    }

    if (!Array.isArray(tags)) {
      return NextResponse.json({ error: 'Tags must be an array of strings' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('synced_trades')
      .update({ tags })
      .eq('tx_hash', tx_hash)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update tags in Supabase:', error);
       if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Trade not found or user does not have permission to edit.' }, { status: 404 });
      }
      throw error;
    }

    console.log(`Tags updated for trade ${tx_hash}`);
    return NextResponse.json({ message: 'Tags saved successfully.', data });

  } catch (error: any) {
    console.error(`An error occurred while saving tags:`, error);
    return NextResponse.json({ error: 'Failed to save tags', details: error.message }, { status: 500 });
  }
} 