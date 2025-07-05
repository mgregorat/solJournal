import { fetchHoldings, fetchSOLBalance } from '@/lib/puppeteer-fetch';

export async function getTokenHoldings(walletAddress: string) {
    // Fetch both token holdings and SOL balance in parallel
    const [holdingsData, solBalanceData] = await Promise.allSettled([
        fetchHoldings(walletAddress),
        fetchSOLBalance(walletAddress)
    ]);

    // Handle token holdings
    let enrichedHoldings: any[] = [];
    if (holdingsData.status === 'fulfilled' && holdingsData.value && 
        holdingsData.value.code === 0 && holdingsData.value.data && holdingsData.value.data.holdings) {
        
        const rawHoldings = holdingsData.value.data.holdings;

        // Filter out tokens that are not currently held (balance is zero or negligible)
        const currentHoldings = rawHoldings.filter((holding: any) => {
            const balance = parseFloat(holding.balance);
            return balance > 1e-9; // Use a small epsilon to avoid floating point issues with dust
        });

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
    } else {
        console.warn('[API/refresh-holdings] Failed to fetch token holdings:', 
            holdingsData.status === 'rejected' ? holdingsData.reason : 'Invalid data structure');
    }

    // Handle SOL balance
    let solBalance = null;
    if (solBalanceData.status === 'fulfilled' && solBalanceData.value) {
        solBalance = solBalanceData.value;
        
        // Add SOL as a holding if balance > 0
        if (solBalance.sol_balance > 0) {
            const solHolding = {
                mint: 'So11111111111111111111111111111111111111112', // Wrapped SOL mint
                amount: solBalance.sol_balance,
                decimals: 9,
                symbol: 'SOL',
                name: 'Solana',
                logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
                currentPrice: solBalance.price_per_sol,
                currentValueUSD: solBalance.usd_value,
                avgEntryPrice: null, // SOL doesn't have cost basis from this API
                totalCostBasis: null,
                unrealizedPnL: null,
                pnlPercentage: null,
                isNativeSOL: true // Flag to identify this as native SOL
            };
            
            // Add SOL holding to the beginning of the array
            enrichedHoldings.unshift(solHolding);
        }
    } else {
        console.warn('[API/refresh-holdings] Failed to fetch SOL balance:', 
            solBalanceData.status === 'rejected' ? solBalanceData.reason : 'No data returned');
    }

    return { 
        holdings: enrichedHoldings,
        solBalance: solBalance // Include raw SOL balance data for additional info if needed
    };
} 