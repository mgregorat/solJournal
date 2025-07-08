import { getCache, setCache } from './cache';

const BIRDEYE_API_URL = "https://public-api.birdeye.so/public/price?address=";
const WRAPPED_SOL_MINT = "So11111111111111111111111111111111111111112";
const CACHE_TTL_SECONDS = 60 * 5; // 5 minutes

type PriceMap = { [mint: string]: { price: number } };

/**
 * Fetches prices for a set of mints, using a cache to avoid redundant requests.
 * @param mints A set of mint addresses to fetch prices for.
 * @returns A promise that resolves to a map of mint addresses to their price info.
 */
export async function getPrices(mints: Set<string>): Promise<PriceMap> {
  const cacheKey = 'prices';
  const cachedPrices = getCache<PriceMap>(cacheKey);

  const mintsToFetch = new Set<string>();
  const freshPrices: PriceMap = {};

  if (cachedPrices) {
    Object.assign(freshPrices, cachedPrices);
    for (const mint of mints) {
      if (!cachedPrices[mint]) {
        mintsToFetch.add(mint);
      }
    }
  } else {
    for (const mint of mints) {
      mintsToFetch.add(mint);
    }
  }

  if (mintsToFetch.size === 0) {
    return freshPrices;
  }
  
  try {
    const mintsArray = Array.from(mintsToFetch);
    const requests = mintsArray.map(mint => 
      fetch(`${BIRDEYE_API_URL}${mint}`).then(res => res.json())
    );
    const results = await Promise.all(requests);
    
    const newPriceMap: PriceMap = {};
    results.forEach((result, index) => {
      if (result.success && result.data?.value) {
        const mint = mintsArray[index];
        newPriceMap[mint] = { price: result.data.value };
      }
    });
    
    const combinedPrices = { ...freshPrices, ...newPriceMap };
    setCache(cacheKey, combinedPrices, CACHE_TTL_SECONDS);
    return combinedPrices;

  } catch (error) {
    console.error("Failed to fetch prices:", error);
    return freshPrices; // Return what we have, even if some fetches failed
  }
}

export async function getTokenHoldings(walletAddress: string) {
  const { fetchHoldings, fetchSOLBalance } = await import('@/lib/puppeteer-fetch');
  
  const [holdingsData, solBalanceData] = await Promise.allSettled([
      fetchHoldings(walletAddress),
      fetchSOLBalance(walletAddress)
  ]);

  let enrichedHoldings: any[] = [];
  if (holdingsData.status === 'fulfilled' && holdingsData.value && 
      holdingsData.value.code === 0 && holdingsData.value.data && holdingsData.value.data.holdings) {
      
      const rawHoldings = holdingsData.value.data.holdings;
      const currentHoldings = rawHoldings.filter((holding: any) => parseFloat(holding.balance) > 1e-9);

      enrichedHoldings = currentHoldings.map((holding: any) => {
          const { token, balance, usd_value, price, avg_cost, cost, unrealized_profit, unrealized_pnl } = holding;
          return {
              mint: token.address,
              amount: parseFloat(balance),
              decimals: token.decimals,
              symbol: token.symbol,
              name: token.name,
              logoURI: token.logo,
              currentPrice: parseFloat(price),
              currentValueUSD: parseFloat(usd_value),
              avgEntryPrice: parseFloat(avg_cost),
              totalCostBasis: parseFloat(cost),
              unrealizedPnL: parseFloat(unrealized_profit),
              pnlPercentage: parseFloat(unrealized_pnl) * 100,
          };
      });
  }

  if (solBalanceData.status === 'fulfilled' && solBalanceData.value && solBalanceData.value.sol_balance > 0) {
      const solBalance = solBalanceData.value;
      const solHolding = {
          mint: 'So11111111111111111111111111111111111111112',
          amount: solBalance.sol_balance,
          decimals: 9,
          symbol: 'SOL',
          name: 'Solana',
          logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
          currentPrice: solBalance.price_per_sol,
          currentValueUSD: solBalance.usd_value,
          avgEntryPrice: null,
          totalCostBasis: null,
          unrealizedPnL: null,
          pnlPercentage: null,
          isNativeSOL: true
      };
      enrichedHoldings.unshift(solHolding);
  }

  return enrichedHoldings;
} 