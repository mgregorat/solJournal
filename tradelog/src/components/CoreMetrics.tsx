import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Metrics } from '@/lib/types';

interface CoreMetricsProps {
  metrics: Metrics;
}

const formatCurrency = (value: number) => {
    const options: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: 'USD',
    };

    if (Math.abs(value) > 0 && Math.abs(value) < 0.01) {
        options.minimumFractionDigits = 2;
        options.maximumFractionDigits = 8;
    } else {
        options.minimumFractionDigits = 2;
        options.maximumFractionDigits = 2;
    }

    return new Intl.NumberFormat('en-US', options).format(value);
};

export function CoreMetrics({ metrics }: CoreMetricsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Total Wallet Value</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(metrics.walletValue)}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>All-Time P&L</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${metrics.allTimePnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatCurrency(metrics.allTimePnl)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Today's P&L</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline space-x-2">
            <div className={`text-2xl font-bold ${metrics.dailyPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(metrics.dailyPnl)}
            </div>
            <div className={`text-sm font-semibold ${metrics.dailyPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              ({metrics.dailyPnlPercentage.toFixed(2)}%)
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 