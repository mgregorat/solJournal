import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import { requireUser } from '@/app/lib/authorization';
import { throwHttp, withTiming } from '@/app/lib/http';

export async function DELETE(request: NextRequest) {
  return withTiming(request, async () => {
    const dbUser = await requireUser(request);
    const { tx_hash } = await request.json();

    if (!tx_hash) {
      throwHttp("bad_request", "tx_hash is required", 400);
    }

    const { error } = await supabaseAdmin
      .from('journal_entries')
      .delete()
      .eq('tx_hash', tx_hash)
      .eq('user_id', dbUser.id);

    if (error) {
      throwHttp("internal_error", "Failed to delete journal entry", 500);
    }

    return { success: true };
  });
}
