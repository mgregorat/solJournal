"use client";

import React, { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { WalletNotification } from '@/components/WalletNotification';
import { UnifiedWalletProvider } from "@jup-ag/wallet-adapter";
import dynamic from 'next/dynamic';

require('@solana/wallet-adapter-react-ui/styles.css');

const PrivyProvider = dynamic(() => import('./PrivyClientProvider'), { ssr: false });

export function Providers({ children }: { children: React.ReactNode }) {
  const network = WalletAdapterNetwork.Mainnet;
  const endpoint = useMemo(() => `https://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`, []);
  
  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
  ], []);

  const config = {
    autoConnect: false,
    env: WalletAdapterNetwork.Mainnet,
    metadata: {
      name: "Tradelog",
      description: "Log your Solana trades.",
      url: "https://tradelog.app",
      iconUrls: [],
    },
    notificationCallback: WalletNotification,
    walletlistExplanation: {
      href: "https://station.jup.ag/docs/additional-topics/wallet-list",
    },
    theme: "dark" as any,
    lang: "en" as any,
    rpcEndpoint: endpoint,
  };

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          <UnifiedWalletProvider wallets={wallets} config={config}>
            <PrivyProvider>
              {children}
            </PrivyProvider>
          </UnifiedWalletProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
