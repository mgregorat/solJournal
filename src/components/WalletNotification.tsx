'use client';

import { toast } from "sonner";

// A simple toast-like notification handler for wallet events.
// This is a required part of the Jupiter wallet adapter setup.
// In a real app, you would replace this with a more robust toast library.
export const WalletNotification = {
    onConnect: (wallet: any) => {
        toast.success(`Connected to ${wallet.name}`);
        console.log('Wallet connected:', wallet);
    },
    onConnecting: (wallet: any) => {
        toast.loading(`Connecting to ${wallet.name}...`);
        console.log('Wallet connecting:', wallet);
    },
    onDisconnect: () => {
        toast.info('Wallet disconnected');
        console.log('Wallet disconnected');
    },
    onNotInstalled: (wallet: any) => {
        toast.error(`${wallet.name} is not installed.`);
        console.log('Wallet not installed:', wallet);
    }
}; 