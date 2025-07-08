"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trade } from "@/lib/types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

const TradeTable = ({ trades, caption }: { trades: Trade[], caption: string }) => {
    if (trades.length === 0) {
        return <p className="text-gray-400 text-center py-8">No {caption.toLowerCase()} found.</p>
    }
    
    return (
        <div className="overflow-y-auto h-[60vh]">
            <Table>
                <TableCaption>{caption}</TableCaption>
                <TableHeader className="sticky top-0 bg-gray-900">
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Token</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Price (USD)</TableHead>
                        <TableHead>Total (USD)</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Emotions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {trades.map((trade) => (
                        <TableRow key={trade.id} className="hover:bg-gray-800/50 border-b border-gray-800">
                            <TableCell>{new Date(trade.trade_date).toLocaleDateString()}</TableCell>
                            <TableCell className="capitalize">{trade.source}</TableCell>
                            <TableCell className="font-medium">{trade.token_symbol}</TableCell>
                            <TableCell className={`capitalize ${trade.trade_type === "buy" ? "text-green-400" : "text-red-400"}`}>{trade.trade_type}</TableCell>
                            <TableCell>{Number(trade.amount).toFixed(4)}</TableCell>
                            <TableCell>${Number(trade.price).toFixed(4)}</TableCell>
                            <TableCell className="font-medium">${Number(trade.total_value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-xs max-w-xs truncate">{trade.notes}</TableCell>
                            <TableCell className="text-xs">{(trade.emotion_tags || []).join(", ")}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}

interface TradeHistoryProps {
    initialTrades: Trade[];
}

const TradeHistory = ({ initialTrades }: TradeHistoryProps) => {
  const [activeTab, setActiveTab] = useState<'manual' | 'synced'>('manual');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState('all');
  const [tokenFilter, setTokenFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const uniqueTokens = useMemo(() => {
    const tokens = new Set(initialTrades.map(t => t.token_symbol));
    return ['all', ...Array.from(tokens)];
  }, [initialTrades]);

  const { manualTrades, syncedTrades } = useMemo(() => {
    let trades = initialTrades;

    if (dateRange !== 'all') {
        const now = new Date();
        const days = parseInt(dateRange, 10);
        const fromDate = new Date(now.setDate(now.getDate() - days));
        trades = trades.filter(t => new Date(t.trade_date) >= fromDate);
    }

    if (tokenFilter !== 'all') {
        trades = trades.filter(t => t.token_symbol === tokenFilter);
    }

    if (typeFilter !== 'all') {
        trades = trades.filter(t => t.trade_type === typeFilter);
    }
    
    const lowercasedFilter = searchTerm.toLowerCase();

    const filterTrades = (t: Trade[]) => {
        if (!searchTerm) return t;
        return t.filter(trade => 
            trade.token_symbol?.toLowerCase().includes(lowercasedFilter)
        );
    };

    return {
        manualTrades: filterTrades(trades.filter(t => t.source === 'manual')),
        syncedTrades: filterTrades(trades.filter(t => t.source !== 'manual')),
    }
  }, [initialTrades, searchTerm, dateRange, tokenFilter, typeFilter]);

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-white">Trade Journal</h2>
      </div>
      
      {/* Sticky Header */}
      <div className="sticky top-0 bg-gray-900/50 py-4 z-10">
        <div className="flex items-center space-x-4">
          <Input 
              placeholder="Search by token..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-gray-800 border-gray-700 max-w-xs"
          />
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="7">Last 7 Days</SelectItem>
              <SelectItem value="30">Last 30 Days</SelectItem>
              <SelectItem value="90">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tokenFilter} onValueChange={setTokenFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Token" />
            </SelectTrigger>
            <SelectContent>
              {uniqueTokens.map(token => (
                <SelectItem key={token} value={token}>{token === 'all' ? 'All Tokens' : token}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="buy">Buy</SelectItem>
              <SelectItem value="sell">Sell</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="flex space-x-2 border-b border-gray-700 mb-4">
          <Button variant="ghost" onClick={() => setActiveTab('manual')} className={cn("rounded-none", activeTab === 'manual' && 'border-b-2 border-green-400 text-green-400')}>
              Manual
          </Button>
          <Button variant="ghost" onClick={() => setActiveTab('synced')} className={cn("rounded-none", activeTab === 'synced' && 'border-b-2 border-green-400 text-green-400')}>
              Synced
          </Button>
      </div>

      <div>
          {activeTab === 'manual' && <TradeTable trades={manualTrades} caption="A list of your manually entered trades." />}
          {activeTab === 'synced' && <TradeTable trades={syncedTrades} caption="A list of your trades synced from your wallet." />}
      </div>
    </div>
  );
};

export default TradeHistory;