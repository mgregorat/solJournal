import { NextRequest } from 'next/server';
import { Holding } from '@/lib/types';
import { throwHttp, withTiming } from '@/app/lib/http';

export async function POST(req: NextRequest) {
    return withTiming(req, async () => {
        const { walletAddress } = await req.json();

        if (!walletAddress) {
            throwHttp("bad_request", "Wallet address is required", 400);
        }

        const { fetchHoldings, fetchSOLBalance } = await import('@/lib/puppeteer-fetch');
        
        // Now that we use a single browser instance, parallel fetching is fast and safe.
        const [holdingsData, solBalanceData] = await Promise.allSettled([
            fetchHoldings(walletAddress),
            fetchSOLBalance(walletAddress)
        ]);

        let enrichedHoldings: Holding[] = [];
        if (holdingsData.status === 'fulfilled' && holdingsData.value && 
            holdingsData.value.code === 0 && holdingsData.value.data && holdingsData.value.data.holdings) {
            
            const rawHoldings = holdingsData.value.data.holdings;
            const currentHoldings = rawHoldings.filter((holding: any) => parseFloat(holding.balance) > 1e-9);

            enrichedHoldings = currentHoldings.map((holding: any): Holding => {
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
            const solHolding: Holding = {
                mint: 'So11111111111111111111111111111111111111112',
                amount: solBalance.sol_balance,
                decimals: 9,
                symbol: 'SOL',
                name: 'Solana',
                logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
                currentPrice: solBalance.price_per_sol,
                currentValueUSD: solBalance.usd_value,
                avgEntryPrice: undefined,
                totalCostBasis: undefined,
                unrealizedPnL: undefined,
                pnlPercentage: undefined,
                isNativeSOL: true
            };
            enrichedHoldings.unshift(solHolding);
        }

        return { holdings: enrichedHoldings };
    });
}
