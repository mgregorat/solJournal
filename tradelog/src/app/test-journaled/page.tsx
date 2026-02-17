'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallet } from '@solana/wallet-adapter-react';
import { JournalEvent } from '@/lib/types';

export default function TestJournaledTrades() {
  const [journaledTrades, setJournaledTrades] = useState<JournalEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, authenticated } = usePrivy();
  const { publicKey } = useWallet();

  const fetchJournaledTrades = async () => {
    if (!authenticated || !user || !publicKey) {
      console.log('Not authenticated or missing data');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get user ID first
      const userResponse = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ privy_did: user.id, email: user.email?.address }),
      });
      
      if (!userResponse.ok) throw new Error('Failed to get user');
      const syncedUser = await userResponse.json();
      const userId = syncedUser.id;
      const walletAddress = publicKey.toBase58();

      console.log(`Testing with userId: ${userId}, wallet: ${walletAddress}`);

      // Fetch journaled trades
      const response = await fetch(`/api/journaled-trades?userId=${userId}&walletAddress=${walletAddress}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setJournaledTrades(data);
      console.log('Journaled trades fetched:', data);

    } catch (err) {
      console.error('Error fetching journaled trades:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch journaled trades');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJournaledTrades();
  }, [authenticated, user, publicKey]);

  if (!authenticated) {
    return <div className="p-8">Please log in to test journaled trades.</div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4">Test Journaled Trades</h1>
        <button 
          onClick={fetchJournaledTrades}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          Error: {error}
        </div>
      )}

      <div className="bg-gray-100 p-4 rounded mb-4">
        <h2 className="font-bold mb-2">Results: {journaledTrades.length} journaled trades found</h2>
        
        {journaledTrades.length === 0 ? (
          <p>No journaled trades found.</p>
        ) : (
          <div className="space-y-4">
            {journaledTrades.map((trade, index) => (
              <div key={index} className="bg-white p-4 rounded border">
                <h3 className="font-bold">{trade.token_symbol}</h3>
                <p><strong>TX Hash:</strong> {trade.id}</p>
                <p><strong>Status:</strong> {trade.status}</p>
                <p><strong>Date:</strong> {trade.date}</p>
                <p><strong>Notes:</strong> {trade.notes || 'No notes'}</p>
                <p><strong>Tags:</strong> {trade.tags?.join(', ') || 'No tags'}</p>
                <p><strong>Is Journaled:</strong> {trade.is_journaled ? 'Yes' : 'No'}</p>
                {trade.what_went_well && <p><strong>What went well:</strong> {trade.what_went_well}</p>}
                {trade.what_went_wrong && <p><strong>What went wrong:</strong> {trade.what_went_wrong}</p>}
                {trade.what_will_i_do_differently && <p><strong>What will I do differently:</strong> {trade.what_will_i_do_differently}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 
