'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MultiSelect } from '@/components/ui/multi-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Star } from 'lucide-react';
import { JournalEvent, JournalPageProps } from '@/lib/types';

const JournalSummary = ({ stats }: { stats: any }) => {
  const { totalRealizedPnl, winRate, totalTrades, avgGainPercent, avgLossPercent } = stats;

  const summaryItems = [
    { label: 'Total Realized P&L', value: `$${totalRealizedPnl.toFixed(2)}`, color: totalRealizedPnl >= 0 ? 'text-green-400' : 'text-red-400' },
    { label: 'Win Rate', value: `${winRate.toFixed(2)}%`, color: 'text-white' },
    { label: 'Closed Trades', value: totalTrades, color: 'text-white' },
    { label: 'Avg. Gain', value: `${avgGainPercent.toFixed(2)}%`, color: 'text-green-400' },
    { label: 'Avg. Loss', value: `${avgLossPercent.toFixed(2)}%`, color: 'text-red-400' },
  ];

  return (
    <Card className="mb-6 bg-gray-800 border-gray-700">
      <CardContent className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
          {summaryItems.map(item => (
            <div key={item.label}>
              <p className="text-sm text-gray-400">{item.label}</p>
              <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const tagOptions = [
  { label: 'Scalp', value: 'scalp' },
  { label: 'Swing', value: 'swing' },
  { label: 'Breakout', value: 'breakout' },
  { label: 'FOMO', value: 'fomo' },
  { label: 'Greed', value: 'greed' },
  { label: 'High Conviction', value: 'high-conviction' },
];

const JournalCard = ({ event, onSelect, onFlag }: { event: JournalEvent, onSelect: () => void, onFlag: (e: React.MouseEvent) => void }) => {
  const isProfit = event.status === 'CLOSED' ? event.realized_pnl_usd! >= 0 : event.unrealized_pnl_usd! >= 0;
  const pnl = event.status === 'CLOSED' ? event.realized_pnl_usd : event.unrealized_pnl_usd;
  const pnlPercent = event.status === 'CLOSED' ? event.realized_pnl_percent : event.unrealized_pnl_percent;
  
  return (
    <Card className="cursor-pointer transition-all hover:shadow-lg hover:border-primary bg-gray-800 border-gray-700 text-white relative">
      <button onClick={onFlag} className="absolute top-2 right-2 p-1 text-gray-500 hover:text-yellow-400 z-10">
        <Star size={18} className={event.is_flagged ? "text-yellow-400 fill-current" : ""} />
      </button>
      <div onClick={onSelect}>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              {event.token_logo && <img src={event.token_logo} alt={event.token_symbol} className="w-8 h-8 rounded-full" />}
              <span className="text-lg font-bold">{event.token_symbol}</span>
            </div>
            <Badge variant={event.status === 'OPEN' ? 'secondary' : isProfit ? 'default' : 'destructive'}>
              {event.status === 'OPEN' ? 'OPEN' : isProfit ? 'PROFIT' : 'LOSS'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold mb-2 ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
            {pnl !== undefined ? `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}` : 'N/A'}
          </div>
          <div className="text-sm text-muted-foreground mb-4">
            ({pnlPercent !== undefined ? `${pnlPercent.toFixed(2)}%` : 'N/A'})
          </div>
          <div className="flex justify-between text-xs">
            <span>{event.status === 'CLOSED' ? 'Proceeds' : 'Value'}: ${event.status === 'CLOSED' ? event.sell_value_usd?.toFixed(2) : event.current_value_usd?.toFixed(2)}</span>
            <span>Cost: ${event.total_cost?.toFixed(2) || event.cost_basis_usd?.toFixed(2)}</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-1">
            {event.tags?.map((tag: string) => <Badge key={tag} variant="outline">{tag}</Badge>)}
          </div>
          {event.notes && (
            <div className="mt-4 pt-2 border-t border-gray-700">
              <p className="text-xs text-gray-400 italic truncate">
                {event.notes}
              </p>
            </div>
          )}
        </CardContent>
      </div>
    </Card>
  );
};

export const JournalPage = ({ journalEvents: initialJournalEvents, dbUser }: JournalPageProps) => {
  const [journalEvents, setJournalEvents] = useState<JournalEvent[]>(initialJournalEvents || []);
  const [selectedEvent, setSelectedEvent] = useState<JournalEvent | null>(null);
  
  const [editingNotes, setEditingNotes] = useState('');
  const [editingTags, setEditingTags] = useState<string[]>([]);
  
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tradeType, setTradeType] = useState('all');
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);

  const summaryStats = useMemo(() => {
    const closedTrades = journalEvents.filter(e => e.status === 'CLOSED' && e.realized_pnl_usd !== undefined);
    
    if (closedTrades.length === 0) {
      return {
        totalRealizedPnl: 0,
        winRate: 0,
        totalTrades: 0,
        avgGainPercent: 0,
        avgLossPercent: 0,
      };
    }

    const totalRealizedPnl = closedTrades.reduce((sum, trade) => sum + trade.realized_pnl_usd!, 0);
    const totalTrades = closedTrades.length;

    const winningTrades = closedTrades.filter(trade => trade.realized_pnl_usd! > 0);
    const losingTrades = closedTrades.filter(trade => trade.realized_pnl_usd! < 0);

    const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;

    const totalGainPercent = winningTrades.reduce((sum, trade) => sum + (trade.realized_pnl_percent || 0), 0);
    const avgGainPercent = winningTrades.length > 0 ? totalGainPercent / winningTrades.length : 0;

    const totalLossPercent = losingTrades.reduce((sum, trade) => sum + (trade.realized_pnl_percent || 0), 0);
    const avgLossPercent = losingTrades.length > 0 ? totalLossPercent / losingTrades.length : 0;
    
    return {
      totalRealizedPnl,
      winRate,
      totalTrades,
      avgGainPercent,
      avgLossPercent,
    };
  }, [journalEvents]);

  useEffect(() => {
    if (selectedEvent) {
      setEditingNotes(selectedEvent.notes || '');
      setEditingTags(selectedEvent.tags || []);
    }
  }, [selectedEvent]);

  const filteredEvents = useMemo(() => {
    return journalEvents.filter(event => {
      const tagMatch = selectedTags.length === 0 || event.tags?.some(tag => selectedTags.includes(tag));
      const typeMatch = tradeType === 'all' || 
                        (tradeType === 'buy' && event.status === 'OPEN') || 
                        (tradeType === 'sell' && event.status === 'CLOSED');
      const flagMatch = !showFlaggedOnly || event.is_flagged;
      return tagMatch && typeMatch && flagMatch;
    });
  }, [journalEvents, selectedTags, tradeType, showFlaggedOnly]);

  const handleSave = async () => {
    if (!selectedEvent) return;

    await fetch('/api/journal/notes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tx_hash: selectedEvent.id, notes: editingNotes, userId: dbUser?.id }),
    });

    await fetch('/api/journal/tags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tx_hash: selectedEvent.id, tags: editingTags, userId: dbUser?.id }),
    });
    
    setJournalEvents(prev => prev.map(event => 
      event.id === selectedEvent.id 
        ? { ...event, notes: editingNotes, tags: editingTags } 
        : event
    ));
    
    setSelectedEvent(null);
  };

  const handleToggleFlag = async (event: React.MouseEvent, trade: JournalEvent) => {
    event.stopPropagation(); // Prevent opening the modal
    const newFlaggedState = !trade.is_flagged;
    
    // Optimistically update UI
    setJournalEvents(prev => prev.map(e => e.id === trade.id ? { ...e, is_flagged: newFlaggedState } : e));
    
    try {
      await fetch('/api/journal/flag', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tx_hash: trade.id, is_flagged: newFlaggedState, userId: dbUser?.id }),
      });
    } catch (error) {
      console.error('Failed to update flag status:', error);
      // Revert UI on error
      setJournalEvents(prev => prev.map(e => e.id === trade.id ? { ...e, is_flagged: !newFlaggedState } : e));
    }
  };
  
  return (
    <div className="container mx-auto py-6">
       <div className="sticky top-0 bg-background py-4 z-10">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">P&L Journal</h1>
        </div>
        <JournalSummary stats={summaryStats} />
        <div className="flex items-center gap-4 p-4 bg-gray-800 rounded-lg">
           <div className="flex-1">
             <label className="text-sm font-medium text-gray-400 mb-2 block">Filter by Tags</label>
             <MultiSelect
               options={tagOptions}
               onValueChange={setSelectedTags}
               defaultValue={selectedTags}
               placeholder="Select tags..."
               className="w-full"
             />
           </div>
           <div className="w-48">
             <label className="text-sm font-medium text-gray-400 mb-2 block">Filter by Type</label>
             <Select value={tradeType} onValueChange={setTradeType}>
               <SelectTrigger>
                 <SelectValue placeholder="All Trades" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">All Trades</SelectItem>
                 <SelectItem value="buy">Buys (Open)</SelectItem>
                 <SelectItem value="sell">Sells (Closed)</SelectItem>
               </SelectContent>
             </Select>
           </div>
           <div className="flex items-center gap-2">
            <Switch id="flag-filter" checked={showFlaggedOnly} onCheckedChange={setShowFlaggedOnly} />
            <Label htmlFor="flag-filter">Show Flagged Only</Label>
         </div>
         </div>
       </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {filteredEvents.map((event) => (
          <JournalCard 
            key={event.id} 
            event={event} 
            onSelect={() => setSelectedEvent(event)} 
            onFlag={(e) => handleToggleFlag(e, event)} 
          />
        ))}
      </div>

      {selectedEvent && (
        <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
          <DialogContent className="bg-gray-900 border-gray-700 text-white">
            <DialogHeader>
              <DialogTitle>{selectedEvent.token_symbol} Trade Details</DialogTitle>
            </DialogHeader>
            
            <div className="flex flex-col gap-4">
              <div>
                <h4 className="font-semibold mb-2 text-gray-400">Trade Notes</h4>
                <Textarea
                  placeholder="Add your thoughts on this trade..."
                  value={editingNotes}
                  onChange={(e) => setEditingNotes(e.target.value)}
                  className="bg-gray-800 border-gray-600"
                />
              </div>
              
              <div>
                <h4 className="font-semibold mb-2 text-gray-400">Tags</h4>
                <MultiSelect
                  options={tagOptions}
                  onValueChange={setEditingTags}
                  defaultValue={editingTags}
                  placeholder="Add tags..."
                />
              </div>

              <div className="text-xs text-gray-500 pt-4 border-t border-gray-700">
                {selectedEvent.status === 'CLOSED' ? (
                  <>
                    <p>Sold on {new Date(selectedEvent.date).toLocaleString()}</p>
                    <a href={`https://solscan.io/tx/${selectedEvent.sell_tx_hash}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                      View Sale on Solscan
                    </a>
                  </>
                ) : (
                  <p>Last purchase on {new Date(selectedEvent.date).toLocaleString()}</p>
                )}
              </div>
            </div>

            <Button onClick={handleSave} className="mt-4">
              Save Changes
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}; 