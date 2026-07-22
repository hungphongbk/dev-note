import { createClient } from "redis";

type RedisClient = ReturnType<typeof createClient>;

const REDIS_OPERATION_TIMEOUT_MS = 1500;

const globalForRedis = globalThis as unknown as {
  redisClient: RedisClient | undefined;
  redisWarned: boolean | undefined;
};

function warnOnce(message: string, error: unknown) {
  if (globalForRedis.redisWarned) return;
  globalForRedis.redisWarned = true;
  console.warn(message, error);
}

function timeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out`)), REDIS_OPERATION_TIMEOUT_MS);
    }),
  ]);
}

function getClient(): RedisClient | null {
  if (!process.env.REDIS_URL) {
    return null;
  }

  if (!globalForRedis.redisClient) {
    globalForRedis.redisClient = createClient({
      url: process.env.REDIS_URL,
      socket: {
        connectTimeout: REDIS_OPERATION_TIMEOUT_MS,
        reconnectStrategy: false,
      },
    });

    globalForRedis.redisClient.on("error", (error) => {
      warnOnce("[Redis] Client error, falling back to database:", error);
    });
  }

  return globalForRedis.redisClient;
}

async function ensureConnected(): Promise<RedisClient | null> {
  const client = getClient();
  if (!client) {
    return null;
  }

  if (!client.isOpen) {
    await timeout(client.connect(), "Redis connect");
  }

  return client;
}

export async function withCache<T>(
  key: string,
  ttl: number | null,
  fetcher: () => Promise<T>,
): Promise<T> {
  try {
    const client = await ensureConnected();
    if (!client) {
      return fetcher();
    }

    const cached = await timeout(client.get(key), "Redis get");
    if (cached !== null) {
      return JSON.parse(cached) as T;
    }

    const data = await fetcher();
    const serialized = JSON.stringify(data);
    if (ttl && ttl > 0) {
      await timeout(client.setEx(key, ttl, serialized), "Redis setEx");
    } else {
      await timeout(client.set(key, serialized), "Redis set");
    }
    return data;
  } catch (error) {
    warnOnce("[Redis] Cache unavailable, falling back to database:", error);
    return fetcher();
  }
}

export async function invalidateCache(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  try {
    const client = await ensureConnected();
    if (!client) return;
    await timeout(client.del(keys), "Redis del");
  } catch (error) {
    warnOnce("[Redis] Failed to invalidate cache:", error);
  }
}

export async function getCacheVersion(key: string): Promise<string> {
  try {
    const client = await ensureConnected();
    if (!client) return "db";

    const version = await timeout(client.get(key), "Redis get version");
    if (version) return version;

    await timeout(client.set(key, "1"), "Redis set version");
    return "1";
  } catch (error) {
    warnOnce("[Redis] Failed to read cache version:", error);
    return "db";
  }
}

export async function bumpCacheVersion(key: string): Promise<void> {
  try {
    const client = await ensureConnected();
    if (!client) return;
    await timeout(client.incr(key), "Redis incr version");
  } catch (error) {
    warnOnce("[Redis] Failed to bump cache version:", error);
  }
}

export const TTL = {
  REFERENCE: null,
  LIST: 300,
} as const;

export const CacheVersion = {
  devNotes: () => "dev-notes:version",
  invoices: () => "processing-invoices:version",
} as const;

export const CacheKey = {
  customers: () => "customers",
  filmStocks: () => "film-stocks",
  keepalive: () => "keepalive:ping",
  devNotes: (
    version: string,
    customerId: string | null,
    process: string | null,
    page: number,
    pageSize: number,
  ) => `dev-notes:v${version}:${customerId ?? "all"}:${process ?? "all"}:${page}:${pageSize}`,
  invoices: (
    version: string,
    customerId: string | null,
    page: number,
    pageSize: number,
  ) => `processing-invoices:v${version}:${customerId ?? "all"}:${page}:${pageSize}`,
} as const;
