"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { PrivyLoginHandler } from './PrivyLoginHandler';

export default function PrivyClientProvider({ children }: { children: React.ReactNode }) {
    const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    
    // --- Start of new debug code ---
    const availableVars = Object.keys(process.env)
        .filter(key => key.startsWith("NEXT_PUBLIC_"))
        .join(", ");
    // --- End of new debug code ---

    if (!privyAppId) {
        console.error("Privy App ID is missing. Please check your environment variables. The app will continue without Privy functionality.");
        return (
            <div style={{
                position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                padding: '2rem', backgroundColor: 'darkred', color: 'white',
                textAlign: 'center', zIndex: 1000, fontSize: '1.2rem', borderRadius: '8px',
                border: '2px solid #ff0000', maxWidth: '90vw', wordBreak: 'break-all'
            }}>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>CRITICAL ERROR: Privy App ID is not available.</h2>
                <p style={{ marginBottom: '1rem' }}>Please verify NEXT_PUBLIC_PRIVY_APP_ID in Railway.</p>
                <div style={{ padding: '1rem', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
                    <h3 style={{ marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Available NEXT_PUBLIC_ Variables:</h3>
                    <p style={{ fontFamily: 'monospace', fontSize: '1rem' }}>
                        {availableVars || "NONE DETECTED"}
                    </p>
                </div>
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