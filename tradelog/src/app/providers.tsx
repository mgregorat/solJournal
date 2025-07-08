"use client";

import React, { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  CoinbaseWalletAdapter,
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TrustWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { WalletNotification } from '@/components/WalletNotification';
import { UnifiedWalletProvider } from "@jup-ag/wallet-adapter";
import { PrivyProvider } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { PrivyLoginHandler } from './PrivyLoginHandler';

require('@solana/wallet-adapter-react-ui/styles.css');

export function Providers({ children }: { children: React.ReactNode }) {
  const network = WalletAdapterNetwork.Mainnet;
  const endpoint = useMemo(() => `https://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`, []);
  
  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
    new CoinbaseWalletAdapter(),
    new TrustWalletAdapter(),
  ], []);

  const config = {
    autoConnect: true,
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
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <UnifiedWalletProvider wallets={wallets} config={config}>
            <PrivyProvider
              appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
              config={{
                loginMethods: ['email'],
                appearance: {
                  theme: 'light',
                  accentColor: '#676FFF',
                  logo: 'https://your-logo-url',
                },
                embeddedWallets: {
                  createOnLogin: 'users-without-wallets',
                },
              }}
            >
              <PrivyLoginHandler>
                {children}
              </PrivyLoginHandler>
            </PrivyProvider>
          </UnifiedWalletProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
} 