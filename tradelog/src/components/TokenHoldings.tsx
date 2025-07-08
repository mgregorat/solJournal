"use client";
import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Wallet } from 'lucide-react';

interface TokenBalance {
  mint: string;
  amount: number;
  decimals: number;
  symbol?: string;
  name?: string;
  logoURI?: string;
}

export const TokenHoldings = () => {
  const { publicKey } = useWallet();
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicKey) {
      setTokens([]);
      return;
    }

    const fetchTokenHoldings = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/token-holdings?walletAddress=${publicKey.toBase58()}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch token holdings');
        }

        const data = await response.json();
        setTokens(data.tokens || []);
      } catch (err: any) {
        setError(err.message);
        console.error('Error fetching token holdings:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTokenHoldings();
  }, [publicKey]);

  if (!publicKey) {
    return (
      <div className="p-4 text-center text-gray-400">
        <Wallet size={20} className="mx-auto mb-2" />
        <p className="text-xs">Connect wallet to see holdings</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-400">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400 mx-auto mb-2"></div>
        <p className="text-xs">Loading holdings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-400">
        <p className="text-xs">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center space-x-2 mb-3">
        <Wallet size={16} className="text-gray-400" />
        <h4 className="text-sm font-semibold text-white">Holdings</h4>
      </div>
      
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {tokens.length === 0 ? (
          <p className="text-xs text-gray-400 text-center">No tokens found</p>
        ) : (
          tokens.map((token) => (
            <div key={token.mint} className="bg-gray-700/30 rounded p-2">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    {token.logoURI && (
                      <img 
                        src={token.logoURI} 
                        alt={token.symbol} 
                        className="w-4 h-4 rounded-full"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                    <span className="text-xs font-medium text-white truncate">
                      {token.symbol || 'Unknown'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 truncate">
                    {token.name || token.mint.slice(0, 8) + '...'}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium text-white">
                    {token.amount.toLocaleString(undefined, { 
                      maximumFractionDigits: token.decimals > 6 ? 6 : token.decimals 
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}; 