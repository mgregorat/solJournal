import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const {
      tx_hash,
      userId,
      notes,
      tags,
      what_went_well,
      what_went_wrong,
      what_will_i_do_differently,
    } = body;

    console.log(`[JOURNAL SAVE] Saving entry for userId: ${userId}, tx_hash: ${tx_hash}`);
    console.log(`[JOURNAL SAVE] Notes: "${notes}"`);

    if (!userId || !tx_hash) {
      return NextResponse.json({ error: 'Missing required fields: userId and tx_hash' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('journal_entries')
      .upsert(
        {
          user_id: userId,
          tx_hash: tx_hash,
          notes: notes,
          tags: tags,
          what_went_well: what_went_well,
          what_went_wrong: what_went_wrong,
          what_will_i_do_differently: what_will_i_do_differently,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id, tx_hash',
        }
      )
      .select();

    if (error) {
      console.error('[JOURNAL SAVE] Supabase error:', error);
      return NextResponse.json({ error: 'Failed to save journal entry', details: error.message }, { status: 500 });
    }

    console.log(`[JOURNAL SAVE] Successfully saved entry:`, data);
    
    // Add a small delay to ensure database consistency before responding
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return NextResponse.json({ message: 'Journal entry saved successfully', data }, { status: 200 });
  } catch (e) {
    console.error('API error:', e);
    return NextResponse.json({ error: 'An unexpected error occurred', details: e.message }, { status: 500 });
  }
} 