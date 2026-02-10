type CacheEntry<T> = {
  data: T;
  timestamp: number;
  ttlMs: number;
};

const memoryCache = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL_MS = 30_000;
const STORAGE_PREFIX = "tradelog:cache:";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function storageKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

function isEntryStale(entry: CacheEntry<unknown>): boolean {
  return Date.now() - entry.timestamp > entry.ttlMs;
}

function persistToLocalStorage<T>(key: string, entry: CacheEntry<T>): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(storageKey(key), JSON.stringify(entry));
  } catch {
    // ignore localStorage failures and keep memory cache functional
  }
}

function removeFromLocalStorage(key: string): void {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(storageKey(key));
  } catch {
    // ignore
  }
}

function readFromLocalStorage<T>(key: string): CacheEntry<T> | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.timestamp !== "number" ||
      typeof parsed.ttlMs !== "number" ||
      !("data" in parsed)
    ) {
      removeFromLocalStorage(key);
      return null;
    }
    return parsed;
  } catch {
    removeFromLocalStorage(key);
    return null;
  }
}

export function setCache<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
    ttlMs,
  };

  memoryCache.set(key, entry);
  persistToLocalStorage(key, entry);
}

function getCacheEntry<T>(key: string, allowStale = false): CacheEntry<T> | null {
  const memoryEntry = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (memoryEntry) {
    if (!allowStale && isEntryStale(memoryEntry)) {
      memoryCache.delete(key);
      removeFromLocalStorage(key);
      return null;
    }
    return memoryEntry;
  }

  const localEntry = readFromLocalStorage<T>(key);
  if (!localEntry) return null;

  if (!allowStale && isEntryStale(localEntry)) {
    removeFromLocalStorage(key);
    return null;
  }

  memoryCache.set(key, localEntry);
  return localEntry;
}

export function getCache<T>(key: string): T | null {
  const entry = getCacheEntry<T>(key, false);
  return entry ? entry.data : null;
}

export function getCacheWithMeta<T>(key: string): { data: T; isStale: boolean } | null {
  const entry = getCacheEntry<T>(key, true);
  if (!entry) return null;
  return {
    data: entry.data,
    isStale: isEntryStale(entry),
  };
}

export function invalidateCache(prefix?: string): void {
  if (!prefix) {
    memoryCache.clear();
    if (isBrowser()) {
      try {
        Object.keys(localStorage)
          .filter((k) => k.startsWith(STORAGE_PREFIX))
          .forEach((k) => localStorage.removeItem(k));
      } catch {
        // ignore
      }
    }
    return;
  }

  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key);
    }
  }

  if (isBrowser()) {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(`${STORAGE_PREFIX}${prefix}`))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      // ignore
    }
  }
}

export function clearCache(): void {
  invalidateCache();
}
