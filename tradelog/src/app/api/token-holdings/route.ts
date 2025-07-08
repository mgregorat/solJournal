import { getTokenHoldings } from "@/lib/portfolio";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const walletAddress = searchParams.get('walletAddress');
    
    if (!walletAddress) {
      return NextResponse.json(
        { error: "Wallet address is required" },
        { status: 400 }
      );
    }

    const holdings = await getTokenHoldings(walletAddress);
    return NextResponse.json(holdings);

  } catch (error: any) {
    console.error("Token holdings API error:", error);
    // The helper function might throw specific errors, we can handle them here
    return NextResponse.json({ error: error.message || "An unexpected error occurred." }, { status: 500 });
  }
} 