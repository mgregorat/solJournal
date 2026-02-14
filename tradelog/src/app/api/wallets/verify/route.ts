import { NextRequest } from "next/server";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { TextEncoder } from "util";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { getDbUserFromPrivy } from "@/app/lib/privyServerAuth";
import { throwHttp, withTiming } from "@/app/lib/http";

const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const FREE_LIMIT = 3;
const PAID_LIMIT = 10; // Reserved for future plan checks.
type WalletRecord = { id: number; wallet_address: string; label: string | null; created_at: string | null };
type NonceRecord = { id: number; message: string; used_at: string | null; expires_at: string };

function isValidSolanaAddress(value: unknown): value is string {
  return typeof value === "string" && SOLANA_ADDRESS_REGEX.test(value);
}

function decodeSignature(signature: string): Uint8Array | null {
  try {
    const base58Decoded = bs58.decode(signature);
    if (base58Decoded.length === 64) {
      return base58Decoded;
    }
  } catch {
    // Try base64 fallback below.
  }

  try {
    const base64Decoded = Buffer.from(signature, "base64");
    if (base64Decoded.length === 64) {
      return new Uint8Array(base64Decoded);
    }
  } catch {
    return null;
  }

  return null;
}

export async function POST(req: NextRequest) {
  return withTiming(req, async () => {
    const dbUser = await getDbUserFromPrivy(req);
    if (!dbUser) {
      throwHttp("unauthorized", "Unauthorized", 401);
    }

    const body = await req.json().catch(() => ({}));
    const walletAddress = body?.walletAddress;
    const nonce = body?.nonce;
    const message = body?.message;
    const signature = body?.signature;

    if (
      !isValidSolanaAddress(walletAddress) ||
      typeof nonce !== "string" ||
      typeof message !== "string" ||
      typeof signature !== "string" ||
      nonce.length === 0 ||
      message.length === 0 ||
      signature.length === 0
    ) {
      throwHttp("bad_request", "Invalid request payload", 400);
    }

    const nowIso = new Date().toISOString();
    const { data: nonceRow } = await supabaseAdmin
      .from("wallet_link_nonces")
      .select("id, message, used_at, expires_at")
      .eq("user_id", dbUser.id)
      .eq("wallet_address", walletAddress)
      .eq("nonce", nonce)
      .maybeSingle();

    const validNonce = nonceRow as NonceRecord | null;
    if (!validNonce) {
      throwHttp("unauthorized", "Invalid or expired challenge", 401);
    }
    if (new Date(validNonce.expires_at).getTime() <= Date.now()) {
      throwHttp("unauthorized", "Invalid or expired challenge", 401);
    }
    if (validNonce.used_at) {
      throwHttp("conflict", "Challenge already used", 409);
    }

    if (message !== validNonce.message) {
      throwHttp("unauthorized", "Invalid challenge message", 401);
    }

    let publicKeyBytes: Uint8Array;
    try {
      publicKeyBytes = bs58.decode(walletAddress);
    } catch {
      throwHttp("bad_request", "Invalid walletAddress", 400);
    }
    const signatureBytes = decodeSignature(signature);
    if (!signatureBytes) {
      throwHttp("unauthorized", "Invalid signature format", 401);
    }

    const messageBytes = new TextEncoder().encode(validNonce.message);
    const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    if (!isValid) {
      throwHttp("unauthorized", "Invalid signature", 401);
    }

    const { count: walletCount, error: walletCountError } = await supabaseAdmin
      .from("wallets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", dbUser.id);

    if (walletCountError) {
      throwHttp("internal_error", "Failed to enforce wallet limit", 500);
    }

    const effectiveLimit = FREE_LIMIT;
    if ((walletCount || 0) >= effectiveLimit) {
      const { data: existingWallet } = await supabaseAdmin
        .from("wallets")
        .select("id, wallet_address, label, created_at")
        .eq("user_id", dbUser.id)
        .eq("wallet_address", walletAddress)
        .maybeSingle();

      if (!existingWallet) {
        throwHttp("forbidden", "Wallet limit reached", 403);
      }
    }

    const existingWalletResult = await supabaseAdmin
      .from("wallets")
      .select("id, wallet_address, label, created_at")
      .eq("user_id", dbUser.id)
      .eq("wallet_address", walletAddress)
      .maybeSingle();

    let walletRecord = existingWalletResult.data as WalletRecord | null;
    let newlyLinked = false;
    if (!walletRecord) {
      const inserted = await supabaseAdmin
        .from("wallets")
        .insert({
          user_id: dbUser.id,
          wallet_address: walletAddress,
          label: null,
        })
        .select("id, wallet_address, label, created_at")
        .single();

      if (inserted.error) {
        if (inserted.error.code === "23505") {
          const existingAfterConflict = await supabaseAdmin
            .from("wallets")
            .select("id, wallet_address, label, created_at")
            .eq("user_id", dbUser.id)
            .eq("wallet_address", walletAddress)
            .single();
          walletRecord = existingAfterConflict.data as WalletRecord | null;
        } else {
          throwHttp("internal_error", "Failed to link wallet", 500);
        }
      } else {
        walletRecord = inserted.data as WalletRecord;
        newlyLinked = true;
      }
    }

    if (!walletRecord) {
      throwHttp("internal_error", "Failed to resolve linked wallet", 500);
    }

    const { data: usedNonceRow } = await supabaseAdmin
      .from("wallet_link_nonces")
      .update({ used_at: new Date().toISOString() })
      .eq("id", validNonce.id)
      .is("used_at", null)
      .select("id")
      .maybeSingle();

    if (!usedNonceRow) {
      throwHttp("conflict", "Challenge already used", 409);
    }

    return {
      wallet: walletRecord,
      newlyLinked,
    };
  });
}
