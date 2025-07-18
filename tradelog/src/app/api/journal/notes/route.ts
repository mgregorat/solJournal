import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';

export async function PATCH(request: Request) {
  try {
    const { tx_hash, notes, userId } = await request.json();

    if (!tx_hash || !userId) {
      return NextResponse.json({ error: 'Transaction hash and user ID are required' }, { status: 400 });
    }

    // Update the notes for the specific trade, ensuring the user owns it.
    const { data, error } = await supabaseAdmin
      .from('synced_trades')
      .update({ notes })
      .eq('tx_hash', tx_hash)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update note in Supabase:', error);
      if (error.code === 'PGRST116') { // PostgREST error for "Not a single row was returned"
        return NextResponse.json({ error: 'Trade not found or user does not have permission to edit.' }, { status: 404 });
      }
      throw error;
    }

    console.log(`Note updated for trade ${tx_hash}`);
    return NextResponse.json({ message: 'Note saved successfully.', data });

  } catch (error: any) {
    console.error(`An error occurred while saving the note:`, error);
    return NextResponse.json({ error: 'Failed to save note', details: error.message }, { status: 500 });
  }
} 