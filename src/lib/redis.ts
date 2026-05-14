import { createClient } from "redis";

type RedisClient = ReturnType<typeof createClient>;

const globalForRedis = globalThis as unknown as {
  redisClient: RedisClient | undefined;
};

function getClient(): RedisClient {
  if (!globalForRedis.redisClient) {
    globalForRedis.redisClient = createClient({ url: process.env.REDIS_URL });

    globalForRedis.redisClient.on("error", (err) => {
      console.error("[Redis] Client error:", err);
    });
  }
  return globalForRedis.redisClient;
}

async function ensureConnected(): Promise<RedisClient> {
  const client = getClient();
  if (!client.isOpen) {
    await client.connect();
  }
  return client;
}

/**
 * Cache-aside helper. Returns cached data if available, otherwise calls
 * `fetcher`, stores the result in Redis, then returns it.
 * Falls back gracefully to `fetcher` if Redis is unavailable.
 *
 * @param key   Redis cache key
 * @param ttl   Time-to-live in seconds
 * @param fetcher Function that fetches fresh data from the database
 */
export async function withCache<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  try {
    const client = await ensureConnected();
    const cached = await client.get(key);
    if (cached !== null) {
      return JSON.parse(cached) as T;
    }
    const data = await fetcher();
    await client.setEx(key, ttl, JSON.stringify(data));
    return data;
  } catch (err) {
    console.warn("[Redis] Cache miss (falling back to DB):", err);
    return fetcher();
  }
}

/**
 * Delete one or more cache keys. Silent on error so that mutations
 * always succeed even when Redis is unavailable.
 */
export async function invalidateCache(...keys: string[]): Promise<void> {
  try {
    const client = await ensureConnected();
    if (keys.length > 0) {
      await client.del(keys);
    }
  } catch (err) {
    console.warn("[Redis] Failed to invalidate cache:", err);
  }
}

// Cache TTLs (seconds)
export const TTL = {
  /** Reference data that rarely changes – customers, film stocks */
  REFERENCE: 300,
  /** Paginated list queries */
  LIST: 30,
} as const;

// Cache key factories
export const CacheKey = {
  customers: () => "customers",
  filmStocks: () => "film-stocks",
  devNotes: (customerId: string | null, process: string | null, page: number, pageSize: number) =>
    `dev-notes:${customerId ?? "all"}:${process ?? "all"}:${page}:${pageSize}`,
} as const;
