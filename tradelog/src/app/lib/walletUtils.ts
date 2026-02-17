// tradelog/src/app/lib/walletUtils.ts
import { supabaseAdmin } from './supabaseAdmin';

export async function getOrCreateWalletId(userId: number, walletAddress: string): Promise<number> {
  // First, try to find the wallet.
  const { data: existingWallet, error: selectError } = await supabaseAdmin
    .from('wallets')
    .select('id')
    .eq('user_id', userId)
    .eq('wallet_address', walletAddress)
    .limit(1)
    .single();

  if (selectError && selectError.code !== 'PGRST116') { // PGRST116 = no rows found
    console.error('Error selecting wallet:', selectError);
    throw new Error('Could not retrieve wallet information.');
  }

  if (existingWallet) {
    return Number(existingWallet.id);
  }

  // If not found, create it.
  const { data: newWallet, error: insertError } = await supabaseAdmin
    .from('wallets')
    .insert({ user_id: userId, wallet_address: walletAddress })
    .select('id')
    .single();
    
  if (insertError) {
    // It's possible another request created it in the meantime, so we try one more select.
    if (insertError.code === '23505') { // unique_violation
        const { data: raceConditionWallet, error: raceError } = await supabaseAdmin
            .from('wallets')
            .select('id')
            .eq('user_id', userId)
            .eq('wallet_address', walletAddress)
            .single();

        if (raceError || !raceConditionWallet) {
             console.error('Error re-selecting wallet after race condition:', raceError);
             throw new Error('Could not create or retrieve wallet.');
        }
        return Number(raceConditionWallet.id);
    }
    console.error('Error inserting wallet:', insertError);
    throw new Error('Could not create wallet.');
  }

  if (!newWallet) {
      throw new Error('Failed to create and retrieve wallet.');
  }

  return Number(newWallet.id);
}
