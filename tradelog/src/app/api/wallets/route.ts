import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/wallets?userId=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  try {
    let wallets;
    let error;
    ({ data: wallets, error } = await supabaseAdmin
      .from('wallets')
      .select('id, wallet_address, label, last_synced_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }));

    // Backward compatibility: older schema may not have wallets.label yet.
    if (error && error.code === 'PGRST204') {
      const fallback = await supabaseAdmin
        .from('wallets')
        .select('id, wallet_address, last_synced_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      wallets = (fallback.data || []).map((w: any) => ({ ...w, label: null }));
      error = fallback.error;
    }

    if (error) {
      console.error('Error fetching wallets:', error);
      return NextResponse.json({ error: 'Failed to fetch wallets' }, { status: 500 });
    }

    return NextResponse.json(wallets);
  } catch (error) {
    console.error('An unexpected error occurred:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

// POST /api/wallets
export async function POST(req: NextRequest) {
  try {
    const { userId, walletAddress, label } = await req.json();

    if (!userId || !walletAddress) {
      return NextResponse.json({ error: 'User ID and wallet address are required' }, { status: 400 });
    }

    // First, try to insert the new wallet, ignoring duplicates.
    let insertedData;
    let insertError;
    ({ data: insertedData, error: insertError } = await supabaseAdmin
      .from('wallets')
      .insert({
        user_id: userId,
        wallet_address: walletAddress,
        label: label ?? null,
      })
      .select()
      .single());

    // Backward compatibility: older schema may not have wallets.label yet.
    if (insertError && insertError.code === 'PGRST204') {
      ({ data: insertedData, error: insertError } = await supabaseAdmin
        .from('wallets')
        .insert({
          user_id: userId,
          wallet_address: walletAddress,
        })
        .select()
        .single());
    }
    
    // If there is an error, it's likely a unique constraint violation.
    if (insertError) {
      if (insertError.code === '23505') { // Unique violation
        // The wallet already exists, so we fetch it.
        const { data: existingWallet, error: fetchError } = await supabaseAdmin
          .from('wallets')
          .select('id, wallet_address, label')
          .eq('user_id', userId)
          .eq('wallet_address', walletAddress)
          .single();

        // If label column doesn't exist, retry without it.
        if (fetchError && fetchError.code === 'PGRST204') {
          const fallback = await supabaseAdmin
            .from('wallets')
            .select('id, wallet_address')
            .eq('user_id', userId)
            .eq('wallet_address', walletAddress)
            .single();

          if (fallback.error) {
            console.error('Error fetching existing wallet:', fallback.error);
            return NextResponse.json({ error: 'Failed to retrieve existing wallet' }, { status: 500 });
          }
          return NextResponse.json({ ...fallback.data, label: null });
        }

        if (fetchError) {
          console.error('Error fetching existing wallet:', fetchError);
          return NextResponse.json({ error: 'Failed to retrieve existing wallet' }, { status: 500 });
        }
        return NextResponse.json(existingWallet);
      } else {
        // For other errors, we return a server error.
        console.error('Error inserting wallet:', insertError);
        return NextResponse.json({ error: 'Failed to insert wallet' }, { status: 500 });
      }
    }

    // If the insert was successful, return the newly created wallet.
    return NextResponse.json(insertedData);

  } catch (error) {
    console.error('An unexpected error occurred in POST /api/wallets:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

// PATCH /api/wallets
export async function PATCH(req: NextRequest) {
  try {
    const { userId, walletId, label } = await req.json();

    if (!userId || !walletId) {
      return NextResponse.json({ error: 'User ID and wallet ID are required' }, { status: 400 });
    }

    // Validate ownership first.
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('id, user_id')
      .eq('id', walletId)
      .single();

    if (walletError || !wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }
    if (Number(wallet.user_id) !== Number(userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const normalizedLabel = typeof label === 'string' ? label.trim() : '';

    const { data, error } = await supabaseAdmin
      .from('wallets')
      .update({ label: normalizedLabel.length > 0 ? normalizedLabel : null })
      .eq('id', walletId)
      .eq('user_id', userId)
      .select('id, wallet_address, label')
      .single();

    if (error) {
      if (error.code === 'PGRST204') {
        return NextResponse.json(
          { error: 'Wallet labels are not enabled yet. Run the wallet-label migration first.' },
          { status: 409 }
        );
      }
      console.error('Error updating wallet label:', error);
      return NextResponse.json({ error: 'Failed to update wallet label' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('An unexpected error occurred in PATCH /api/wallets:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

// DELETE /api/wallets
export async function DELETE(req: NextRequest) {
  try {
    const { userId, walletId } = await req.json();

    if (!userId || !walletId) {
      return NextResponse.json({ error: 'User ID and wallet ID are required' }, { status: 400 });
    }

    // Validate ownership first.
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('id, user_id')
      .eq('id', walletId)
      .single();

    if (walletError || !wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }
    if (Number(wallet.user_id) !== Number(userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('wallets')
      .delete()
      .eq('id', walletId)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error deleting wallet:', deleteError);
      return NextResponse.json({ error: deleteError.message || 'Failed to delete wallet' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('An unexpected error occurred in DELETE /api/wallets:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
