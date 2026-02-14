import { NextRequest } from 'next/server';
import { 
  createDailySnapshot, 
  calculateDailyPnL, 
  getDailyPnLData,
  rebuildDailySnapshot 
} from '@/lib/pnl-tracker';
import { requireOwnedWallet, requireUser } from '@/app/lib/authorization';
import { throwHttp, withTiming } from '@/app/lib/http';

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return withTiming(req, async () => {
    const dbUser = await requireUser(req);
    const { walletId: walletIdRaw, walletAddress: walletAddressInput, date, action } = await req.json();

    const parsedWalletId =
      walletIdRaw !== undefined && walletIdRaw !== null && walletIdRaw !== ''
        ? parseInt(String(walletIdRaw), 10)
        : null;
    if (walletIdRaw !== undefined && walletIdRaw !== null && isNaN(parsedWalletId as number)) {
      throwHttp("bad_request", "Invalid walletId format", 400);
    }

    let walletAddressRaw: string | null = null;
    if (parsedWalletId === null) {
      walletAddressRaw =
        typeof walletAddressInput === 'string' ? walletAddressInput.trim() : '';
      if (!walletAddressRaw) {
        throwHttp("bad_request", "walletAddress is required when walletId is not provided", 400);
      }
    }

    const ownedWallet = await requireOwnedWallet(req, dbUser, parsedWalletId, walletAddressRaw);
    const walletAddress = ownedWallet.wallet_address;

    const snapshotDate = date ? new Date(date) : new Date();

    switch (action) {
      case 'create':
        return await createDailySnapshot(walletAddress, snapshotDate);

      case 'calculate':
        return await calculateDailyPnL(walletAddress, snapshotDate);

      case 'rebuild':
        return await rebuildDailySnapshot(walletAddress, snapshotDate);

      default:
        throwHttp("bad_request", "Invalid action", 400);
    }
  });
}

export async function GET(req: NextRequest) {
  return withTiming(req, async () => {
    const dbUser = await requireUser(req);
    const { searchParams } = new URL(req.url);
    const walletAddressParam = searchParams.get('walletAddress');
    const walletIdStr = searchParams.get('walletId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const parsedWalletId = walletIdStr ? parseInt(walletIdStr, 10) : null;
    if (walletIdStr && isNaN(parsedWalletId as number)) {
      throwHttp("bad_request", "Invalid walletId format", 400);
    }

    let walletAddressRaw: string | null = null;
    if (parsedWalletId === null) {
      walletAddressRaw = walletAddressParam?.trim() || null;
      if (!walletAddressRaw) {
        throwHttp("bad_request", "walletAddress is required when walletId is not provided", 400);
      }
    }

    const ownedWallet = await requireOwnedWallet(req, dbUser, parsedWalletId, walletAddressRaw);
    const walletAddress = ownedWallet.wallet_address;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const end = endDate ? new Date(endDate) : new Date();

    const pnlData = await getDailyPnLData(walletAddress, start, end);
    return pnlData;
  });
} 
