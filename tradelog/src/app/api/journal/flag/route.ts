import { supabase } from '@/app/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(req: NextRequest) {
  const { tx_hash, is_flagged, userId } = await req.json();

  if (!userId || !tx_hash) {
    return NextResponse.json({ error: 'Missing userId or transaction hash' }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from('journal_entries')
      .upsert({ tx_hash: tx_hash, user_id: userId, is_flagged: is_flagged }, { onConflict: 'user_id,tx_hash' })
      .select();

    if (error) {
      console.error('Error in flag upsert:', error);
      throw error;
    }

    return NextResponse.json({ message: 'Flag updated successfully', data });
  } catch (error: any) {
    console.error('Error updating flag:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 