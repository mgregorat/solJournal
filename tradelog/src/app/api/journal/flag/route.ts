import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';

export async function PATCH(req: NextRequest) {
  const { tx_hash, is_flagged, is_journaled, notes, userId, walletId } = await req.json();

  if (!userId || !tx_hash || !walletId) {
    return NextResponse.json({ error: 'Missing userId, walletId, or transaction hash' }, { status: 400 });
  }

  try {
    // Step 1: Fetch the trade to ensure it exists for this user and wallet.
    // This is a validation step. The wallet_id for the journal entry comes from the request.
    const { data: trade, error: tradeError } = await supabaseAdmin
      .from('trades')
      .select('wallet_id')
      .eq('transaction_hash', tx_hash)
      .eq('user_id', userId)
      .eq('wallet_id', walletId)
      .single();

    if (tradeError || !trade) {
      console.error('Error fetching trade for journal entry:', tradeError);
      return NextResponse.json({ error: 'Associated trade not found for the specified wallet.' }, { status: 404 });
    }

    // Step 2: Prepare the record for upserting.
    const record: {
        tx_hash: any;
        user_id: any;
        wallet_id: any;
        is_flagged?: any;
        is_journaled?: any;
        notes?: any;
    } = {
        tx_hash: tx_hash,
        user_id: userId,
        wallet_id: walletId,
    };

    if (is_flagged !== undefined) {
        record.is_flagged = is_flagged;
    }
    if (is_journaled !== undefined) {
        record.is_journaled = is_journaled;
    }
    if (notes !== undefined) {
        record.notes = notes;
    }

    // Step 3: Upsert manually (no unique constraint available for ON CONFLICT)
    const { data: existingEntry, error: existingError } = await supabaseAdmin
      .from('journal_entries')
      .select('id')
      .eq('user_id', userId)
      .eq('wallet_id', walletId)
      .eq('tx_hash', tx_hash)
      .maybeSingle();

    if (existingError) {
      console.error('Error checking existing journal entry:', existingError);
      throw existingError;
    }

    let data;
    let error;
    if (existingEntry?.id) {
      ({ data, error } = await supabaseAdmin
        .from('journal_entries')
        .update(record)
        .eq('id', existingEntry.id)
        .select()
        .single());
    } else {
      ({ data, error } = await supabaseAdmin
        .from('journal_entries')
        .insert(record)
        .select()
        .single());
    }

    if (error) {
      console.error('Error in flag/notes upsert:', error);
      throw error;
    }

    return NextResponse.json({ message: 'Journal entry updated successfully', data });
  } catch (error: any) {
    console.error('Error updating journal entry:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
