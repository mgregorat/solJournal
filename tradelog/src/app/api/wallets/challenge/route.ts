import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { getDbUserFromPrivy } from "@/app/lib/privyServerAuth";

const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function isValidSolanaAddress(value: unknown): value is string {
  return typeof value === "string" && SOLANA_ADDRESS_REGEX.test(value);
}

function buildChallengeMessage(params: {
  userId: number;
  walletAddress: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
}) {
  return [
    "TradeLog - Link Wallet",
    `User: ${params.userId}`,
    `Wallet: ${params.walletAddress}`,
    `Nonce: ${params.nonce}`,
    `Issued At: ${params.issuedAt}`,
    `Expires At: ${params.expiresAt}`,
  ].join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const dbUser = await getDbUserFromPrivy(req);
    if (!dbUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const walletAddress = body?.walletAddress;
    if (!isValidSolanaAddress(walletAddress)) {
      return NextResponse.json({ error: "Invalid walletAddress" }, { status: 400 });
    }

    const now = new Date();
    const issuedAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + 5 * 60_000).toISOString();

    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const nonce = randomBytes(16).toString("hex");
      const message = buildChallengeMessage({
        userId: dbUser.id,
        walletAddress,
        nonce,
        issuedAt,
        expiresAt,
      });

      const { data: insertedNonceRow, error } = await supabaseAdmin
        .from("wallet_link_nonces")
        .insert({
          user_id: dbUser.id,
          wallet_address: walletAddress,
          nonce,
          message,
          expires_at: expiresAt,
        })
        .select("id")
        .single();

      if (!error) {
        if (process.env.NODE_ENV !== "production") {
          console.log("[wallets/challenge] nonce created", {
            userId: dbUser.id,
            walletAddress,
            expiresAt,
            nonceRowId: insertedNonceRow?.id ?? null,
          });
        }
        return NextResponse.json({
          nonce,
          message,
          expiresAt,
        });
      }

      lastError = error;
      // Retry nonce collisions up to two additional times.
      if (error.code !== "23505") {
        break;
      }
    }

    return NextResponse.json(
      { error: "Failed to create wallet link challenge", details: (lastError as any)?.message || "Unknown error" },
      { status: 500 }
    );
  } catch {
    return NextResponse.json({ error: "Failed to create wallet link challenge" }, { status: 500 });
  }
}
