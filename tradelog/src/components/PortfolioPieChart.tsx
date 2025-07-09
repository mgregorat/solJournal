"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useState } from 'react';
import { Holding } from '@/lib/types';

interface PortfolioPieChartProps {
    holdings: Holding[];
}

interface ChartData {
    name: string;
    value: number;
    symbol: string;
}

const COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', 
  '#FF4560', '#775DD0', '#546E7A', '#26a69a', '#D10CE8'
];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-800 text-white p-2 rounded-md border border-gray-700 shadow-lg">
        <p className="font-semibold">{`${payload[0].name}`}</p>
        <p className="text-sm">{`Value: $${(payload[0].value).toFixed(2)}`}</p>
        <p className="text-xs text-gray-400">{`(${payload[0].payload.percent.toFixed(2)}%)`}</p>
      </div>
    );
  }
  return null;
};

export function PortfolioPieChart({ holdings }: PortfolioPieChartProps) {
    const [chartType, setChartType] = useState<'pie' | 'bar'>('pie');

    const totalValue = holdings.reduce((acc, curr) => acc + (curr.currentValueUSD || 0), 0);

    const processedHoldings = holdings
      .filter(h => h.currentValueUSD && h.currentValueUSD > 0)
      .sort((a, b) => (b.currentValueUSD || 0) - (a.currentValueUSD || 0));

    let chartData: ChartData[] = [];
    let otherValue = 0;

    if(totalValue > 0){
      const mainHoldings = processedHoldings.filter(h => ((h.currentValueUSD || 0) / totalValue) * 100 >= 1);
      const otherHoldings = processedHoldings.filter(h => ((h.currentValueUSD || 0) / totalValue) * 100 < 1);
      
      chartData = mainHoldings.map(h => ({
        name: h.symbol || 'Unknown',
        value: h.currentValueUSD || 0,
        symbol: h.symbol || 'Unknown',
      }));

      if (otherHoldings.length > 0) {
        otherValue = otherHoldings.reduce((acc, curr) => acc + (curr.currentValueUSD || 0), 0);
        chartData.push({
          name: 'Other',
          value: otherValue,
          symbol: 'Other',
        });
      }
    } else if (processedHoldings.length > 0) {
      // Handle case where all holdings have some non-zero value but total is still near zero
      chartData = processedHoldings.map(h => ({
          name: h.symbol || 'Unknown',
          value: h.currentValueUSD || 0,
          symbol: h.symbol || 'Unknown',
      }));
    }

    if (chartData.length === 0) {
      return (
        <div className="flex items-center justify-center h-48 text-gray-400">
          <p>No data available for chart.</p>
        </div>
      );
    }

  return (
    <div style={{ width: '100%', height: 200 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={60}
            fill="#8884d8"
            dataKey="value"
            nameKey="name"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            iconSize={10}
            wrapperStyle={{ color: '#FFFFFF' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}; 