'use client';

import { IUnifiedWalletConfig, UnifiedWalletProvider } from '@jup-ag/wallet-adapter';
import { FC, ReactNode } from 'react';
import {
  CoinbaseWalletAdapter,
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TrustWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { WalletNotification } from '@/components/WalletNotification';

interface JupiterWalletProviderProps {
  children: ReactNode;
}

export const JupiterWalletProvider: FC<JupiterWalletProviderProps> = ({ children }) => {
  const wallets = [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
    new CoinbaseWalletAdapter(),
    new TrustWalletAdapter(),
  ];

  const config = {
    autoConnect: true,
    env: 'mainnet-beta',
    metadata: {
      name: 'Tradelog',
      description: 'Log your Solana trades.',
      url: 'https://tradelog.app',
      iconUrls: [],
    },
    notificationCallback: WalletNotification,
    walletlistExplanation: {
      href: 'https://station.jup.ag/docs/additional-topics/wallet-list',
    },
    theme: 'dark',
    lang: 'en',
    rpcEndpoint: `https://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`,
  } as IUnifiedWalletConfig;

  return (
    <UnifiedWalletProvider wallets={wallets} config={config}>
      {children}
    </UnifiedWalletProvider>
  );
}; 