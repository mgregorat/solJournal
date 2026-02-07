'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MultiSelect } from '@/components/ui/multi-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import ReactMarkdown from 'react-markdown';
import { Star, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameDay } from 'date-fns';
import { JournalEvent, JournalPageProps, User } from '@/lib/types';
import { isTradeJournaled } from '@/lib/utils';
import { usePrivy } from '@privy-io/react-auth';
import { useWallet } from '@solana/wallet-adapter-react';
import { cn } from '@/lib/utils';

const ReflectionModal = ({ event, onClose, onSave, onDelete }: { event: JournalEvent | null, onClose: () => void, onSave: (updatedEvent: JournalEvent) => void, onDelete: () => void }) => {
  if (!event) return null;

  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState(event.notes || '');
  const [whatWentWell, setWhatWentWell] = useState(event.what_went_well || '');
  const [whatWentWrong, setWhatWentWrong] = useState(event.what_went_wrong || '');
  const [whatWillIDoDifferently, setWhatWillIDoDifferently] = useState(event.what_will_i_do_differently || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setIsEditing(false);
    setNotes(event.notes || '');
    setWhatWentWell(event.what_went_well || '');
    setWhatWentWrong(event.what_went_wrong || '');
    setWhatWillIDoDifferently(event.what_will_i_do_differently || '');
  }, [event]);

  const handleSave = () => {
    onSave({
      ...event,
      notes: notes,
      what_went_well: whatWentWell,
      what_went_wrong: whatWentWrong,
      what_will_i_do_differently: whatWillIDoDifferently,
    });
    setIsEditing(false);
  };

  const handleDelete = () => {
    onDelete();
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <Dialog open={!!event && !showDeleteConfirm} onOpenChange={onClose}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-4xl">
          <DialogHeader>
            <DialogTitle>Trade Reflection: {event.token_symbol}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 flex flex-col gap-4">
              <div>
                <h4 className="font-semibold text-lg mb-2 text-gray-300">Notes</h4>
                <div className="prose prose-invert prose-sm bg-gray-800 p-3 rounded-md min-h-[80px]">
                  <ReactMarkdown>{event.notes || 'No notes for this trade.'}</ReactMarkdown>
                </div>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold text-lg mb-2 text-gray-300">Reflection</h4>
                {isEditing ? (
                  <div className="flex flex-col gap-4">
                    <div>
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} className="bg-gray-800 border-gray-600 mt-1" rows={3} />
                    </div>
                    <div>
                      <Label htmlFor="what-went-well">What went well?</Label>
                      <Textarea id="what-went-well" value={whatWentWell} onChange={e => setWhatWentWell(e.target.value)} className="bg-gray-800 border-gray-600 mt-1" rows={3} />
                    </div>
                    <div>
                      <Label htmlFor="what-went-wrong">What went wrong?</Label>
                      <Textarea id="what-went-wrong" value={whatWentWrong} onChange={e => setWhatWentWrong(e.target.value)} className="bg-gray-800 border-gray-600 mt-1" rows={3} />
                    </div>
                    <div>
                      <Label htmlFor="what-will-do-differently">What will you do differently next time?</Label>
                      <Textarea id="what-will-do-differently" value={whatWillIDoDifferently} onChange={e => setWhatWillIDoDifferently(e.target.value)} className="bg-gray-800 border-gray-600 mt-1" rows={3} />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 text-sm">
                    <div>
                      <h5 className="font-semibold text-gray-400 flex items-center gap-2">
                        <span role="img" aria-label="checkmark">✅</span> What went well?
                      </h5>
                      <p className="prose prose-invert prose-sm mt-1 text-gray-300 pl-6">{event.what_went_well || <span className="text-gray-500 italic">Not answered</span>}</p>
                    </div>
                    <div>
                      <h5 className="font-semibold text-gray-400 flex items-center gap-2">
                        <span role="img" aria-label="warning">⚠️</span> What went wrong?
                      </h5>
                      <p className="prose prose-invert prose-sm mt-1 text-gray-300 pl-6">{event.what_went_wrong || <span className="text-gray-500 italic">Not answered</span>}</p>
                    </div>
                    <div>
                      <h5 className="font-semibold text-gray-400 flex items-center gap-2">
                        <span role="img" aria-label="repeat">🔁</span> What will you change?
                      </h5>
                      <p className="prose prose-invert prose-sm mt-1 text-gray-300 pl-6">{event.what_will_i_do_differently || <span className="text-gray-500 italic">Not answered</span>}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex flex-col gap-4">
              <div>
                <h4 className="font-semibold text-lg mb-2 text-gray-300">P&L Details</h4>
                <div className="grid grid-cols-3 gap-2 text-sm bg-gray-800 p-3 rounded-md">
                  <div>
                    <p className="text-gray-500">Proceeds</p>
                    <p>${event.sell_value_usd != null ? event.sell_value_usd.toFixed(2) : 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Cost Basis</p>
                    <p>${event.cost_basis_usd != null ? event.cost_basis_usd.toFixed(2) : 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Realized P&L</p>
                    <p className={event.realized_pnl_usd != null ? (event.realized_pnl_usd >= 0 ? 'text-green-400' : 'text-red-400') : ''}>
                      {event.realized_pnl_usd != null ? `$${event.realized_pnl_usd.toFixed(2)}` : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
               <Separator />
              <div>
                <h4 className="font-semibold text-lg mb-2 text-gray-300">Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {event.tags?.map(tag => <Badge key={tag} variant="secondary">{tag}</Badge>)}
                   {event.tags?.length === 0 && <p className="text-sm text-gray-500">No tags.</p>}
                </div>
              </div>
              <Separator />
              <div className="text-sm text-gray-500 flex flex-col gap-2">
                <p>
                  Sold on {format(new Date(event.date), "MMMM d, yyyy 'at' h:mm a")}
                </p>
                {event.sell_tx_hash && (
                  <a href={`https://solscan.io/tx/${event.sell_tx_hash}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                    View on Solscan
                  </a>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="!justify-between">
            <div>
              <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>Delete Journal</Button>
            </div>
            <div className="flex gap-2">
              {isEditing ? (
                <Button onClick={handleSave}>Save Reflection</Button>
              ) : (
                <Button onClick={() => setIsEditing(true)}>Edit Reflection</Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
          </DialogHeader>
          <p>This will permanently delete your journal entry. You cannot undo this action.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Confirm Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

const DayTradesModal = ({ date, trades, onClose }: { date: Date | null, trades: JournalEvent[], onClose: () => void }) => {
  if (!date) return null;

  return (
    <Dialog open={!!date} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle>Trades for {format(date, 'MMMM d, yyyy')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto">
          {trades.map(trade => (
            <div key={trade.id} className="flex justify-between items-center p-2 rounded-md bg-gray-800">
              <div className="flex items-center gap-2">
                {trade.token_logo && <img src={trade.token_logo} alt={trade.token_symbol} className="w-6 h-6 rounded-full" />}
                <span className="font-bold">{trade.token_symbol}</span>
              </div>
              <span className={`font-bold ${trade.realized_pnl_usd! >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {trade.realized_pnl_usd! >= 0 ? '+' : ''}${trade.realized_pnl_usd!.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const PnlCalendar = ({ events, onDayClick }: { events: JournalEvent[], onDayClick: (day: Date) => void }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const dailyPnl = useMemo(() => {
    return events
      .filter(e => e.status === 'CLOSED' && e.realized_pnl_usd !== undefined)
      .reduce((acc, trade) => {
        const date = new Date(trade.date).toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + trade.realized_pnl_usd!;
        return acc;
      }, {} as Record<string, number>);
  }, [events]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startingDayIndex = getDay(monthStart);

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  return (
    <Card className="mb-6 bg-gray-800 border-gray-700 p-4">
      <div className="flex justify-between items-center mb-4">
        <Button onClick={handlePrevMonth} variant="ghost" size="icon">
          <ChevronLeft />
        </Button>
        <h2 className="text-xl font-bold">{format(currentDate, 'MMMM yyyy')}</h2>
        <Button onClick={handleNextMonth} variant="ghost" size="icon">
          <ChevronRight />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day}>{day}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: startingDayIndex }).map((_, i) => <div key={`empty-${i}`} />)}
        {daysInMonth.map(day => {
          const dayStr = format(day, 'yyyy-MM-dd');
          const pnl = dailyPnl[dayStr];
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={dayStr}
              className={`p-2 rounded-md h-24 flex flex-col justify-start items-start cursor-pointer hover:bg-gray-700 ${isToday ? 'bg-blue-900/50' : ''}`}
              onClick={() => onDayClick(day)}
            >
              <span className="font-semibold">{format(day, 'd')}</span>
              {pnl !== undefined && (
                <span className={`mt-auto text-sm font-bold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
};

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
  { label: "Scalp", value: "Scalp" },
  { label: "Swing", value: "Swing" },
  { label: "Long-Term", value: "Long-Term" },
  { label: "Alpha Call", value: "Alpha Call" },
  { label: "FOMO", value: "FOMO" },
  { label: "Exit Early", value: "Exit Early" },
  { label: "Hype", value: "Hype" },
  { label: "Rug", value: "Rug" },
  { label: "Success", value: "Success" },
  { label: "Mistake", value: "Mistake" }
];

const TradeHistoryModal = ({ trades, onClose, tokenSymbol, onJournal, onViewReflection }: { trades: JournalEvent[] | null, onClose: () => void, tokenSymbol: string, onJournal: (trade: JournalEvent) => void, onViewReflection: (trade: JournalEvent) => void }) => {
  if (!trades || trades.length === 0) return null;

  const sortedTrades = trades.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <Dialog open={!!trades} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle>Trade History for {tokenSymbol}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto p-1">
          {sortedTrades.map(trade => (
            <div key={trade.id} className="grid grid-cols-5 items-center p-3 rounded-md bg-gray-800 text-sm">
              <div className="font-semibold">
                {trade.status === 'CLOSED' ? 'SELL' : 'BUY'}
              </div>
              <div className="col-span-2">
                <p className="text-gray-400">{format(new Date(trade.date), 'MMM d, yyyy h:mm a')}</p>
                {trade.is_journaled && trade.journal_updated_at && (
                  <p className="text-xs text-gray-500 italic">
                    Journaled on {format(new Date(trade.journal_updated_at), 'MMM d, yyyy')}
                  </p>
                )}
              </div>
              <div className={`text-right font-bold ${trade.realized_pnl_usd != null ? (trade.realized_pnl_usd >= 0 ? 'text-green-400' : 'text-red-400') : ''}`}>
                {trade.realized_pnl_usd != null ? `${trade.realized_pnl_usd >= 0 ? '+' : ''}$${trade.realized_pnl_usd.toFixed(2)}` : 'OPEN'}
              </div>
              <div className="text-right">
                {trade.is_journaled ? (
                  <Button size="sm" variant="ghost" onClick={() => onViewReflection(trade)}>View Notes</Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => onJournal(trade)}>Journal</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
const GroupedJournalCard = ({ tradeGroup, onSelect, onJournalClick }: { tradeGroup: JournalEvent[], onSelect: () => void, onJournalClick: (e: React.MouseEvent) => void }) => {
    if (!tradeGroup || tradeGroup.length === 0) return null;

    const firstEvent = tradeGroup[0];
    const { token_symbol, token_logo } = firstEvent;

    const latestEvent = tradeGroup.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    const finalStatus = latestEvent.status;
    
    const closedTrades = tradeGroup.filter(t => t.status === 'CLOSED');
    const totalRealizedPnl = closedTrades.reduce((sum, trade) => sum + (trade.realized_pnl_usd || 0), 0);
    const isOverallProfit = totalRealizedPnl >= 0;

    const openPosition = tradeGroup.find(t => t.status === 'OPEN');
    const displayPnl = finalStatus === 'CLOSED' ? totalRealizedPnl : openPosition?.unrealized_pnl_usd;
    const isProfit = finalStatus === 'CLOSED' ? isOverallProfit : (openPosition?.unrealized_pnl_usd ?? 0) >= 0;
    
    const hasUnjournaledTrades = tradeGroup.some(t => !t.is_journaled);

    return (
        <Card className="bg-card border-border text-foreground relative flex flex-col">
            <div className="flex-grow cursor-pointer hover:border-primary" onClick={onSelect}>
                <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            {token_logo && <img src={token_logo} alt={token_symbol} className="w-8 h-8 rounded-full" />}
                            <div>
                                <p className="text-lg font-bold">{token_symbol}</p>
                                <p className="text-xs text-muted-foreground">{tradeGroup.length} trade{tradeGroup.length > 1 ? 's' : ''}</p>
                            </div>
                        </div>
                        <Badge variant={finalStatus === 'OPEN' ? 'secondary' : isProfit ? 'default' : 'destructive'}>
                            {finalStatus}
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className={cn("text-2xl font-bold mb-2", isProfit ? "text-green-400" : "text-red-400")}>
                        {displayPnl !== undefined ? `${displayPnl >= 0 ? '+' : ''}$${displayPnl.toFixed(2)}` : 'N/A'}
                    </div>
                    <div className="text-sm text-muted-foreground mb-4">
                        {finalStatus === 'CLOSED' ? 'Total Realized P&L' : 'Unrealized P&L'}
                    </div>
                </CardContent>
            </div>
            {hasUnjournaledTrades && (
                <div className="p-4 pt-0">
                    <Button onClick={onJournalClick} className="w-full">Journal Trade</Button>
                </div>
            )}
        </Card>
    );
};

export const JournalPage = ({ journalEvents: initialJournalEvents, dbUser: propDbUser }: JournalPageProps) => {
  const [journalEvents, setJournalEvents] = useState<JournalEvent[]>(Array.isArray(initialJournalEvents) ? initialJournalEvents : []);
  const [dbUser, setDbUser] = useState<User | undefined>(propDbUser);
  const { user: privyUser, authenticated } = usePrivy();
  const { publicKey } = useWallet();
  const [selectedEvent, setSelectedEvent] = useState<JournalEvent | null>(null);
  
  const [editingNotes, setEditingNotes] = useState('');
  const [editingTags, setEditingTags] = useState<string[]>([]);
  const [editingWhatWentWell, setEditingWhatWentWell] = useState('');
  const [editingWhatWentWrong, setEditingWhatWentWrong] = useState('');
  const [editingWhatWillIDoDifferently, setEditingWhatWillIDoDifferently] = useState('');
  
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tradeType, setTradeType] = useState('all');
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewingEvent, setViewingEvent] = useState<JournalEvent | null>(null);
  const [activeTab, setActiveTab] = useState("not-journaled");
  const [hideJournaled, setHideJournaled] = useState(false);

  const [viewingTradeHistory, setViewingTradeHistory] = useState<JournalEvent[] | null>(null);

  const tradesForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    const dayStr = format(selectedDate, 'yyyy-MM-dd');
    return journalEvents.filter(event => {
      if (event.status !== 'CLOSED') return false;
      const eventDateStr = format(new Date(event.date), 'yyyy-MM-dd');
      return eventDateStr === dayStr;
    });
  }, [selectedDate, journalEvents]);

  const journaledTrades = useMemo(() => journalEvents.filter(isTradeJournaled), [journalEvents]);
  const notJournaledTrades = useMemo(() => journalEvents.filter(trade => !isTradeJournaled(trade)), [journalEvents]);
  const journaledPercentage = journalEvents.length > 0 ? (journaledTrades.length / journalEvents.length) * 100 : 0;

  const handleDayClick = (day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const tradesOnDay = journalEvents.some(event => 
        event.status === 'CLOSED' && 
        format(new Date(event.date), 'yyyy-MM-dd') === dayStr
    );
    if (tradesOnDay) {
        setSelectedDate(day);
    }
  };

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
    
    return { totalRealizedPnl, winRate, totalTrades, avgGainPercent, avgLossPercent };
  }, [journalEvents]);

  useEffect(() => {
    const fetchAndMergeData = async () => {
      if (!authenticated || !privyUser || !publicKey) {
        return;
      }

      try {
        // Step 1: Get User ID
        const userResponse = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ privy_did: privyUser.id, email: privyUser.email?.address }),
        });
        if (!userResponse.ok) throw new Error("Failed to sync user.");
        const syncedUser = await userResponse.json();
        setDbUser(syncedUser); 
        const userId = syncedUser.id;
        const walletAddress = publicKey.toBase58();

        // Step 2: Fetch both trade events and journal entries in parallel
        const [activityResponse, entriesResponse] = await Promise.all([
          fetch(`/api/journal-activity?userId=${userId}&walletAddress=${walletAddress}`),
          fetch(`/api/journal/entries?userId=${userId}`)
        ]);

        if (!activityResponse.ok || !entriesResponse.ok) {
          throw new Error('Failed to fetch all required data.');
        }

        const tradeEvents: JournalEvent[] = await activityResponse.json();
        const journalEntries: any[] = await entriesResponse.json();

        // Step 3: Create a lookup map for journal entries
        const journalMap = new Map(journalEntries.map(entry => [entry.tx_hash, entry]));

        // Step 4: Merge the data and sort by date descending
        const mergedEvents = tradeEvents.map((event) => {
          const journalEntry = journalMap.get(event.id);

          if (journalEntry) {
            return {
              ...event,
              notes: journalEntry.notes,
              tags: journalEntry.tags,
              is_flagged: journalEntry.is_flagged,
              what_went_well: journalEntry.what_went_well,
              what_went_wrong: journalEntry.what_went_wrong,
              what_will_i_do_differently: journalEntry.what_will_i_do_differently,
              is_journaled: true, // Explicitly mark as journaled
              journal_updated_at: journalEntry.updated_at, // Add journal timestamp
            };
          }
          // Return the original event if no journal entry is found
          return { ...event, is_journaled: false };
        }).sort((a, b) => {
          const dateA = a.journal_updated_at ? new Date(a.journal_updated_at) : new Date(a.date);
          const dateB = b.journal_updated_at ? new Date(b.journal_updated_at) : new Date(b.date);
          return dateB.getTime() - dateA.getTime();
        });
        
        setJournalEvents(mergedEvents);

      } catch (error) {
        console.error("Failed to fetch and merge journal data:", error);
      }
    };

    fetchAndMergeData();
  }, [authenticated, privyUser, publicKey]);

  const groupedAndFilteredEvents = useMemo(() => {
    let events = journalEvents;

    if (activeTab === 'journaled') events = journaledTrades;
    if (activeTab === 'not-journaled') events = notJournaledTrades;
    if (hideJournaled) events = events.filter(trade => !isTradeJournaled(trade));

    const filtered = events.filter(event => {
      const tagMatch = selectedTags.length === 0 || event.tags?.some(tag => selectedTags.includes(tag));
      const typeMatch = tradeType === 'all' || 
                        (tradeType === 'open' && event.status === 'OPEN') || 
                        (tradeType === 'closed' && event.status === 'CLOSED');
      const flagMatch = !showFlaggedOnly || event.is_flagged;
      return tagMatch && typeMatch && flagMatch;
    });

    // Grouping logic
    const grouped = filtered.reduce((acc, trade) => {
        const key = trade.token_address;
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(trade);
        return acc;
    }, {} as Record<string, JournalEvent[]>);

    return Object.values(grouped);

  }, [journalEvents, selectedTags, tradeType, showFlaggedOnly, activeTab, hideJournaled, journaledTrades, notJournaledTrades]);

  const handleReflectionSave = async (updatedEvent: JournalEvent) => {
    const updatedEventWithTimestamp = { ...updatedEvent, journal_updated_at: new Date().toISOString() };
    
    setJournalEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEventWithTimestamp : e)
      .sort((a, b) => {
        const dateA = a.journal_updated_at ? new Date(a.journal_updated_at) : new Date(a.date);
        const dateB = b.journal_updated_at ? new Date(b.journal_updated_at) : new Date(b.date);
        return dateB.getTime() - dateA.getTime();
      }));
    setViewingEvent(updatedEventWithTimestamp);

    const journalData = {
      tx_hash: updatedEvent.id,
      userId: dbUser?.id,
      notes: updatedEvent.notes,
      tags: updatedEvent.tags,
      what_went_well: updatedEvent.what_went_well,
      what_went_wrong: updatedEvent.what_went_wrong,
      what_will_i_do_differently: updatedEvent.what_will_i_do_differently,
    };

    try {
      const response = await fetch('/api/journal/', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(journalData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to save reflection:', errorData);
        setJournalEvents(prev => prev.map(e => e.id === updatedEvent.id ? { ...e, ...updatedEvent } : e));
      } else {
        const savedData = await response.json();
        const newJournalEntry = savedData.data[0];
         setJournalEvents(prev => prev.map(event => 
            event.id === updatedEvent.id 
            ? { 
                ...event, 
                ...updatedEvent,
                journal_entry_id: newJournalEntry.id,
                is_journaled: true,
              } 
            : event
        ));
      }
    } catch (error) {
      console.error('An error occurred while saving the reflection:', error);
       setJournalEvents(prev => prev.map(e => e.id === updatedEvent.id ? { ...e, ...updatedEvent } : e));
    }
  };

  const handleSave = async () => {
    if (!selectedEvent) return;

    const journalData = {
      tx_hash: selectedEvent.id,
      userId: dbUser?.id,
      notes: editingNotes,
      tags: editingTags,
      what_went_well: editingWhatWentWell,
      what_went_wrong: editingWhatWentWrong,
      what_will_i_do_differently: editingWhatWillIDoDifferently,
    };

    try {
      const response = await fetch('/api/journal/', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(journalData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to save journal entry:', errorData);
        return;
      }
      
      const savedData = await response.json();
      const newJournalEntry = savedData.data[0];

      setJournalEvents(prev => prev.map(event => 
        event.id === selectedEvent.id 
          ? { 
              ...event, 
              notes: editingNotes, 
              tags: editingTags, 
              what_went_well: editingWhatWentWell,
              what_went_wrong: editingWhatWentWrong,
              what_will_i_do_differently: editingWhatWillIDoDifferently,
              journal_entry_id: newJournalEntry.id,
              is_journaled: true,
              journal_updated_at: newJournalEntry.updated_at,
            } 
          : event
      ).sort((a, b) => {
          const dateA = a.journal_updated_at ? new Date(a.journal_updated_at) : new Date(a.date);
          const dateB = b.journal_updated_at ? new Date(b.journal_updated_at) : new Date(b.date);
          return dateB.getTime() - dateA.getTime();
      }));

      // Note: The local state is already updated above, so the change should be visible immediately
      
      setSelectedEvent(null);
      setEditingNotes('');
      setEditingTags([]);
      setEditingWhatWentWell('');
      setEditingWhatWentWrong('');
      setEditingWhatWillIDoDifferently('');

    } catch (error) {
      console.error('An error occurred while saving the journal entry:', error);
    }
  };

  const handleJournalClick = (e: React.MouseEvent, tradeGroup: JournalEvent[]) => {
    e.stopPropagation();
    const unjournaled = tradeGroup.filter(t => !t.is_journaled);
    if (unjournaled.length === 1) {
      setSelectedEvent(unjournaled[0]);
    } else {
      setViewingTradeHistory(tradeGroup);
    }
  };

  const handleDeleteJournal = async () => {
    if (!viewingEvent) return;

    try {
      const response = await fetch('/api/journal', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tx_hash: viewingEvent.id, userId: dbUser?.id }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete journal entry');
      }

      setJournalEvents(prev => prev.map(e => 
        e.id === viewingEvent.id 
          ? { 
              ...e, 
              is_journaled: false, 
              notes: undefined, 
              tags: undefined, 
              what_went_well: undefined,
              what_went_wrong: undefined,
              what_will_i_do_differently: undefined,
              journal_updated_at: undefined,
            } 
          : e
      ));
      setViewingEvent(null);

    } catch (error) {
      console.error('Error deleting journal entry:', error);
    }
  };

  const handleToggleFlag = async (event: React.MouseEvent, trade: JournalEvent) => {
    event.stopPropagation();
    const newFlaggedState = !trade.is_flagged;
    
    setJournalEvents(prev => prev.map(e => e.id === trade.id ? { ...e, is_flagged: newFlaggedState } : e));
    
    try {
      await fetch('/api/journal/flag', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tx_hash: trade.id, is_flagged: newFlaggedState, userId: dbUser?.id }),
      });
    } catch (error) {
      console.error('Failed to update flag status:', error);
      setJournalEvents(prev => prev.map(e => e.id === trade.id ? { ...e, is_flagged: !newFlaggedState } : e));
    }
  };

    return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">P&L Journal</h1>
      </div>
      <PnlCalendar events={journalEvents} onDayClick={handleDayClick} />
      <JournalSummary stats={summaryStats} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="not-journaled">❌ Not Journaled <Badge className="ml-2">{notJournaledTrades.length}</Badge></TabsTrigger>
          <TabsTrigger value="journaled">✅ Journaled <Badge className="ml-2">{journaledTrades.length}</Badge></TabsTrigger>
        </TabsList>
        <div className="my-4">
          <Label>Journaling Progress</Label>
          <Progress value={journaledPercentage} className="w-full" />
          <p className="text-sm text-right mt-1">{journaledPercentage.toFixed(0)}% Complete</p>
        </div>
        <TabsContent value="not-journaled"></TabsContent>
        <TabsContent value="journaled"></TabsContent>
      </Tabs>

      <div className="sticky top-0 bg-background py-4 z-10">
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
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="flag-filter" checked={showFlaggedOnly} onCheckedChange={setShowFlaggedOnly} />
            <Label htmlFor="flag-filter">Show Flagged Only</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="hide-journaled" checked={hideJournaled} onCheckedChange={setHideJournaled} />
            <Label htmlFor="hide-journaled">Hide Journaled</Label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {groupedAndFilteredEvents.map((tradeGroup) => (
          <GroupedJournalCard
            key={tradeGroup[0].token_address}
            tradeGroup={tradeGroup}
            onSelect={() => setViewingTradeHistory(tradeGroup)}
            onJournalClick={(e) => handleJournalClick(e, tradeGroup)}
          />
        ))}
      </div>

      <TradeHistoryModal
        trades={viewingTradeHistory}
        tokenSymbol={viewingTradeHistory?.[0]?.token_symbol || ''}
        onClose={() => setViewingTradeHistory(null)}
        onJournal={(trade) => {
          setViewingTradeHistory(null);
          setSelectedEvent(trade);
        }}
        onViewReflection={(trade) => {
          setViewingTradeHistory(null);
          setViewingEvent(trade);
        }}
      />

      <DayTradesModal 
        date={selectedDate} 
        trades={tradesForSelectedDate} 
        onClose={() => setSelectedDate(null)} 
      />

      <ReflectionModal 
        event={viewingEvent} 
        onClose={() => setViewingEvent(null)} 
        onSave={handleReflectionSave}
        onDelete={handleDeleteJournal}
      />

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
                <h4 className="font-semibold mb-2 text-gray-400">What went well?</h4>
                <Textarea
                  placeholder="What went well with this trade?"
                  value={editingWhatWentWell}
                  onChange={(e) => setEditingWhatWentWell(e.target.value)}
                  className="bg-gray-800 border-gray-600"
                />
              </div>
              
              <div>
                <h4 className="font-semibold mb-2 text-gray-400">What went wrong?</h4>
                <Textarea
                  placeholder="What went wrong with this trade?"
                  value={editingWhatWentWrong}
                  onChange={(e) => setEditingWhatWentWrong(e.target.value)}
                  className="bg-gray-800 border-gray-600"
                />
              </div>

              <div>
                <h4 className="font-semibold mb-2 text-gray-400">What will you do differently?</h4>
                <Textarea
                  placeholder="What will you do differently next time?"
                  value={editingWhatWillIDoDifferently}
                  onChange={(e) => setEditingWhatWillIDoDifferently(e.target.value)}
                  className="bg-gray-800 border-gray-600"
                />
              </div>

              <div>
                <h4 className="font-semibold mb-2 text-gray-400">Tags (up to 5)</h4>
                <MultiSelect
                  options={tagOptions}
                  onValueChange={(value) => {
                    if (value.length <= 5) {
                      setEditingTags(value);
                    }
                  }}
                  defaultValue={editingTags}
                  placeholder="Select up to 5 tags..."
                  className="w-full"
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