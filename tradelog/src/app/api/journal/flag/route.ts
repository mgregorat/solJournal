import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(req: NextRequest) {
  const { tx_hash, is_flagged, userId } = await req.json();

  console.log(`[FLAG] Upserting flag for userId: ${userId}, tx_hash: ${tx_hash}, is_flagged: ${is_flagged}`);

  if (!userId || !tx_hash) {
    return NextResponse.json({ error: 'Missing userId or transaction hash' }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('journal_entries')
      .upsert({ 
        tx_hash: tx_hash, 
        user_id: userId, 
        is_flagged: is_flagged,
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'user_id,tx_hash',
        // This ensures that nulls from the client don't overwrite existing values in the DB.
        // For example, if a client sends only a flag, it won't wipe out existing notes.
        ignoreDuplicates: false, 
      })
      .select();

    if (error) {
      console.error('[FLAG] Error in flag upsert:', error);
      throw error;
    }

    console.log(`[FLAG] Successfully upserted flag:`, data);
    return NextResponse.json({ message: 'Flag updated successfully', data });
  } catch (error: any) {
    console.error('[FLAG] Error updating flag:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 