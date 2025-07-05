import { getTrades } from "@/lib/trades";
import { DashboardClient } from "./DashboardClient";
import { cookies } from "next/headers";

export default async function DashboardPage() {
  const cookieStore = cookies();
  const walletAddress = cookieStore.get("walletAddress")?.value;

  let trades = [];

  if (walletAddress) {
    try {
      trades = await getTrades(walletAddress);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      // Handle error appropriately
    }
  }

  return <DashboardClient initialHoldings={null} initialTrades={trades} />;
} 