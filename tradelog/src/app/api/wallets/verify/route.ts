import { NextRequest, NextResponse } from "next/server";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { TextEncoder } from "util";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { getDbUserFromPrivy } from "@/app/lib/privyServerAuth";

const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const FREE_LIMIT = 2;
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
  try {
    const dbUser = await getDbUserFromPrivy(req);
    if (!dbUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
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
      return NextResponse.json({ error: "Invalid or expired challenge" }, { status: 401 });
    }
    if (new Date(validNonce.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: "Invalid or expired challenge" }, { status: 401 });
    }
    if (validNonce.used_at) {
      return NextResponse.json({ error: "Challenge already used" }, { status: 409 });
    }

    if (message !== validNonce.message) {
      return NextResponse.json({ error: "Invalid challenge message" }, { status: 401 });
    }

    let publicKeyBytes: Uint8Array;
    try {
      publicKeyBytes = bs58.decode(walletAddress);
    } catch {
      return NextResponse.json({ error: "Invalid walletAddress" }, { status: 400 });
    }
    const signatureBytes = decodeSignature(signature);
    if (!signatureBytes) {
      return NextResponse.json({ error: "Invalid signature format" }, { status: 401 });
    }

    const messageBytes = new TextEncoder().encode(validNonce.message);
    const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const { count: walletCount, error: walletCountError } = await supabaseAdmin
      .from("wallets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", dbUser.id);

    if (walletCountError) {
      return NextResponse.json({ error: "Failed to enforce wallet limit" }, { status: 500 });
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
        return NextResponse.json(
          { error: "Wallet limit reached", upgrade_required: true, limit: effectiveLimit, paid_limit: PAID_LIMIT },
          { status: 403 }
        );
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
          return NextResponse.json({ error: "Failed to link wallet" }, { status: 500 });
        }
      } else {
        walletRecord = inserted.data as WalletRecord;
        newlyLinked = true;
      }
    }

    if (!walletRecord) {
      return NextResponse.json({ error: "Failed to resolve linked wallet" }, { status: 500 });
    }

    const { data: usedNonceRow } = await supabaseAdmin
      .from("wallet_link_nonces")
      .update({ used_at: new Date().toISOString() })
      .eq("id", validNonce.id)
      .is("used_at", null)
      .select("id")
      .maybeSingle();

    if (!usedNonceRow) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[wallets/verify] nonce mark-used race", {
          userId: dbUser.id,
          walletAddress,
          nonceRowId: validNonce.id,
          markedUsed: false,
        });
      }
      return NextResponse.json({ error: "Challenge already used" }, { status: 409 });
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("[wallets/verify] nonce verified", {
        userId: dbUser.id,
        walletAddress,
        nonceRowId: validNonce.id,
        markedUsed: true,
      });
    }

    return NextResponse.json({
      ok: true,
      wallet: walletRecord,
      newlyLinked,
    });
  } catch {
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
