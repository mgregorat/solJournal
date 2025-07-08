import { useMemo } from 'react';
import { Trade } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ProFeaturesProps {
  trades: Trade[];
}

const formatCurrency = (value: number) => `${value.toFixed(2)} SOL`;

export default function ProFeatures({ trades }: ProFeaturesProps) {
  const { timeOfDayStats, behavioralSuggestion } = useMemo(() => {
    const hourlyPnl: { [key: number]: { pnl: number, trades: number } } = {};
    for (let i = 0; i < 24; i++) {
      hourlyPnl[i] = { pnl: 0, trades: 0 };
    }

    trades.forEach(trade => {
      const hour = new Date(trade.trade_date).getHours();
      const value = trade.trade_type === 'buy' ? -trade.total_value : trade.total_value;
      hourlyPnl[hour].pnl += value;
      hourlyPnl[hour].trades++;
    });

    const sortedHours = Object.entries(hourlyPnl)
        .filter(([, data]) => data.trades > 0)
        .sort(([, a], [, b]) => b.pnl - a.pnl);

    const bestHour = sortedHours[0];
    const worstHour = sortedHours[sortedHours.length - 1];

    let suggestion = "Keep up the great work!";
    if (worstHour && worstHour[1].pnl < 0) {
        const hour = parseInt(worstHour[0]);
        const timeOfDay = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
        suggestion = `You seem to lose the most in the ${timeOfDay}. Consider reviewing your strategy for trades made around ${hour % 12 || 12}${hour < 12 ? 'am' : 'pm'}.`
    }


    return {
      timeOfDayStats: { best: bestHour, worst: worstHour },
      behavioralSuggestion: suggestion
    };
  }, [trades]);

  const TimeStat = ({ data, label }: { data: [string, {pnl: number, trades: number}], label: string}) => {
    if (!data) return null;
    const hour = parseInt(data[0]);
    const formattedHour = `${hour % 12 || 12}${hour < 12 ? 'am' : 'pm'}`;
    const pnl = data[1].pnl;

    return (
        <div>
            <p className="text-sm font-medium">{label}</p>
            <p className={`text-lg font-bold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formattedHour} ({formatCurrency(pnl)})
            </p>
        </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
        <Card>
            <CardHeader>
                <CardTitle>Time of Day Analysis</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-around">
                {timeOfDayStats.best && <TimeStat data={timeOfDayStats.best} label="Most Profitable Hour" />}
                {timeOfDayStats.worst && <TimeStat data={timeOfDayStats.worst} label="Least Profitable Hour" />}
            </CardContent>
        </Card>
      <Card>
        <CardHeader>
          <CardTitle>Behavioral Suggestion</CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-sm text-gray-300">{behavioralSuggestion}</p>
        </CardContent>
      </Card>
    </div>
  );
} 