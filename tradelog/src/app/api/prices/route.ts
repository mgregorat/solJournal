import { NextRequest, NextResponse } from "next/server";

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
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                return data.data; // Success
            }
            // If response is not OK, log and treat as a failure for this batch
            console.error(`Jupiter API batch request failed for URL: ${url}. Status: ${response.status} ${response.statusText}`);
            return {};
        } catch (error: any) {
            console.error(`Attempt ${i + 1} failed for fetching batch: ${error.message}.`);
            if (i < retries - 1) {
                await new Promise(res => setTimeout(res, delay));
            } else {
                console.error(`All ${retries} retries failed for batch starting with ${mints[0]}.`);
                return {}; // Return empty after all retries fail
            }
        }
    }
    return {};
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ids = searchParams.get("ids");

  if (!ids) {
    return NextResponse.json(
      { error: "Token mint addresses are required" },
      { status: 400 }
    );
  }
  
  const allMints = ids.split(',');
  const validMints = allMints.filter(isValidMint);
  
  const batches: string[][] = [];
  for (let i = 0; i < validMints.length; i += BATCH_SIZE) {
      batches.push(validMints.slice(i, i + BATCH_SIZE));
  }

  try {
    const batchPromises = batches.map(batch => fetchPricesInBatch(batch));
    const results = await Promise.all(batchPromises);

    const combinedData = results.reduce((acc, current) => ({ ...acc, ...current }), {});

    return NextResponse.json({ data: combinedData });
    
  } catch (error: any) {
    console.error("Error fetching from Jupiter API in batches:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while fetching prices." },
      { status: 500 }
    );
  }
} 