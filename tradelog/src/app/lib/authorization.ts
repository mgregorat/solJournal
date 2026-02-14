import { NextRequest } from "next/server";
import { getDbUserFromPrivy } from "@/app/lib/privyServerAuth";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { throwHttp } from "@/app/lib/http";

type DbUser = { id: number; privy_did: string };
type WalletRow = {
  id: number;
  user_id: number;
  wallet_address: string;
  label?: string | null;
  created_at?: string | null;
};

const INTERNAL_SECRET_HEADER = "x-internal-secret";
let loggedMissingInternalSecret = false;

export async function requireUser(req: NextRequest): Promise<DbUser> {
  const dbUser = await getDbUserFromPrivy(req);
  if (!dbUser) {
    throwHttp("unauthorized", "Unauthorized", 401);
  }
  return dbUser;
}

export async function requireOwnedWallet(
  _req: NextRequest,
  dbUser: DbUser,
  walletId?: number | null,
  walletAddress?: string | null
): Promise<WalletRow> {
  const normalizedWalletAddress =
    typeof walletAddress === "string" ? walletAddress.trim() : "";
  const hasWalletId = typeof walletId === "number" && Number.isFinite(walletId);
  const hasWalletAddress = normalizedWalletAddress.length > 0;

  if (!hasWalletId && !hasWalletAddress) {
    throwHttp("bad_request", "walletId or walletAddress is required", 400);
  }

  let wallet: WalletRow | null = null;

  if (hasWalletId) {
    const { data, error } = await supabaseAdmin
      .from("wallets")
      .select("id, user_id, wallet_address, label, created_at")
      .eq("id", walletId as number)
      .eq("user_id", dbUser.id)
      .maybeSingle();

    if (error) {
      throwHttp("wallet_validation_failed", "Wallet validation failed", 500);
    }

    wallet = (data as WalletRow | null) ?? null;
  } else if (hasWalletAddress) {
    const { data, error } = await supabaseAdmin
      .from("wallets")
      .select("id, user_id, wallet_address, label, created_at")
      .eq("wallet_address", normalizedWalletAddress)
      .eq("user_id", dbUser.id)
      .maybeSingle();

    if (error) {
      throwHttp("wallet_validation_failed", "Wallet validation failed", 500);
    }

    wallet = (data as WalletRow | null) ?? null;
  }

  if (!wallet) {
    throwHttp("forbidden", "Forbidden", 403);
  }

  if (hasWalletAddress && wallet.wallet_address !== normalizedWalletAddress) {
    throwHttp("forbidden", "Forbidden", 403);
  }

  return wallet;
}

export function requireInternalRequest(req: NextRequest): void {
  const providedSecret = req.headers.get(INTERNAL_SECRET_HEADER)?.trim();
  const expectedSecret =
    process.env.INTERNAL_API_SECRET?.trim() || process.env.CRON_SECRET?.trim();

  if (!expectedSecret) {
    if (!loggedMissingInternalSecret) {
      loggedMissingInternalSecret = true;
      console.error(
        `[auth] Internal route secret is not configured. Set INTERNAL_API_SECRET (preferred) or CRON_SECRET.`
      );
    }
    throwHttp("unauthorized", "Unauthorized", 401);
  }

  if (!providedSecret || providedSecret !== expectedSecret) {
    throwHttp("unauthorized", "Unauthorized", 401);
  }
}
