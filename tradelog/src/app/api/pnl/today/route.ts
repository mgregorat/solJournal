import { NextRequest } from 'next/server';
import { getTodaysPnl } from '@/lib/pnl';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import { requireOwnedWallet, requireUser } from '@/app/lib/authorization';
import { throwHttp, withTiming } from '@/app/lib/http';

export const dynamic = 'force-dynamic';

// This endpoint is for the UI to fetch the latest P&L data
export async function GET(req: NextRequest) {
  return withTiming(req, async () => {
    const dbUser = await requireUser(req);
    const { searchParams } = new URL(req.url);
    const walletIdStr = searchParams.get('walletId');
    const walletAddress = searchParams.get('walletAddress');

    let ownedWallet: { id: number; wallet_address: string } | null = null;
    if (walletIdStr || walletAddress) {
      const walletId = walletIdStr ? parseInt(walletIdStr, 10) : null;
      if (walletIdStr && isNaN(walletId as number)) {
        throwHttp("bad_request", "Invalid walletId format", 400);
      }
      const resolvedWallet = await requireOwnedWallet(req, dbUser, walletId, walletAddress);
      ownedWallet = { id: resolvedWallet.id, wallet_address: resolvedWallet.wallet_address };
    }

    let wallets: Array<{ id: number; wallet_address: string }> = [];

    if (ownedWallet) {
      wallets = [ownedWallet];
    } else {
      const { data: allWallets, error: walletsError } = await supabaseAdmin
        .from('wallets')
        .select('id, wallet_address')
        .eq('user_id', dbUser.id);

      if (walletsError) {
        throwHttp("internal_error", "Failed to fetch wallets", 500);
      }

      wallets = (allWallets || []).map((wallet) => ({
        id: Number(wallet.id),
        wallet_address: String(wallet.wallet_address),
      }));
    }

    if (wallets.length === 0) {
      return {
        data: {
        pnl_usd: 0,
        pnl_percent: 0,
        current_balance_usd: 0,
        },
      };
    }

    const walletPnls = await Promise.all(
      wallets.map((wallet) => getTodaysPnl(wallet.wallet_address))
    );

    const aggregate = walletPnls.reduce(
      (acc, pnl) => {
        acc.pnlUsd += pnl.pnl_usd;
        acc.currentBalance += pnl.current_balance_usd;
        acc.startBalance += (pnl.current_balance_usd - pnl.pnl_usd);
        return acc;
      },
      { pnlUsd: 0, currentBalance: 0, startBalance: 0 }
    );

    const pnlData = {
      pnl_usd: aggregate.pnlUsd,
      pnl_percent: aggregate.startBalance > 0 ? (aggregate.pnlUsd / aggregate.startBalance) * 100 : 0,
      current_balance_usd: aggregate.currentBalance,
    };

    return pnlData;
  });
} 
