import { NextRequest } from "next/server";
import { createPublicKey, createVerify } from "crypto";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

type JwtPayload = {
  sub?: string;
  aud?: string | string[];
  iss?: string;
  exp?: number;
  iat?: number;
  nbf?: number;
  privy_did?: string;
  userId?: string;
};

function fromBase64Url(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64");
}

function joseToDer(signature: Buffer): Buffer {
  if (signature.length !== 64) {
    throw new Error("Invalid ES256 signature length");
  }

  const r = signature.subarray(0, 32);
  const s = signature.subarray(32);

  const trim = (buf: Buffer) => {
    let i = 0;
    while (i < buf.length - 1 && buf[i] === 0) i++;
    let out = buf.subarray(i);
    if (out[0] & 0x80) {
      out = Buffer.concat([Buffer.from([0]), out]);
    }
    return out;
  };

  const rDer = trim(r);
  const sDer = trim(s);
  const totalLength = 2 + rDer.length + 2 + sDer.length;

  return Buffer.concat([
    Buffer.from([0x30, totalLength, 0x02, rDer.length]),
    rDer,
    Buffer.from([0x02, sDer.length]),
    sDer,
  ]);
}

function getPrivyVerificationKey(): string {
  const key =
    process.env.PRIVY_JWT_VERIFICATION_KEY ||
    process.env.PRIVY_VERIFICATION_KEY ||
    process.env.PRIVY_PUBLIC_KEY;

  if (!key) {
    throw new Error("Missing Privy verification key");
  }
  return key;
}

function getTokenFromRequest(req: NextRequest): string | null {
  // We expect Privy ACCESS TOKENS from `usePrivy().getAccessToken()`,
  // passed as `Authorization: Bearer <token>`, not idTokens.
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }
  return null;
}

function extractJwtDebugClaims(token: string): { alg?: string; iss?: string; aud?: string | string[] } {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return {};
    const header = JSON.parse(fromBase64Url(parts[0]).toString("utf8")) as { alg?: string };
    const payload = JSON.parse(fromBase64Url(parts[1]).toString("utf8")) as JwtPayload;
    return { alg: header.alg, iss: payload.iss, aud: payload.aud };
  } catch {
    return {};
  }
}

function verifyPrivyJwt(token: string): JwtPayload {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid token format");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = JSON.parse(fromBase64Url(encodedHeader).toString("utf8")) as { alg?: string; typ?: string };
  const payload = JSON.parse(fromBase64Url(encodedPayload).toString("utf8")) as JwtPayload;

  if (header.alg !== "ES256" && header.alg !== "RS256") {
    throw new Error("Unsupported token algorithm");
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp <= now) {
    throw new Error("Token expired");
  }
  if (typeof payload.nbf === "number" && payload.nbf > now) {
    throw new Error("Token not active yet");
  }

  const configuredIssuers = (process.env.PRIVY_ACCESS_TOKEN_ISSUER || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const allowedIssuers = configuredIssuers.length
    ? configuredIssuers
    : ["privy.io", "https://auth.privy.io", "https://privy.io"];

  if (!payload.iss || !allowedIssuers.includes(payload.iss)) {
    throw new Error("Invalid token issuer");
  }

  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (appId) {
    const aud = payload.aud;
    const validAudience = Array.isArray(aud) ? aud.includes(appId) : aud === appId;
    if (!validAudience) {
      throw new Error("Invalid token audience");
    }
  }

  const key = createPublicKey(getPrivyVerificationKey());
  const verify = createVerify("SHA256");
  verify.update(`${encodedHeader}.${encodedPayload}`);
  verify.end();

  const rawSignature = fromBase64Url(encodedSignature);
  const signatureBytes = header.alg === "ES256" ? joseToDer(rawSignature) : rawSignature;
  const ok = verify.verify(key, signatureBytes);
  if (!ok) {
    throw new Error("Invalid token signature");
  }

  return payload;
}

export async function getDbUserFromPrivy(req: NextRequest): Promise<{ id: number; privy_did: string } | null> {
  const hasBearerAuth = Boolean(req.headers.get("authorization")?.startsWith("Bearer "));
  const token = getTokenFromRequest(req);
  if (!token) {
    console.warn("[privyServerAuth] Missing access token in Authorization header", {
      hasBearerAuth,
    });
    return null;
  }

  let payload: JwtPayload;
  try {
    payload = verifyPrivyJwt(token);
  } catch {
    const debugClaims = extractJwtDebugClaims(token);
    console.warn("[privyServerAuth] Access token verification failed", {
      alg: debugClaims.alg,
      iss: debugClaims.iss,
      aud: debugClaims.aud,
    });
    return null;
  }

  const privyDid = payload.sub || payload.privy_did || payload.userId;
  if (!privyDid || typeof privyDid !== "string") {
    return null;
  }

  const { data: existingUser } = await supabaseAdmin
    .from("users")
    .select("id, privy_did")
    .eq("privy_did", privyDid)
    .single();

  if (existingUser?.id) {
    return { id: Number(existingUser.id), privy_did: String(existingUser.privy_did || privyDid) };
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("users")
    .insert({ privy_did: privyDid })
    .select("id, privy_did")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: raceUser } = await supabaseAdmin
        .from("users")
        .select("id, privy_did")
        .eq("privy_did", privyDid)
        .single();
      if (raceUser?.id) {
        return { id: Number(raceUser.id), privy_did: String(raceUser.privy_did || privyDid) };
      }
    }
    return null;
  }

  if (!inserted?.id) {
    return null;
  }

  return { id: Number(inserted.id), privy_did: String(inserted.privy_did || privyDid) };
}
