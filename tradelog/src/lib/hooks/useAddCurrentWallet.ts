"use client";

import { useCallback, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletName } from "@solana/wallet-adapter-base";
import { usePrivy } from "@privy-io/react-auth";
import { useWalletFilter } from "@/app/contexts/WalletFilterContext";
import { authedFetchClient } from "@/lib/authedFetch";
import bs58 from "bs58";
import toast from "react-hot-toast";

type MaybeSignMessageAdapter = {
  publicKey?: { toBase58: () => string } | null;
  signMessage?: ((message: Uint8Array) => Promise<Uint8Array>) | undefined;
  name: string;
};

type VerifyWallet = {
  id: number;
  wallet_address: string;
  label?: string | null;
};

type VerifyResponse = {
  wallet?: VerifyWallet;
  newlyLinked?: boolean;
};

type ChallengeResponse = {
  message?: string;
  nonce?: string;
};

type LegacyErrorBody = {
  error?: { code?: string; message?: string } | string;
  code?: string;
  message?: string;
  upgrade_required?: boolean;
  limit?: number;
  paid_limit?: number;
};

export type AddWalletResult =
  | { type: "success"; wallet: VerifyWallet }
  | { type: "already_added"; wallet: VerifyWallet }
  | { type: "linked_elsewhere" }
  | { type: "limit_reached"; limit?: number; paidLimit?: number }
  | { type: "cancelled" }
  | { type: "signature_rejected" }
  | { type: "error"; code: string; message: string };

async function parseJsonSafe<T>(res: Response): Promise<T | Record<string, unknown>> {
  try {
    return (await res.json()) as T;
  } catch {
    return {};
  }
}

function getErrorCodeAndMessage(body: LegacyErrorBody): { code: string; message: string } {
  if (body && typeof body.error === "object" && body.error !== null) {
    return {
      code: body.error.code || body.code || "unknown_error",
      message: body.error.message || body.message || "Request failed",
    };
  }
  if (body && typeof body.error === "string") {
    return {
      code: body.code || "unknown_error",
      message: body.error,
    };
  }
  return {
    code: body?.code || "unknown_error",
    message: body?.message || "Request failed",
  };
}

function isUserCancelled(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("user rejected") ||
    message.includes("user denied") ||
    message.includes("request rejected") ||
    message.includes("cancelled") ||
    message.includes("canceled") ||
    message.includes("4001")
  );
}

function isSignatureRejected(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("sign") && (message.includes("rejected") || message.includes("denied") || message.includes("cancel"));
}

async function waitForPhantomReady(
  getState: () => {
    walletAddress: string | null;
    signMessageFn: ((message: Uint8Array) => Promise<Uint8Array>) | null;
  },
  timeoutMs = 2500
): Promise<{ walletAddress: string | null; signMessageFn: ((message: Uint8Array) => Promise<Uint8Array>) | null }> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const state = getState();
    if (state.walletAddress && state.signMessageFn) {
      return state;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return getState();
}

