"use client";

import { usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";

export function LoginButton() {
    const { login, authenticated } = usePrivy();

    if (authenticated) {
        return null; // Don't show login button if already authenticated
    }

    return (
        <Button onClick={login}>Get Started</Button>
    );
}

export function HeroLoginButton() {
    const { login, authenticated } = usePrivy();

    if (authenticated) {
        return null;
    }

    return (
        <Button size="lg" className="bg-green-500 hover:bg-green-600 text-black font-bold" onClick={login}>
            Get Started
        </Button>
    );
} 