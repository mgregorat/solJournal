import { getCacheWithMeta, setCache } from "@/lib/cache";

type CachedFetchOptions<T> = {
  key: string;
  fetcher: () => Promise<T>;
  ttlMs?: number;
  onUpdate?: (freshData: T) => void;
  revalidateOnHit?: boolean;
  force?: boolean;
  isEqual?: (previous: T, next: T) => boolean;
};

const inFlightRefreshes = new Map<string, Promise<unknown>>();
const inFlightFetches = new Map<string, Promise<unknown>>();

function defaultIsEqual<T>(previous: T, next: T): boolean {
  try {
    return JSON.stringify(previous) === JSON.stringify(next);
  } catch {
    return Object.is(previous, next);
  }
}

function refreshInBackground<T>(options: CachedFetchOptions<T>): void {
  const { key, fetcher, ttlMs = 30_000, onUpdate, isEqual = defaultIsEqual } = options;
  if (inFlightRefreshes.has(key)) {
    return;
  }

  const refreshPromise = (async () => {
    try {
      const cached = getCacheWithMeta<T>(key);
      const fresh = await fetcher();
      const isSame = cached ? isEqual(cached.data, fresh) : false;
      if (!isSame) {
        setCache(key, fresh, ttlMs);
        onUpdate?.(fresh);
      }
    } catch (error) {
      console.error(`Background refresh failed for cache key "${key}":`, error);
    } finally {
      inFlightRefreshes.delete(key);
    }
  })();

  inFlightRefreshes.set(key, refreshPromise);
}

export async function cachedFetch<T>(options: CachedFetchOptions<T>): Promise<T> {
  const {
    key,
    fetcher,
    ttlMs = 30_000,
    revalidateOnHit = true,
    force = false,
    onUpdate,
    isEqual = defaultIsEqual,
  } = options;
  const cached = getCacheWithMeta<T>(key);

  if (!force && cached !== null) {
    if (revalidateOnHit) {
      refreshInBackground(options);
    }
    return cached.data;
  }

  if (!force && inFlightFetches.has(key)) {
    return inFlightFetches.get(key) as Promise<T>;
  }

  const fetchPromise = (async () => {
    const fresh = await fetcher();
    if (cached && isEqual(cached.data, fresh)) {
      return cached.data;
    }
    setCache(key, fresh, ttlMs);
    onUpdate?.(fresh);
    return fresh;
  })();

  inFlightFetches.set(key, fetchPromise);
  try {
    return await fetchPromise;
  } finally {
    inFlightFetches.delete(key);
  }
}
