import { getCacheWithMeta, setCache } from "@/lib/cache";

type CachedFetchOptions<T> = {
  key: string;
  fetcher: () => Promise<T>;
  ttlMs?: number;
  onUpdate?: (freshData: T) => void;
};

const inFlightRefreshes = new Map<string, Promise<unknown>>();

function refreshInBackground<T>(options: CachedFetchOptions<T>): void {
  const { key, fetcher, ttlMs = 30_000, onUpdate } = options;
  if (inFlightRefreshes.has(key)) {
    return;
  }

  const refreshPromise = (async () => {
    try {
      const fresh = await fetcher();
      setCache(key, fresh, ttlMs);
      onUpdate?.(fresh);
    } catch (error) {
      console.error(`Background refresh failed for cache key "${key}":`, error);
    } finally {
      inFlightRefreshes.delete(key);
    }
  })();

  inFlightRefreshes.set(key, refreshPromise);
}

export async function cachedFetch<T>(options: CachedFetchOptions<T>): Promise<T> {
  const { key, fetcher, ttlMs = 30_000 } = options;
  const cached = getCacheWithMeta<T>(key);

  if (cached !== null) {
    refreshInBackground(options);
    return cached.data;
  }

  const fresh = await fetcher();
  setCache(key, fresh, ttlMs);
  return fresh;
}
