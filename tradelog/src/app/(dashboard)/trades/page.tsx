"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { TradesPage } from "@/components/TradesPage";
import { createApiClient } from "@/lib/apiClient";
import { User } from "@/lib/types";
import { LoadingScreen } from "@/components/LoadingScreen";
import { WalletConnection } from "@/components/WalletConnection";
import { WalletFilterProvider } from "@/app/contexts/WalletFilterContext";

export default function TradesRoutePage() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const getBearerToken = useCallback(async () => (await getAccessToken?.()) || null, [getAccessToken]);
  const api = useMemo(() => createApiClient({ getAccessToken: getBearerToken }), [getBearerToken]);
  const [dbUser, setDbUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!ready) {
        return;
      }

      if (!authenticated) {
        setDbUser(null);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const user = await api.post<User>("/api/users");
        setDbUser(user);
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [api, ready, authenticated]);

  if (!ready) return <LoadingScreen />;
  if (!authenticated) return <WalletConnection />;
  if (isLoading || !dbUser) return <LoadingScreen />;
  return (
    <WalletFilterProvider dbUser={dbUser}>
      <TradesPage dbUser={dbUser} />
    </WalletFilterProvider>
  );
}
