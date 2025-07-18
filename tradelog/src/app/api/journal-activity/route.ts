import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import { Trade } from '@/lib/types';

interface JournalEvent {
  id: string;
  status: 'CLOSED' | 'OPEN';
  token_symbol: string;
  token_logo?: string;
  token_address: string;
  date: string;
  sell_value_usd?: number;
  cost_basis_usd?: number;
  realized_pnl_usd?: number;
  realized_pnl_percent?: number;
  sell_tx_hash?: string;
  held_amount?: number;
  avg_buy_price?: number;
  total_cost?: number;
  current_price?: number;
  current_value_usd?: number;
  unrealized_pnl_usd?: number;
  unrealized_pnl_percent?: number;
  tags?: string[];
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const walletAddress = searchParams.get('walletAddress');

    if (!userId || !walletAddress) {
        return NextResponse.json({ error: 'userId and walletAddress are required' }, { status: 400 });
    }

    try {
        const { data: trades, error } = await supabaseAdmin
            .from('synced_trades')
            .select('*')
            .eq('user_id', userId)
            .eq('wallet_address', walletAddress)
            .order('trade_date', { ascending: true });

        if (error) throw error;

        const tradesByToken = trades.reduce((acc, trade) => {
            if (!acc[trade.token_address]) acc[trade.token_address] = [];
            acc[trade.token_address].push(trade);
            return acc;
        }, {} as Record<string, Trade[]>);

        const journalEvents: JournalEvent[] = [];
        const openPositionTokens: string[] = [];

        for (const tokenAddress in tradesByToken) {
            let totalAmount = 0;
            let totalCost = 0;
            let lastBuyDate = '';

            for (const trade of tradesByToken[tokenAddress]) {
                if (trade.event_type === 'buy') {
                    totalAmount += trade.token_amount;
                    totalCost += trade.cost_usd;
                    lastBuyDate = trade.trade_date;
                } else if (trade.event_type === 'sell' && totalAmount > 0) {
                    const avgBuyPrice = totalCost / totalAmount;
                    const costForThisSell = avgBuyPrice * trade.token_amount;
                    const pnl = trade.cost_usd - costForThisSell;

                    journalEvents.push({
                        id: trade.tx_hash,
                        status: 'CLOSED',
                        token_symbol: trade.token_symbol,
                        token_logo: trade.token_logo,
                        token_address: trade.token_address,
                        date: trade.trade_date,
                        sell_value_usd: trade.cost_usd,
                        cost_basis_usd: costForThisSell,
                        realized_pnl_usd: pnl,
                        realized_pnl_percent: costForThisSell > 0 ? (pnl / costForThisSell) * 100 : 0,
                        sell_tx_hash: trade.tx_hash,
                    });

                    totalCost -= costForThisSell;
                    totalAmount -= trade.token_amount;
                }
            }

            if (totalAmount > 1e-9) {
                openPositionTokens.push(tokenAddress);
                journalEvents.push({
                    id: tokenAddress,
                    status: 'OPEN',
                    token_symbol: tradesByToken[tokenAddress][0].token_symbol,
                    token_logo: tradesByToken[tokenAddress][0].token_logo,
                    token_address: tokenAddress,
                    date: lastBuyDate,
                    held_amount: totalAmount,
                    avg_buy_price: totalCost / totalAmount,
                    total_cost: totalCost,
                });
            }
        }

        if (openPositionTokens.length > 0) {
            const priceUrl = `https://api.dexscreener.com/latest/dex/tokens/${openPositionTokens.join(',')}`;
            const priceResponse = await fetch(priceUrl);
            const priceData = await priceResponse.json();
            const priceMap = (priceData.pairs || []).reduce((acc: any, pair: any) => {
                acc[pair.baseToken.address] = parseFloat(pair.priceUsd);
                return acc;
            }, {});

            for (const event of journalEvents) {
                if (event.status === 'OPEN' && priceMap[event.token_address]) {
                    event.current_price = priceMap[event.token_address];
                    event.current_value_usd = event.held_amount! * event.current_price;
                    event.unrealized_pnl_usd = event.current_value_usd - event.total_cost!;
                    event.unrealized_pnl_percent = (event.unrealized_pnl_usd / event.total_cost!) * 100;
                }
            }
        }

        const sortedEvents = journalEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        // Ensure tags are always an array
        sortedEvents.forEach(event => {
          if (!event.tags) {
            event.tags = [];
          }
        });

        return NextResponse.json(sortedEvents);

    } catch (error: any) {
        console.error(`An error occurred during P&L calculation for user ${userId}:`, error);
        return NextResponse.json({ error: 'Failed to calculate P&L', details: error.message }, { status: 500 });
    }
} 