import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import { requireOwnedWallet, requireUser } from '@/app/lib/authorization';
import { throwHttp, withTiming } from '@/app/lib/http';

export async function PATCH(req: NextRequest) {
  return withTiming(req, async () => {
    const dbUser = await requireUser(req);
    const { tx_hash, is_flagged, is_journaled, notes, walletId } = await req.json();

    if (!tx_hash || !walletId) {
      throwHttp("bad_request", "Missing walletId or transaction hash", 400);
    }

    const parsedWalletId = parseInt(String(walletId), 10);
    if (isNaN(parsedWalletId)) {
      throwHttp("bad_request", "Invalid walletId format", 400);
    }

    const ownedWallet = await requireOwnedWallet(req, dbUser, parsedWalletId, null);

    // Step 1: Fetch the trade to ensure it exists for this user and wallet.
    // This is a validation step. The wallet_id for the journal entry comes from the request.
    const { data: trade, error: tradeError } = await supabaseAdmin
      .from('trades')
      .select('wallet_id')
      .eq('transaction_hash', tx_hash)
      .eq('user_id', dbUser.id)
      .eq('wallet_id', ownedWallet.id)
      .single();

    if (tradeError || !trade) {
      throwHttp("not_found", "Associated trade not found for the specified wallet.", 404);
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
        user_id: dbUser.id,
        wallet_id: ownedWallet.id,
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
      .eq('user_id', dbUser.id)
      .eq('wallet_id', ownedWallet.id)
      .eq('tx_hash', tx_hash)
      .maybeSingle();

    if (existingError) {
      throwHttp("internal_error", "Failed to update journal entry", 500);
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
      throwHttp("internal_error", "Failed to update journal entry", 500);
    }

    return { journalEntry: data };
  });
}
