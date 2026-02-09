import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    const { wallet_address, email } = await request.json();

    if (!wallet_address) {
      return NextResponse.json({ error: 'wallet_address is required' }, { status: 400 });
    }

    // 1. Try to find the user via the wallets table (multi-wallet support)
    const { data: existingWallet, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('user_id')
      .eq('wallet_address', wallet_address)
      .single();

    if (existingWallet && existingWallet.user_id) {
        // User found via wallet, fetch full user details
        const { data: user, error: userError } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('id', existingWallet.user_id)
            .single();
        
        if (user) {
            return NextResponse.json(user);
        }
    }

    // 2. If not found in wallets, check users table (legacy/fallback using privy_did)
    const { data: existingUser, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('privy_did', wallet_address) // Treat wallet_address as the unique ID
      .single();

    if (existingUser) {
        // Found legacy user, backfill the wallets table
        await supabaseAdmin
            .from('wallets')
            .insert({
                user_id: existingUser.id,
                wallet_address: wallet_address,
                label: 'Main Wallet'
            })
            .select() // Ensure we don't error if it already exists (though logic above implies it doesn't)
            .maybeSingle();

        return NextResponse.json(existingUser);
    }

    // 3. Create new user if not exists
    const { data: newUser, error: insertError } = await supabaseAdmin
      .from('users')
      .insert({ privy_did: wallet_address, email }) // Use wallet_address as privy_did
      .select()
      .single();

    if (insertError) {
      console.error('Supabase error creating user:', insertError);
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    // 4. Create the wallet entry for this new user
    if (newUser) {
        await supabaseAdmin
            .from('wallets')
            .insert({
                user_id: newUser.id,
                wallet_address: wallet_address,
                label: 'Main Wallet'
            });
    }

    return NextResponse.json(newUser);
  } catch (error) {
    console.error('Request error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
