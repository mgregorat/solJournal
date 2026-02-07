import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';

export async function DELETE(request: Request) {
  try {
    const { tx_hash, userId } = await request.json();

    if (!tx_hash || !userId) {
      return NextResponse.json({ error: 'tx_hash and userId are required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('journal_entries')
      .delete()
      .eq('tx_hash', tx_hash)
      .eq('user_id', userId);

    if (error) {
      console.error('Supabase delete error:', error);
      return NextResponse.json({ error: 'Failed to delete journal entry' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Journal entry deleted successfully' });
  } catch (error) {
    console.error('Request error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
