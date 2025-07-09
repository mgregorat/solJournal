"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { PrivyLoginHandler } from './PrivyLoginHandler';

export default function PrivyClientProvider({ children }: { children: React.ReactNode }) {
    const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

    if (!privyAppId) {
        // This check is important for local development if the .env.local file is missing.
        console.error("Privy App ID is missing. The app will continue without Privy functionality.");
        return <>{children}</>;
    }

    return (
        <PrivyProvider
            appId={privyAppId}
            config={{
                loginMethods: ['email'],
                appearance: {
                    theme: 'light',
                    accentColor: '#676FFF',
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
    );
} 