import { getTrades } from "@/lib/trades";
import { DashboardClient } from "../dashboard/DashboardClient";
import { cookies } from "next/headers";
import { Trade } from "@/lib/types";

export default async function JournalPageRoute() {
  const cookieStore = cookies();
  const walletAddress = cookieStore.get("walletAddress")?.value;

  let trades: Trade[] = [];

  if (walletAddress) {
    try {
      trades = await getTrades(walletAddress);
    } catch (error) {
      console.error("Failed to fetch journal route data:", error);
    }
  }

  return (
    <DashboardClient
      initialHoldings={null}
      initialTrades={trades}
      initialActiveItem="Journal"
    />
  );
}
