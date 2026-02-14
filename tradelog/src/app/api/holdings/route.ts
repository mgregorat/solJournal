import { NextRequest } from "next/server";
import { requireOwnedWallet, requireUser } from "@/app/lib/authorization";
import { throwHttp, withTiming } from "@/app/lib/http";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withTiming(request, async () => {
    const { searchParams, origin } = new URL(request.url);
    const walletIdParam = searchParams.get("walletId");
    const walletAddress = searchParams.get("walletAddress");

    const dbUser = await requireUser(request);

    let walletId: number | null = null;
    if (walletIdParam) {
      walletId = parseInt(walletIdParam, 10);
      if (isNaN(walletId)) {
        throwHttp("bad_request", "Invalid walletId format", 400);
      }
    }

    const ownedWallet = await requireOwnedWallet(request, dbUser, walletId, walletAddress);

    const response = await fetch(
      `${origin}/api/holdings/gmgn?walletId=${encodeURIComponent(String(ownedWallet.id))}`,
      {
        cache: "no-store",
        headers: {
          ...(request.headers.get("authorization")
            ? { authorization: request.headers.get("authorization") as string }
            : {}),
          ...(request.headers.get("x-request-id")
            ? { "x-request-id": request.headers.get("x-request-id") as string }
            : {}),
        },
      }
    );
    let responseData: any = null;
    try {
      responseData = await response.json();
    } catch {
      responseData = null;
    }

    if (!response.ok) {
      if (response.status === 401) {
        throwHttp("unauthorized", "Unauthorized", 401);
      }
      if (response.status === 403) {
        throwHttp("forbidden", "Forbidden", 403);
      }
      if (response.status === 400) {
        throwHttp("bad_request", "Failed to fetch holdings", 400);
      }
      if (response.status === 429) {
        throwHttp("rate_limited", "Rate limited", 429);
      }
      if (response.status === 500) {
        throwHttp("provider_unavailable", "Failed to fetch holdings", 502);
      }
      throwHttp("internal_error", "Failed to fetch holdings", 500);
    }

    return {
      holdings: responseData,
      wallet: {
        id: ownedWallet.id,
        walletAddress: ownedWallet.wallet_address,
      },
    };
  });
}
