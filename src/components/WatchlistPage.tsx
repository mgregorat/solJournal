"use client";
import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Trash2, AlertTriangle, Bell, BellOff, ArrowUp, ArrowDown, Copy, Clock, RefreshCw } from 'lucide-react';
import { toast } from "sonner";
import { cn } from '@/lib/utils';

interface WatchlistDbItem {
  id: number;
  user_id: number;
  token_address: string;
}

interface WatchedToken {
  mint: string;
  symbol: string;
  name: string;
  price: number;
  volume: number;
  priceChange: number;
  priceChanges?: {
    '5m': number;
    '1h': number;
    '6h': number;
    '24h': number;
  };
  liquidity: number;
  marketCap: number;
  imageUrl?: string;
  pairAddress?: string;
  dexId?: string;
  url?: string;
  alerts: {
    priceChange?: {
      percentage: number;
      direction: 'up' | 'down';
      isActive: boolean;
    };
    volumeSpike?: {
      percentage: number;
      isActive: boolean;
    };
  };
}

type TimeFrame = '5m' | '1h' | '6h' | '24h';

const Stat = ({ label, value }: { label: string; value: string | number }) => (
    <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
    </div>
);

const PriceChangeDisplay = ({ 
  token, 
  timeframe 
}: { 
  token: WatchedToken; 
  timeframe: TimeFrame;
}) => {
  const change = token.priceChanges?.[timeframe] ?? token.priceChange;
  const isPositive = change >= 0;
  
  return (
    <div className={cn("flex items-center justify-end text-sm font-semibold", isPositive ? 'text-green-400' : 'text-red-400')}>
      {isPositive ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
      <span>{isPositive ? '+' : ''}{change.toFixed(2)}%</span>
    </div>
  );
};

export const WatchlistPage = ({ initialWatchlist = [], dbUser }: { initialWatchlist: any[], dbUser: any }) => {
  const [watchlist, setWatchlist] = useState<WatchedToken[]>(initialWatchlist);
  const [newMint, setNewMint] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeFrame>('24h');

  useEffect(() => {
    setWatchlist(initialWatchlist);
  }, [initialWatchlist]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Address copied to clipboard");
  };

  const refreshTokenData = async (token: WatchedToken): Promise<WatchedToken | null> => {
    try {
      const response = await fetch(`/api/watchlist-token-details?mint=${token.mint}`);
      if (!response.ok) return null;
      const data = await response.json();
      return { ...token, ...data };
    } catch (error) {
      console.error(`Error refreshing ${token.symbol}:`, error);
      return null;
    }
  };

  const refreshAllTokens = async () => {
    if (watchlist.length === 0) {
      toast.info("No tokens to refresh");
      return;
    }

    setIsRefreshing(true);
    
    try {
      // Refresh all tokens in parallel
      const refreshPromises = watchlist.map(token => refreshTokenData(token));
      const refreshedTokens = await Promise.all(refreshPromises);
      
      // Filter out failed refreshes and update the watchlist
      const updatedWatchlist = refreshedTokens
        .map((refreshedToken, index) => refreshedToken || watchlist[index])
        .filter(Boolean);
      
      const successCount = refreshedTokens.filter(token => token !== null).length;
      const failCount = refreshedTokens.length - successCount;
      
      setWatchlist(updatedWatchlist);
      
      if (failCount === 0) {
        toast.success(`Successfully refreshed ${successCount} tokens`);
      } else {
        toast.warning(`Refreshed ${successCount} tokens, ${failCount} failed`);
      }
      
    } catch (error) {
      console.error("Error refreshing tokens:", error);
      toast.error("Failed to refresh token data");
    } finally {
      setIsRefreshing(false);
    }
  };

  const addToken = async () => {
    if (!newMint.trim()) return toast.error("Please enter a token contract address.");
    if (watchlist.some(t => t.mint === newMint.trim())) return toast.error("This token is already in your watchlist.");
    if (!dbUser) return toast.error("User not authenticated.");
    
    setIsLoading(true);

    try {
      const dbResponse = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: dbUser.id, token_address: newMint.trim() }),
      });
      
      if (!dbResponse.ok) {
        throw new Error((await dbResponse.json()).error || "Failed to add token.");
      }

      // Instead of calling another endpoint, we can just refetch the whole list
      // or optimistically update. For now, let's refetch for simplicity,
      // though this could be optimized later.
      const listResponse = await fetch(`/api/watchlist?user_id=${dbUser.id}`);
      if (listResponse.ok) {
        setWatchlist(await listResponse.json());
        toast.success(`Token added to your watchlist!`);
      }
      setNewMint('');

    } catch (error: any) {
      console.error("Error adding token:", error);
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const removeToken = async (mint: string) => {
    if (!dbUser) return toast.error("User not authenticated.");

    try {
        const response = await fetch('/api/watchlist', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: dbUser.id, token_address: mint }),
        });

        if (!response.ok) {
            throw new Error("Failed to remove token from watchlist.");
        }

        setWatchlist(watchlist.filter(t => t.mint !== mint));
        toast.success("Token removed from watchlist.");

    } catch (error: any) {
        console.error("Error removing token:", error);
        toast.error(error.message);
    }
  };

  const toggleAlert = (mint: string, alertType: 'priceChange' | 'volumeSpike') => {
    setWatchlist(watchlist.map(token => {
      if (token.mint === mint) {
        const alert = token.alerts[alertType];
        if (alert) {
          alert.isActive = !alert.isActive;
        }
      }
      return token;
    }));
  };

  const getTimeframeLabel = (timeframe: TimeFrame) => {
    switch (timeframe) {
      case '5m': return '5 Minutes';
      case '1h': return '1 Hour';
      case '6h': return '6 Hours';
      case '24h': return '24 Hours';
      default: return '24 Hours';
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Token Watchlist</h1>
          <p className="text-gray-400 mt-1">Monitor your favorite Solana tokens with real-time price data</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <p className="text-sm text-gray-400">Tokens Tracked</p>
            <p className="text-2xl font-bold text-white">{watchlist.length}</p>
          </div>
          <div className="flex items-center space-x-2">
            <Clock size={16} className="text-gray-400" />
            <Select value={selectedTimeframe} onValueChange={(value: TimeFrame) => setSelectedTimeframe(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5m">5 Minutes</SelectItem>
                <SelectItem value="1h">1 Hour</SelectItem>
                <SelectItem value="6h">6 Hours</SelectItem>
                <SelectItem value="24h">24 Hours</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button 
            onClick={refreshAllTokens} 
            disabled={isRefreshing || watchlist.length === 0}
            variant="outline"
            size="sm"
            className="flex items-center space-x-2"
          >
            <RefreshCw size={16} className={cn("transition-transform", isRefreshing && "animate-spin")} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </Button>
        </div>
      </div>

      <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-white">
            <span>Add New Token</span>
          </CardTitle>
          <p className="text-sm text-gray-400">Enter a Solana token contract address to add it to your watchlist</p>
        </CardHeader>
        <CardContent className="flex space-x-2">
          <Input 
            placeholder="Enter Solana token contract address (e.g., EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)"
            value={newMint}
            onChange={(e) => setNewMint(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isLoading) {
                addToken();
              }
            }}
            disabled={isLoading}
            className="flex-1"
          />
          <Button onClick={addToken} disabled={isLoading || !newMint.trim()}>
            {isLoading ? 'Adding...' : 'Add Token'}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {watchlist.map(token => (
          <Card key={token.mint} className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 hover:border-gray-600 transition-all duration-200">
            <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                        {token.imageUrl && (
                            <img src={token.imageUrl} alt={token.symbol} className="w-8 h-8 rounded-full" />
                        )}
                        <div>
                            <h3 className="font-semibold text-lg">{token.name} ({token.symbol})</h3>
                            <div className="flex items-center space-x-1">
                                <p className="text-sm text-gray-400 font-mono">{token.mint}</p>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(token.mint)}>
                                    <Copy size={12} />
                                </Button>
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="font-semibold text-xl text-white">
                          ${token.price < 0.01 ? token.price.toFixed(8) : token.price.toFixed(4)}
                        </p>
                        <div className="flex flex-col space-y-1">
                          <PriceChangeDisplay token={token} timeframe={selectedTimeframe} />
                          <p className="text-xs text-gray-500">{getTimeframeLabel(selectedTimeframe)}</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <Stat label="Volume (24h)" value={`$${token.volume.toLocaleString()}`} />
                    <Stat label="Liquidity" value={`$${token.liquidity.toLocaleString()}`} />
                    <Stat label="Market Cap" value={token.marketCap > 0 ? `$${token.marketCap.toLocaleString()}`: 'N/A'} />
                    <Stat label="DEX" value={token.dexId || 'N/A'} />
                </div>

                {/* Price changes for all timeframes */}
                <div className="grid grid-cols-4 gap-2 mb-4 p-3 bg-gray-800/50 rounded-lg">
                  {(['5m', '1h', '6h', '24h'] as TimeFrame[]).map((tf) => {
                    const change = token.priceChanges?.[tf] ?? (tf === '24h' ? token.priceChange : 0);
                    const isPositive = change >= 0;
                    return (
                      <div key={tf} className="text-center">
                        <p className="text-xs text-gray-400 mb-1">{tf.toUpperCase()}</p>
                        <div className={cn("text-sm font-semibold", isPositive ? 'text-green-400' : 'text-red-400')}>
                          {isPositive ? '+' : ''}{change.toFixed(2)}%
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => toggleAlert(token.mint, 'priceChange')}>
                            {token.alerts.priceChange?.isActive ? <Bell size={16} className="text-green-400" /> : <BellOff size={16} />}
                        </Button>
                        <span className="text-sm">Price Alert</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => toggleAlert(token.mint, 'volumeSpike')}>
                            {token.alerts.volumeSpike?.isActive ? <Bell size={16} className="text-green-400" /> : <BellOff size={16} />}
                        </Button>
                        <span className="text-sm">Volume Alert</span>
                    </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        {token.url && (
                          <Button variant="outline" size="sm" onClick={() => window.open(token.url, '_blank')}>
                            View Chart
                          </Button>
                        )}
                    <Button variant="destructive" size="icon" onClick={() => removeToken(token.mint)}>
                    <Trash2 size={16} />
                    </Button>
                    </div>
                </div>
            </CardContent>
          </Card>
        ))}
        {watchlist.length === 0 && (
          <div className="text-center text-gray-500 py-16">
            <AlertTriangle size={48} className="mx-auto" />
            <p className="mt-4">Your watchlist is empty.</p>
            <p className="text-sm">Add tokens to start monitoring them.</p>
          </div>
        )}
      </div>
    </div>
  );
}; 