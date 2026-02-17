import { useMemo } from 'react';
import { Trade, Setup } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface BreakdownProps {
  trades: Trade[];
  setups: Setup[];
}

const formatPercentage = (value: number) => `${(value * 100).toFixed(0)}%`;
const formatCurrency = (value: number) => `${value.toFixed(2)} SOL`;

export default function Breakdown({ trades, setups }: BreakdownProps) {
  const setupMap = useMemo(() => {
    return new Map(setups.map(s => [s.id, s.name]));
  }, [setups]);

  const { strategyStats, emotionStats } = useMemo(() => {
    // Strategy (Setup) stats
    const strategyUsage: { [key: number]: number } = {};
    const strategyPnl: { [key: number]: { buys: number, sells: number } } = {};
    
    trades.forEach(trade => {
        if (trade.setup_id) {
            if (!strategyUsage[trade.setup_id]) {
                strategyUsage[trade.setup_id] = 0;
                strategyPnl[trade.setup_id] = { buys: 0, sells: 0 };
            }
            strategyUsage[trade.setup_id]++;
            strategyPnl[trade.setup_id][trade.trade_type === 'buy' ? 'buys' : 'sells'] += trade.total_value ?? 0;
        }
    });

    const totalSetupTrades = Object.values(strategyUsage).reduce((a, b) => a + b, 0);
    const finalStrategyStats = Object.keys(strategyUsage).map(idStr => {
      const id = Number(idStr);
      const pnl = strategyPnl[id].sells - strategyPnl[id].buys;
      return {
        name: setupMap.get(id) || 'Unknown Setup',
        usage: totalSetupTrades > 0 ? strategyUsage[id] / totalSetupTrades : 0,
        winRate: strategyPnl[id].buys > 0 ? (strategyPnl[id].sells - strategyPnl[id].buys) / strategyPnl[id].buys : 0, // Simplified as ROI for now
        isWinner: pnl > 0
      };
    }).sort((a,b) => b.usage - a.usage);


    // Emotion stats
    const emotionPnl: { [key: string]: number } = {};
    trades.forEach(trade => {
        const tradeTotal = trade.total_value ?? 0;
        const pnl = trade.trade_type === 'buy' ? -tradeTotal : tradeTotal;
        if (trade.emotion_tags && trade.emotion_tags.length > 0) {
            trade.emotion_tags.forEach(tag => {
                if (!emotionPnl[tag]) emotionPnl[tag] = 0;
                emotionPnl[tag] += pnl;
            });
        }
    });

    const finalEmotionStats = Object.keys(emotionPnl)
      .map(tag => ({ name: tag, pnl: emotionPnl[tag] }))
      .filter(e => e.pnl < 0)
      .sort((a, b) => a.pnl - b.pnl);

    return { strategyStats: finalStrategyStats, emotionStats: finalEmotionStats };
  }, [trades, setupMap]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Strategy Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {strategyStats.map(stat => (
              <div key={stat.name}>
                <div className="flex justify-between text-sm">
                  <span>{stat.name} ({formatPercentage(stat.usage)} used)</span>
                  <span className={stat.isWinner ? 'text-green-400' : 'text-red-400'}>
                    {formatPercentage(stat.winRate)} ROI
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Top Losing Emotions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {emotionStats.slice(0, 5).map(stat => (
              <div key={stat.name} className="flex justify-between text-sm">
                <span>{stat.name}</span>
                <span className="text-red-400">{formatCurrency(stat.pnl)}</span>
              </div>
            ))}
            {emotionStats.length === 0 && <p className="text-sm text-gray-500">No losing emotions tagged.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 
