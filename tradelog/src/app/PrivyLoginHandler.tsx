'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function PrivyLoginHandler({ children }: { children: React.ReactNode }) {
  const { authenticated } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (authenticated) {
      router.push('/dashboard');
    }
  }, [authenticated, router]);

  return <>{children}</>;
} 