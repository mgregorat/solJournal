'use client';

import { UnifiedWalletProvider } from '@jup-ag/wallet-adapter';
import { FC, ReactNode } from 'react';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { WalletNotification } from '@/components/WalletNotification';

export const JupiterWalletProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const wallets = [
    new PhantomWalletAdapter(),
  ];

  const config = {
    autoConnect: true,
    env: 'mainnet-beta' as const,
    metadata: {
      name: 'Tradelog',
      description: 'Your personal crypto trading journal',
      url: 'https://tradelog.pro',
      iconUrls: ['https://tradelog.pro/icon.png'],
    },
    notificationCallback: WalletNotification,
    walletlistExplanation: {
      href: 'https://station.jup.ag/docs/additional-topics/wallet-list',
    },
  };

  return (
    <UnifiedWalletProvider wallets={wallets} config={config}>
      {children}
    </UnifiedWalletProvider>
  );
}; 