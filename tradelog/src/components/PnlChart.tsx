import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Trade } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface PnlChartProps {
  trades: Trade[];
}

type Grouping = 'daily' | 'weekly';

export default function PnlChart({ trades }: PnlChartProps) {
  const [grouping, setGrouping] = useState<Grouping>('daily');

  const chartData = useMemo(() => {
    const data: { [key: string]: number } = {};
    
    trades.forEach(trade => {
      const date = new Date(trade.trade_date);
      let key: string;

      if (grouping === 'daily') {
        key = date.toLocaleDateString('en-CA'); // YYYY-MM-DD
      } else { // weekly
        const day = date.getDay();
        const firstDayOfWeek = new Date(date.setDate(date.getDate() - day + (day === 0 ? -6 : 1)));
        key = firstDayOfWeek.toLocaleDateString('en-CA');
      }
      
      if (!data[key]) data[key] = 0;
      const tradeTotal = trade.total_value ?? 0;
      const value = trade.trade_type === 'buy' ? -tradeTotal : tradeTotal;
      data[key] += value;
    });

    return Object.keys(data).sort().map(key => ({
      name: key,
      pnl: data[key]
    }));
  }, [trades, grouping]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>PnL by {grouping === 'daily' ? 'Day' : 'Week'}</CardTitle>
        <div className="flex gap-2">
            <Button variant={grouping === 'daily' ? 'secondary' : 'ghost'} size="sm" onClick={() => setGrouping('daily')}>Daily</Button>
            <Button variant={grouping === 'weekly' ? 'secondary' : 'ghost'} size="sm" onClick={() => setGrouping('weekly')}>Weekly</Button>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 20, right: 0, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#e5e7eb' }}
              labelStyle={{ color: '#9ca3af' }}
            />
            <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#22c55e' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
} 
