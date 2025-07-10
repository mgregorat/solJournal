import { NextRequest, NextResponse } from 'next/server';
import { Holding } from '@/lib/types';

export async function POST(req: NextRequest) {
    try {
        const { walletAddress } = await req.json();

        if (!walletAddress) {
            return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
        }

        const { fetchHoldings, fetchSOLBalance } = await import('@/lib/puppeteer-fetch');
        
        // Fetch holdings and SOL balance sequentially to prevent crashes
        const holdingsData = await fetchHoldings(walletAddress);
        const solBalanceData = await fetchSOLBalance(walletAddress);

        let enrichedHoldings: Holding[] = [];
        if (holdingsData && holdingsData.code === 0 && holdingsData.data && holdingsData.data.holdings) {
            
            const rawHoldings = holdingsData.data.holdings;
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

        if (solBalanceData && solBalanceData.sol_balance > 0) {
            const solBalance = solBalanceData;
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

        return NextResponse.json({ holdings: enrichedHoldings });
    } catch (error: any) {
        console.error('Error refreshing holdings:', error);
        return NextResponse.json({ error: 'Failed to refresh holdings' }, { status: 500 });
    }
}
