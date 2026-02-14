import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import { NextRequest } from 'next/server';
import { requireOwnedWallet, requireUser } from '@/app/lib/authorization';
import { throwHttp, withTiming } from '@/app/lib/http';

// GET /api/wallets (bearer-auth scoped)
export async function GET(req: NextRequest) {
  return withTiming(req, async () => {
    const dbUser = await requireUser(req);
    let wallets;
    let error;
    ({ data: wallets, error } = await supabaseAdmin
      .from('wallets')
      .select('id, wallet_address, label, last_synced_at')
      .eq('user_id', dbUser.id)
      .order('created_at', { ascending: true }));

    // Backward compatibility: older schema may not have wallets.label yet.
    if (error && error.code === 'PGRST204') {
      const fallback = await supabaseAdmin
        .from('wallets')
        .select('id, wallet_address, last_synced_at')
        .eq('user_id', dbUser.id)
        .order('created_at', { ascending: true });
      wallets = (fallback.data || []).map((w: any) => ({ ...w, label: null }));
      error = fallback.error;
    }

    if (error) {
      throwHttp("internal_error", "Failed to fetch wallets", 500);
    }

    return wallets || [];
  });
}

// POST /api/wallets
export async function POST(req: NextRequest) {
  return withTiming(req, async () => {
    const dbUser = await requireUser(req);
    const { walletAddress, label } = await req.json();

    const normalizedWalletAddress =
      typeof walletAddress === 'string' ? walletAddress.trim() : '';
    if (!normalizedWalletAddress) {
      throwHttp("bad_request", "Wallet address is required", 400);
    }

    const normalizedLabel = typeof label === 'string' ? label.trim() : '';
    const { data: insertedWallet, error: insertError } = await supabaseAdmin
      .from('wallets')
      .insert({
        user_id: dbUser.id,
        wallet_address: normalizedWalletAddress,
        label: normalizedLabel.length > 0 ? normalizedLabel : null,
      })
      .select()
      .single();
    
    if (insertError) {
      if (insertError.code === '23505') {
        const { data: existingWallet, error: existingWalletError } = await supabaseAdmin
          .from('wallets')
          .select('id, user_id, wallet_address, label, last_synced_at')
          .eq('wallet_address', normalizedWalletAddress)
          .maybeSingle();

        if (existingWalletError) {
          throwHttp("internal_error", "Failed to retrieve existing wallet", 500);
        }

        if (existingWallet && Number(existingWallet.user_id) === Number(dbUser.id)) {
          return existingWallet;
        }

        throwHttp("conflict", "Wallet already linked to another user", 409);
      }

      throwHttp("internal_error", "Failed to insert wallet", 500);
    }

    return insertedWallet;
  });
}

// PATCH /api/wallets
export async function PATCH(req: NextRequest) {
  return withTiming(req, async () => {
    const dbUser = await requireUser(req);
    const { walletId, label } = await req.json();

    if (!walletId) {
      throwHttp("bad_request", "Wallet ID is required", 400);
    }

    const parsedWalletId = parseInt(String(walletId), 10);
    if (isNaN(parsedWalletId)) {
      throwHttp("bad_request", "Invalid walletId format", 400);
    }
    const ownedWallet = await requireOwnedWallet(req, dbUser, parsedWalletId, null);

    const normalizedLabel = typeof label === 'string' ? label.trim() : '';

    const { data, error } = await supabaseAdmin
      .from('wallets')
      .update({ label: normalizedLabel.length > 0 ? normalizedLabel : null })
      .eq('id', ownedWallet.id)
      .eq('user_id', dbUser.id)
      .select('id, wallet_address, label')
      .single();

    if (error) {
      if (error.code === 'PGRST204') {
        throwHttp("conflict", "Wallet labels are not enabled yet. Run the wallet-label migration first.", 409);
      }
      throwHttp("internal_error", "Failed to update wallet label", 500);
    }

    return data;
  });
}

// DELETE /api/wallets
export async function DELETE(req: NextRequest) {
  return withTiming(req, async () => {
    const dbUser = await requireUser(req);
    const { walletId } = await req.json();

    if (!walletId) {
      throwHttp("bad_request", "Wallet ID is required", 400);
    }

    const parsedWalletId = parseInt(String(walletId), 10);
    if (isNaN(parsedWalletId)) {
      throwHttp("bad_request", "Invalid walletId format", 400);
    }
    const ownedWallet = await requireOwnedWallet(req, dbUser, parsedWalletId, null);

    const { error: deleteError } = await supabaseAdmin
      .from('wallets')
      .delete()
      .eq('id', ownedWallet.id)
      .eq('user_id', dbUser.id);

    if (deleteError) {
      throwHttp("internal_error", "Failed to delete wallet", 500);
    }

    return { success: true };
  });
}
