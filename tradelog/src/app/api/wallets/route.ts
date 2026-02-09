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
    const { data: wallets, error } = await supabaseAdmin
      .from('wallets')
      .select('id, wallet_address, label')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

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
    const { data: insertedData, error: insertError } = await supabaseAdmin
      .from('wallets')
      .insert({
        user_id: userId,
        wallet_address: walletAddress,
        label: label,
      })
      .select()
      .single();
    
    // If there is an error, it's likely a unique constraint violation.
    if (insertError) {
      if (insertError.code === '23505') { // Unique violation
        // The wallet already exists, so we fetch it.
        const { data: existingWallet, error: fetchError } = await supabaseAdmin
          .from('wallets')
          .select()
          .eq('user_id', userId)
          .eq('wallet_address', walletAddress)
          .single();

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
