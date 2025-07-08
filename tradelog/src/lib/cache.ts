// Simple in-memory cache with TTL
const cache = new Map<string, { value: any; expiry: number }>();

const DEFAULT_TTL = 60 * 5; // 5 minutes in seconds

export function setCache<T>(key: string, value: T, ttl: number = DEFAULT_TTL) {
  const expiry = Date.now() + ttl * 1000;
  cache.set(key, { value, expiry });
}

export function getCache<T>(key: string): T | null {
  const item = cache.get(key);
  if (!item) {
    return null;
  }
  if (Date.now() > item.expiry) {
    cache.delete(key);
    return null;
  }
  return item.value as T;
}

export function clearCache() {
  cache.clear();
}
