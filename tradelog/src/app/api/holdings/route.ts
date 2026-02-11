import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams, origin } = new URL(request.url);
    const walletAddress = searchParams.get("walletAddress");

    if (!walletAddress) {
      return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
    }

    const response = await fetch(
      `${origin}/api/holdings/gmgn?walletAddress=${encodeURIComponent(walletAddress)}`,
      { cache: "no-store" }
    );
    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error || "Failed to fetch holdings", details: data?.details },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Holdings proxy route error:", error);
    return NextRespnse.json(
      { error: "Failed to fetch holdings", details: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
