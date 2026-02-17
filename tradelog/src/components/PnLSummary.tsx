import { useMemo } from 'react';
import { Trade } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PnLSummaryProps {
  trades: Trade[];
}

const formatCurrency = (value: number) => {
  return `${value.toFixed(2)} SOL`;
};

export default function PnLSummary({ trades }: PnLSummaryProps) {
  const pnl = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let lifetimeBuy = 0, lifetimeSell = 0;
    let thirtyDayBuy = 0, thirtyDaySell = 0;
    let sevenDayBuy = 0, sevenDaySell = 0;

    for (const trade of trades) {
      const tradeDate = new Date(trade.trade_date);
      const value = trade.total_value ?? 0;

      if (trade.trade_type === 'buy') {
        lifetimeBuy += value;
        if (tradeDate > thirtyDaysAgo) thirtyDayBuy += value;
        if (tradeDate > sevenDaysAgo) sevenDayBuy += value;
      } else {
        lifetimeSell += value;
        if (tradeDate > thirtyDaysAgo) thirtyDaySell += value;
        if (tradeDate > sevenDaysAgo) sevenDaySell += value;
      }
    }

    return {
      lifetime: lifetimeSell - lifetimeBuy,
      thirtyDay: thirtyDaySell - thirtyDayBuy,
      sevenDay: sevenDaySell - sevenDayBuy,
    };
  }, [trades]);

  const PnLCard = ({ title, value }: { title: string, value: number }) => (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {formatCurrency(value)}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <PnLCard title="Lifetime PnL" value={pnl.lifetime} />
      <PnLCard title="30-Day PnL" value={pnl.thirtyDay} />
      <PnLCard title="7-Day PnL" value={pnl.sevenDay} />
    </div>
  );
} 
