import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';

export async function PATCH(request: Request) {
  try {
    const { tx_hash, is_flagged, userId } = await request.json();

    if (tx_hash === undefined || is_flagged === undefined || userId === undefined) {
      return NextResponse.json({ error: 'Transaction hash, flagged status, and user ID are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('synced_trades')
      .update({ is_flagged })
      .eq('tx_hash', tx_hash)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update flag status in Supabase:', error);
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Trade not found or user does not have permission to edit.' }, { status: 404 });
      }
      throw error;
    }

    console.log(`Flag status updated for trade ${tx_hash}`);
    return NextResponse.json({ message: 'Flag status updated successfully.', data });

  } catch (error: any) {
    console.error(`An error occurred while updating flag status:`, error);
    return NextResponse.json({ error: 'Failed to update flag status', details: error.message }, { status: 500 });
  }
} 