"use client";

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { RefreshCw, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { toast } from "sonner";
import { cn } from '@/lib/utils';

interface DailySnapshot {
  id?: number;
  wallet_address: string;
  snapshot_date: string;
  start_balance_usd: number;
  end_balance_usd?: number;
  pnl_percent?: number;
  notes?: string;
}

export const PnLDashboard = () => {
  const { publicKey } = useWallet();
  const [pnlData, setPnlData] = useState<DailySnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [setupMessage, setSetupMessage] = useState('');

  const fetchPnLData = async () => {
    if (!publicKey) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/pnl/daily-snapshot?walletAddress=${publicKey.toBase58()}`);
      if (!response.ok) {
        const errorData = await response.json();
        console.error('P&L API Error:', errorData);
        
        // Check if it's a database table issue
        if (errorData.error?.includes('relation') || errorData.error?.includes('table')) {
          setSetupNeeded(true);
          setSetupMessage('Database tables need to be created. Click "Setup Database" to initialize.');
          toast.error('Database setup required');
          return;
        }
        
        throw new Error(errorData.error || 'Failed to fetch P&L data');
      }
      
      const data = await response.json();
      setPnlData(data);
      setLastUpdate(new Date());
      setSetupNeeded(false);
      setSetupMessage('');
    } catch (error: any) {
      console.error('Error fetching P&L data:', error);
      toast.error('Failed to fetch P&L data');
    } finally {
      setIsLoading(false);
    }
  };

  const createSnapshot = async () => {
    if (!publicKey) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/pnl/daily-snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: publicKey.toBase58(),
          action: 'create'
        })
      });

      if (!response.ok) throw new Error('Failed to create snapshot');
      
      toast.success('Daily snapshot created successfully');
      await fetchPnLData();
    } catch (error: any) {
      console.error('Error creating snapshot:', error);
      toast.error('Failed to create snapshot');
    } finally {
      setIsLoading(false);
    }
  };

  const testDatabase = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/pnl/test-db');
      const result = await response.json();
      
      if (response.ok) {
        console.log('Database test result:', result);
        toast.success('Database connection successful');
        
        // Check if tables exist
        const tablesExist = Object.values(result.tables).every((table: any) => table.exists);
        if (!tablesExist) {
          setSetupNeeded(true);
          setSetupMessage('Some database tables are missing. Click "Setup Database" to create them.');
        } else {
          setSetupNeeded(false);
          setSetupMessage('');
          await fetchPnLData();
        }
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error('Database test error:', error);
      toast.error('Database test failed');
    } finally {
      setIsLoading(false);
    }
  };

  const setupDatabase = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/pnl/test-db', {
        method: 'POST'
      });
      const result = await response.json();
      
      console.log('Setup result:', result);
      
      // Show instructions to user
      setSetupMessage(`Manual setup required: ${result.message}. Please run the SQL from database-schema.sql in your Supabase dashboard.`);
      toast.error('Manual database setup required - check console for details');
      
    } catch (error: any) {
      console.error('Database setup error:', error);
      toast.error('Failed to get setup instructions');
    } finally {
      setIsLoading(false);
    }
  };

  const classifyTransactions = async () => {
    if (!publicKey) return;

    setIsClassifying(true);
    try {
      const response = await fetch('/api/pnl/classify-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: publicKey.toBase58(),
          limit: 200
        })
      });

      if (!response.ok) throw new Error('Failed to classify transactions');
      
      const result = await response.json();
      toast.success(result.message);
    } catch (error: any) {
      console.error('Error classifying transactions:', error);
      toast.error('Failed to classify transactions');
    } finally {
      setIsClassifying(false);
    }
  };

  useEffect(() => {
    if (publicKey) {
      testDatabase();
    }
  }, [publicKey]);

  const totalPnL = pnlData.reduce((sum, day) => sum + (day.pnl_percent || 0), 0);
  const currentValue = pnlData.length > 0 ? pnlData[pnlData.length - 1]?.end_balance_usd || 0 : 0;
  const chartData = pnlData.map(day => ({
    date: new Date(day.snapshot_date).toLocaleDateString(),
    pnl: day.pnl_percent || 0,
    value: day.end_balance_usd || day.start_balance_usd
  }));

  if (!publicKey) {
    return (
      <div className="text-center text-gray-400 py-16">
        <p>Connect your wallet to view P&L tracking</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Daily P&L Tracker</h2>
        <div className="flex space-x-2">
          {setupNeeded && (
            <Button onClick={setupDatabase} disabled={isLoading} variant="destructive">
              <RefreshCw size={16} className={`mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Setup Database
            </Button>
          )}
          <Button onClick={classifyTransactions} disabled={isClassifying || setupNeeded}>
            <RefreshCw size={16} className={`mr-2 ${isClassifying ? 'animate-spin' : ''}`} />
            {isClassifying ? 'Classifying...' : 'Classify Transactions'}
          </Button>
          <Button onClick={createSnapshot} disabled={isLoading || setupNeeded}>
            <Calendar size={16} className="mr-2" />
            Create Snapshot
          </Button>
          <Button variant="outline" onClick={fetchPnLData} disabled={isLoading}>
            <RefreshCw size={16} className={`mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Setup Message */}
      {setupMessage && (
        <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-4">
          <p className="text-yellow-400">{setupMessage}</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Current Portfolio Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Total P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold flex items-center", totalPnL >= 0 ? 'text-green-400' : 'text-red-400')}>
              {totalPnL >= 0 ? <TrendingUp size={20} className="mr-1" /> : <TrendingDown size={20} className="mr-1" />}
              {totalPnL.toFixed(2)}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Tracking Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pnlData.length}</div>
            {lastUpdate && (
              <p className="text-xs text-gray-400 mt-1">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* P&L Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Daily P&L Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#9CA3AF"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="#9CA3AF"
                    fontSize={12}
                    tickFormatter={(value) => `${value.toFixed(1)}%`}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: '1px solid #374151',
                      borderRadius: '6px'
                    }}
                    formatter={(value: any, name) => [
                      name === 'pnl' ? `${value.toFixed(2)}%` : `$${value.toLocaleString()}`,
                      name === 'pnl' ? 'P&L %' : 'Portfolio Value'
                    ]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="pnl" 
                    stroke="#10B981" 
                    strokeWidth={2}
                    dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center text-gray-400 py-16">
              <Calendar size={48} className="mx-auto mb-4" />
              <p>No P&L data available</p>
              <p className="text-sm mt-2">Create your first snapshot to start tracking</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Snapshots Table */}
      {pnlData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Daily Snapshots</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2">Date</th>
                    <th className="text-left py-2">Start Value</th>
                    <th className="text-left py-2">End Value</th>
                    <th className="text-left py-2">P&L %</th>
                  </tr>
                </thead>
                <tbody>
                  {pnlData.slice(-10).reverse().map((snapshot) => (
                    <tr key={snapshot.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                      <td className="py-2">{new Date(snapshot.snapshot_date).toLocaleDateString()}</td>
                      <td className="py-2">${snapshot.start_balance_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="py-2">${(snapshot.end_balance_usd || snapshot.start_balance_usd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className={cn("py-2", (snapshot.pnl_percent || 0) >= 0 ? 'text-green-400' : 'text-red-400')}>
                        {(snapshot.pnl_percent || 0).toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}; 