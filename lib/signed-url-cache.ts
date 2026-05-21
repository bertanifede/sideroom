/**
 * In-memory cache of Supabase signed URLs, keyed by `partyId:trackPosition`.
 * Lives only in server memory; never reaches the client. Shared across warm
 * serverless invocations of the same instance.
 */

interface SignedUrlEntry {
  url: string;
  expiresAt: number;
}

// Signed URLs are minted with 60s validity; cache for 50s to leave margin.
const TTL_MS = 50_000;

const cache = new Map<string, SignedUrlEntry>();

/** Returns a cached signed URL if present and unexpired, else null. */
export function getCachedSignedUrl(key: string, now: number = Date.now()): string | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    cache.delete(key);
    return null;
  }
  return entry.url;
}

/** Stores a signed URL with a TTL shorter than its real validity window. */
export function setCachedSignedUrl(key: string, url: string, now: number = Date.now()): void {
  cache.set(key, { url, expiresAt: now + TTL_MS });
}

/** Test-only: clears all cached entries. */
export function __clearSignedUrlCache(): void {
  cache.clear();
}
