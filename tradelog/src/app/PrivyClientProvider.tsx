"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { PrivyLoginHandler } from './PrivyLoginHandler';

export default function PrivyClientProvider({ children }: { children: React.ReactNode }) {
    const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

    if (!privyAppId) {
        console.error("Privy App ID is missing. Please check your environment variables. The app will continue without Privy functionality.");
        // Return a visible error message for debugging on deployment
        return (
            <div style={{
                position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                padding: '2rem', backgroundColor: 'red', color: 'white',
                textAlign: 'center', zIndex: 1000, fontSize: '1.5rem', borderRadius: '8px',
                border: '2px solid darkred'
            }}>
                CRITICAL ERROR: Privy App ID is not available.
                <br />
                Please verify NEXT_PUBLIC_PRIVY_APP_ID in Railway.
            </div>
        );
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