export function useAddCurrentWallet() {
  const {
    dbUserId,
    refreshWallets,
    setSelectedWalletId,
  } = useWalletFilter();
  const {
    publicKey,
    connected,
    connecting,
    wallets: availableWallets,
    wallet,
    select,
    connect,
  } = useWallet();
  const { getAccessToken, login } = usePrivy();

  const [isAddingWallet, setIsAddingWallet] = useState(false);
  const [isImportingWallet, setIsImportingWallet] = useState(false);

  const getBearerToken = useCallback(async () => (await getAccessToken?.()) || null, [getAccessToken]);

  const ensurePhantomConnection = useCallback(async (): Promise<{
    walletAddress: string | null;
    signMessageFn: ((message: Uint8Array) => Promise<Uint8Array>) | null;
  }> => {
    const currentAdapter = wallet?.adapter as MaybeSignMessageAdapter | undefined;
    const getCurrentState = () => ({
      walletAddress: publicKey?.toBase58() || currentAdapter?.publicKey?.toBase58() || null,
      signMessageFn: currentAdapter?.signMessage ? currentAdapter.signMessage.bind(currentAdapter) : null,
    });

    const currentState = getCurrentState();
    if (publicKey && connected) {
      return currentState;
    }

    const phantom = availableWallets.find((w) =>
      w.adapter?.name?.toLowerCase().includes("phantom")
    );

    if (!phantom) {
      throw new Error("Phantom wallet adapter is unavailable.");
    }

    if (!wallet || wallet.adapter.name !== phantom.adapter.name) {
      select(phantom.adapter.name as WalletName);
    }

    await connect();

    const phantomAdapter = phantom.adapter as MaybeSignMessageAdapter;
    return waitForPhantomReady(() => ({
      walletAddress:
        phantomAdapter.publicKey?.toBase58() ||
        publicKey?.toBase58() ||
        currentAdapter?.publicKey?.toBase58() ||
        null,
      signMessageFn:
        (phantomAdapter.signMessage
          ? phantomAdapter.signMessage.bind(phantomAdapter)
          : currentAdapter?.signMessage
            ? currentAdapter.signMessage.bind(currentAdapter)
            : null),
    }));
  }, [availableWallets, connect, connected, publicKey, select, wallet]);

  const handleAddCurrentWallet = useCallback(async (): Promise<AddWalletResult> => {
    if (!dbUserId) {
      login();
      return { type: "error", code: "unauthorized", message: "Please log in first." };
    }

    setIsAddingWallet(true);
    try {
      let walletAddress: string | null = null;
      let signMessageFn: ((message: Uint8Array) => Promise<Uint8Array>) | null = null;
      try {
        const connectedWallet = await ensurePhantomConnection();
        walletAddress = connectedWallet.walletAddress;
        signMessageFn = connectedWallet.signMessageFn;
      } catch (connectError) {
        if (isUserCancelled(connectError)) {
          return { type: "cancelled" };
        }
        throw connectError;
      }

      if (!walletAddress) {
        return { type: "error", code: "bad_request", message: "Connect Phantom first." };
      }
      if (!signMessageFn) {
        return {
          type: "error",
          code: "bad_request",
          message: "This wallet does not support message signing.",
        };
      }

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const challengeRes = await authedFetchClient(getBearerToken, "/api/wallets/challenge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress }),
        });
        const challengeBody = await parseJsonSafe<{
          data?: ChallengeResponse;
          error?: { message?: string };
        }>(challengeRes);

        if (challengeRes.status === 401) {
          login();
          return { type: "error", code: "unauthorized", message: "Session expired. Please log in again." };
        }
        if (!challengeRes.ok) {
          const parsedChallengeError = getErrorCodeAndMessage(challengeBody as LegacyErrorBody);
          return {
            type: "error",
            code: parsedChallengeError.code || "internal_error",
            message: parsedChallengeError.message || "Failed to create signing challenge.",
          };
        }

        const challengeData =
          ((challengeBody as { data?: ChallengeResponse })?.data as ChallengeResponse | undefined) ||
          (challengeBody as ChallengeResponse);
        const message = String(challengeData.message || "");
        const nonce = String(challengeData.nonce || "");
        if (!message || !nonce) {
          return { type: "error", code: "internal_error", message: "Invalid challenge response." };
        }

        let signatureBytes: Uint8Array;
        try {
          signatureBytes = await signMessageFn(new TextEncoder().encode(message));
        } catch (signError) {
          if (isUserCancelled(signError) || isSignatureRejected(signError)) {
            return { type: "signature_rejected" };
          }
          throw signError;
        }
        const signature = bs58.encode(signatureBytes);

        const verifyRes = await authedFetchClient(getBearerToken, "/api/wallets/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress,
            nonce,
            message,
            signature,
          }),
        });

        const verifyBody = await parseJsonSafe<{
          data?: VerifyResponse;
          error?: { message?: string };
          upgrade_required?: boolean;
          limit?: number;
          paid_limit?: number;
        }>(verifyRes);

        if (verifyRes.status === 401) {
          login();
          return { type: "error", code: "unauthorized", message: "Authentication failed. Please log in again." };
        }

        const parsedVerifyError = getErrorCodeAndMessage(verifyBody as LegacyErrorBody);
        const verifyMessage = (parsedVerifyError.message || "").toLowerCase();

        if (verifyRes.status === 409) {
          if (verifyMessage.includes("already used")) {
            continue;
          }
          if (verifyMessage.includes("another user")) {
            return { type: "linked_elsewhere" };
          }
          return {
            type: "error",
            code: parsedVerifyError.code || "conflict",
            message: parsedVerifyError.message || "Wallet verification conflict.",
          };
        }

        if (verifyRes.status === 403) {
          const legacyBody = verifyBody as LegacyErrorBody;
          if (legacyBody.upgrade_required || verifyMessage.includes("limit")) {
            return {
              type: "limit_reached",
              limit: legacyBody.limit,
              paidLimit: legacyBody.paid_limit,
            };
          }
          if (verifyMessage.includes("another user")) {
            return { type: "linked_elsewhere" };
          }
          return {
            type: "error",
            code: parsedVerifyError.code || "forbidden",
            message: parsedVerifyError.message || "Wallet verification forbidden.",
          };
        }

        if (!verifyRes.ok) {
          if (verifyMessage.includes("another user")) {
            return { type: "linked_elsewhere" };
          }
          if (verifyMessage.includes("already linked") || verifyMessage.includes("resolve linked wallet")) {
            return { type: "linked_elsewhere" };
          }
          if (verifyMessage.includes("signature")) {
            return { type: "signature_rejected" };
          }
          return {
            type: "error",
            code: parsedVerifyError.code || "internal_error",
            message: parsedVerifyError.message || "Failed to link wallet.",
          };
        }

        const verifyData =
          ((verifyBody as { data?: VerifyResponse })?.data as VerifyResponse | undefined) ||
          (verifyBody as VerifyResponse);
        const nextWallet = verifyData.wallet;
        if (!nextWallet?.id) {
          return {
            type: "error",
            code: "internal_error",
            message: "Linked wallet response missing wallet record.",
          };
        }

        await refreshWallets();
        setSelectedWalletId(nextWallet.id);

        if (verifyData.newlyLinked === false) {
          return { type: "already_added", wallet: nextWallet };
        }
        return { type: "success", wallet: nextWallet };
      }

      return {
        type: "error",
        code: "conflict",
        message: "Challenge already used. Please try again.",
      };
    } catch (error) {
      if (isUserCancelled(error)) {
        return { type: "cancelled" };
      }
      if (isSignatureRejected(error)) {
        return { type: "signature_rejected" };
      }

      const message = error instanceof Error ? error.message : "Wallet linking failed.";
      return { type: "error", code: "internal_error", message };
    } finally {
      setIsAddingWallet(false);
    }
  }, [dbUserId, ensurePhantomConnection, getBearerToken, login, refreshWallets, setSelectedWalletId]);

  const handleImportWalletAddress = useCallback(
    async (walletAddressRaw: string) => {
      const walletAddress = walletAddressRaw.trim();
      if (!walletAddress) {
        toast.error("Wallet address is required.");
        return null;
      }
      if (!dbUserId) {
        toast.error("Please log in first.");
        login();
        return null;
      }

      setIsImportingWallet(true);
      try {
        const response = await authedFetchClient(getBearerToken, "/api/wallets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress }),
        });
        const body = await parseJsonSafe<{ data?: VerifyWallet; wallet_address?: string }>(response);
        if (!response.ok) {
          const message =
            (body as { error?: { message?: string } })?.error?.message ||
            "Failed to import wallet address.";
          throw new Error(message);
        }

        const walletData =
          ((body as { data?: VerifyWallet }).data as VerifyWallet | undefined) ||
          (body as VerifyWallet);
        if (!walletData?.id) {
          throw new Error("Invalid wallet response.");
        }

        await refreshWallets();
        setSelectedWalletId(walletData.id);
        toast.success("Wallet imported.");
        return walletData;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to import wallet.";
        toast.error(message);
        return null;
      } finally {
        setIsImportingWallet(false);
      }
    },
    [dbUserId, getBearerToken, login, refreshWallets, setSelectedWalletId]
  );

  const canAddCurrentWallet = useMemo(
    () => !isAddingWallet && !connecting,
    [connecting, isAddingWallet]
  );

  return {
    handleAddCurrentWallet,
    handleImportWalletAddress,
    isAddingWallet,
    isImportingWallet,
    canAddCurrentWallet,
  };
}
