import { NextRequest } from "next/server";
import { throwHttp, withTiming } from "@/app/lib/http";

const JUPITER_API_URL = "https://price.jup.ag/v4/price";
const BATCH_SIZE = 50; // Number of mints per batch request

// Basic validation for a Solana public key
const isValidMint = (mint: string): boolean => {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint);
}

async function fetchPricesInBatch(mints: string[], retries = 3, delay = 1000) {
  if (mints.length === 0) return {};
  const url = `${JUPITER_API_URL}?ids=${mints.join(',')}`;

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (response.ok) {
        const data = await response.json();
        return data.data; // Success
      }
      if (response.status === 429) {
        throwHttp("rate_limited", "Rate limited", 429);
      }
      if (response.status === 400) {
        throwHttp("bad_request", "Invalid token mint addresses", 400);
      }
      throwHttp("provider_unavailable", "Price provider unavailable", 502);
    } catch (error: any) {
      if (i < retries - 1) {
        await new Promise(res => setTimeout(res, delay));
      } else {
        if (error?.name === "TimeoutError" || error?.name === "AbortError") {
          throwHttp("provider_timeout", "Price provider timeout", 504);
        }
        throwHttp("provider_unavailable", "Price provider unavailable", 502);
      }
    }
  }
  throwHttp("provider_unavailable", "Price provider unavailable", 502);
}

export async function GET(req: NextRequest) {
  return withTiming(req, async () => {
    const { searchParams } = new URL(req.url);
    const ids = searchParams.get("ids");
    if (!ids) {
      throwHttp("bad_request", "Token mint addresses are required", 400);
    }

    const allMints = ids.split(',');
    const validMints = allMints.filter(isValidMint);
    if (validMints.length === 0) {
      throwHttp("bad_request", "No valid token mint addresses provided", 400);
    }

    const batches: string[][] = [];
    for (let i = 0; i < validMints.length; i += BATCH_SIZE) {
      batches.push(validMints.slice(i, i + BATCH_SIZE));
    }
    const batchPromises = batches.map(batch => fetchPricesInBatch(batch));
    const results = await Promise.all(batchPromises);
    const combinedData = results.reduce((acc, current) => ({ ...acc, ...current }), {});
    return { prices: combinedData };
  });
} 
