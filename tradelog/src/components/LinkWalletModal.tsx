"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { usePrivy } from "@privy-io/react-auth";
import bs58 from "bs58";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { shortenAddress } from "@/lib/utils";
import { useWalletFilter } from "@/app/contexts/WalletFilterContext";

type VerifyWallet = {
  id: number;
  wallet_address: string;
  label?: string | null;
  created_at?: string | null;
};

type UpgradeInfo = {
  limit?: number;
  paid_limit?: number;
  linkedCount?: number;
};

type LinkWalletModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLinked?: (wallet: VerifyWallet, newlyLinked: boolean) => Promise<void> | void;
};

async function parseJsonSafe(res: Response) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export function LinkWalletModal({ open, onOpenChange, onLinked }: LinkWalletModalProps) {
  const { wallets, dbUserId } = useWalletFilter();
  const { publicKey, connected, signMessage } = useWallet();
  const { setVisible } = useWalletModal();
  const { login, getAccessToken } = usePrivy();
  const [isLinking, setIsLinking] = useState(false);
  const [upgradeInfo, setUpgradeInfo] = useState<UpgradeInfo | null>(null);
  const FREE_LIMIT = 2;
  const PAID_LIMIT = 10;

  const walletAddress = publicKey?.toBase58() || null;
  const walletLabel = walletAddress ? shortenAddress(walletAddress) : null;

  const getAuthHeaders = async () => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const token = (await getAccessToken?.()) || null;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  };

  const getFreshWalletCount = async () => {
    if (!dbUserId) return wallets.length;
    try {
      const res = await fetch(`/api/wallets?userId=${dbUserId}`);
      if (!res.ok) return wallets.length;
      const data = await res.json();
      return Array.isArray(data) ? data.length : wallets.length;
    } catch {
      return wallets.length;
    }
  };

  const runLinkFlow = async () => {
    if (!walletAddress) {
      toast.error("Connect Phantom first.");
      return;
    }
    if (!signMessage) {
      toast.error("This wallet does not support message signing.");
      return;
    }

    const alreadyLinked = wallets.some((wallet) => wallet.wallet_address === walletAddress);
    if (!alreadyLinked) {
      const linkedCount = await getFreshWalletCount();
      if (linkedCount >= FREE_LIMIT) {
        setUpgradeInfo({
          limit: FREE_LIMIT,
          paid_limit: PAID_LIMIT,
          linkedCount,
        });
        return;
      }
    }

    setIsLinking(true);
    try {
      const headers = await getAuthHeaders();
      let retryOnUsedChallenge = false;

      for (let attempt = 0; attempt < 2; attempt++) {
        const challengeRes = await fetch("/api/wallets/challenge", {
          method: "POST",
          headers,
          body: JSON.stringify({ walletAddress }),
        });
        const challengeData = await parseJsonSafe(challengeRes);

        if (challengeRes.status === 401) {
          toast.error("Session expired. Please log in again.");
          login();
          return;
        }
        if (!challengeRes.ok) {
          throw new Error(challengeData?.error || "Failed to create signing challenge.");
        }

        const message = String(challengeData.message || "");
        const nonce = String(challengeData.nonce || "");
        if (!message || !nonce) {
          throw new Error("Invalid challenge response.");
        }

        const signatureBytes = await signMessage(new TextEncoder().encode(message));
        const signature = bs58.encode(signatureBytes);

        const verifyRes = await fetch("/api/wallets/verify", {
          method: "POST",
          headers,
          body: JSON.stringify({
            walletAddress,
            nonce,
            message,
            signature,
          }),
        });
        const verifyData = await parseJsonSafe(verifyRes);

        if (verifyRes.status === 401) {
          toast.error("Authentication failed. Please log in again.");
          login();
          return;
        }
        if (verifyRes.status === 403 && verifyData?.upgrade_required) {
          const linkedCount = await getFreshWalletCount();
          setUpgradeInfo({
            limit: Number(verifyData?.limit) || undefined,
            paid_limit: Number(verifyData?.paid_limit) || undefined,
            linkedCount,
          });
          return;
        }
        if (verifyRes.status === 409) {
          retryOnUsedChallenge = true;
          continue;
        }
        if (!verifyRes.ok) {
          throw new Error(verifyData?.error || "Failed to link wallet.");
        }

        const wallet = verifyData?.wallet as VerifyWallet | undefined;
        if (!wallet?.id) {
          throw new Error("Linked wallet response missing wallet record.");
        }

        await onLinked?.(wallet, Boolean(verifyData?.newlyLinked));
        toast.success(verifyData?.newlyLinked ? "Wallet linked." : "Wallet already linked.");
        onOpenChange(false);
        return;
      }

      if (retryOnUsedChallenge) {
        toast.error("Challenge already used. Please try again.");
      }
    } catch (error: any) {
      toast.error(error?.message || "Wallet linking failed.");
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !isLinking && onOpenChange(next)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Add Wallet</DialogTitle>
          </DialogHeader>

          {!connected || !walletAddress ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Connect Phantom to start secure wallet linking.
              </p>
              <Button onClick={() => setVisible(true)} disabled={isLinking}>
                Connect Phantom
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Wallet to link: <span className="text-white">{walletLabel}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                You will be prompted to sign a one-time challenge in Phantom.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLinking}>
              Cancel
            </Button>
            <Button
              onClick={runLinkFlow}
              disabled={isLinking || !connected || !walletAddress || !signMessage}
            >
              {isLinking ? "Linking..." : "Link Wallet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!upgradeInfo} onOpenChange={(next) => !next && setUpgradeInfo(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Wallet Limit Reached</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            You reached your current wallet limit
            {upgradeInfo?.limit ? ` (${upgradeInfo.limit})` : ""}
            {typeof upgradeInfo?.linkedCount === "number" ? ` with ${upgradeInfo.linkedCount} linked` : ""}.
            Upgrade to link more wallets
            {upgradeInfo?.paid_limit ? ` (up to ${upgradeInfo.paid_limit})` : ""}.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                toast("Upgrade flow coming soon.");
              }}
            >
              Upgrade to Pro
            </Button>
            <Button onClick={() => setUpgradeInfo(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
