"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User, Wallet } from '@/lib/types';
import { usePrivy } from '@privy-io/react-auth';
import { authedFetchClient, parseApiResponse } from '@/lib/authedFetch';

interface WalletFilterContextType {
  dbUserId: number | null;
  wallets: Wallet[];
  selectedWalletId: number | null; // null represents "All wallets"
  selectedWallet: Wallet | null;
  activeWalletAddress: string | null;
  setSelectedWalletId: (walletId: number | null) => void;
  refreshWallets: () => void;
  loading: boolean;
}

const WalletFilterContext = createContext<WalletFilterContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'tradelog:selectedWallet';

export const WalletFilterProvider = ({ children, dbUser }: { children: ReactNode, dbUser: User | null }) => {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWalletId, setSelectedWalletIdState] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Derive selectedWallet from selectedWalletId and wallets
  const selectedWallet = selectedWalletId === null 
    ? null 
    : wallets.find(w => w.id === selectedWalletId) || null;
  const activeWalletAddress = selectedWalletId === null ? null : (selectedWallet?.wallet_address ?? null);

  const getLocalStorageKey = useCallback(() => {
    if (!dbUser) return LOCAL_STORAGE_KEY;
    return `tradelog:selectedWalletId:${dbUser.id}`;
  }, [dbUser]);

  const getBearerToken = useCallback(async () => (await getAccessToken?.()) || null, [getAccessToken]);

  const fetchWallets = useCallback(async () => {
    if (!ready || !authenticated) {
      setLoading(false);
      return;
    }
    if (!dbUser) {
      setWallets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await authedFetchClient(getBearerToken, '/api/wallets');
      if (response.ok) {
        const data = await parseApiResponse<Wallet[]>(response);
        setWallets(data);

        // After fetching, apply fallback logic for selection if not already set
        const storageKey = getLocalStorageKey();
        const savedSelection = localStorage.getItem(storageKey);
        
        if (!savedSelection && data.length === 1) {
            setSelectedWalletIdState(data[0].id);
            localStorage.setItem(storageKey, String(data[0].id));
        } else if (!savedSelection) {
            setSelectedWalletIdState(null);
            localStorage.setItem(storageKey, 'all');
        } else {
             // Restore from saved selection
             if (savedSelection === 'all') {
                setSelectedWalletIdState(null);
             } else {
                const numericId = parseInt(savedSelection, 10);
                if (!isNaN(numericId)) {
                    setSelectedWalletIdState(numericId);
                }
             }
        }

      } else {
        console.error("Failed to fetch wallets");
        setWallets([]);
      }
    } catch (error) {
      console.error("Error fetching wallets:", error);
      setWallets([]);
    } finally {
      setLoading(false);
    }
  }, [ready, authenticated, dbUser, getLocalStorageKey, getBearerToken]);

  useEffect(() => {
    fetchWallets();
  }, [fetchWallets]);

  const setSelectedWalletId = (walletId: number | null) => {
    const storageKey = getLocalStorageKey();
    const valueToStore = walletId === null ? 'all' : String(walletId);
    localStorage.setItem(storageKey, valueToStore);
    setSelectedWalletIdState(walletId);
  };

  const value = {
    dbUserId: dbUser?.id ?? null,
    wallets,
    selectedWalletId,
    selectedWallet,
    activeWalletAddress,
    setSelectedWalletId,
    refreshWallets: fetchWallets,
    loading
  };

  return (
    <WalletFilterContext.Provider value={value}>
      {children}
    </WalletFilterContext.Provider>
  );
};

export const useWalletFilter = () => {
  const context = useContext(WalletFilterContext);
  if (context === undefined) {
    throw new Error('useWalletFilter must be used within a WalletFilterProvider');
  }
  return context;
};
