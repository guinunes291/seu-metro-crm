import IORedis from "ioredis";
import { ENV } from "./env.js";

let redis: IORedis | null = null;
const memoryCache = new Map<string, { value: string; expiresAt: number }>();

function getRedis(): IORedis | null {
  if (!redis && ENV.REDIS_URL) {
    try {
      redis = new IORedis(ENV.REDIS_URL, {
        maxRetriesPerRequest: 3,
        connectTimeout: 5000,
        lazyConnect: true,
      });
      redis.on("error", (err) => {
        console.warn("[Cache] Redis error:", err.message);
        redis = null;
      });
    } catch {
      redis = null;
    }
  }
  return redis;
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
  const serialized = JSON.stringify(value);
  const r = getRedis();
  if (r) {
    try {
      await r.setex(key, ttlSeconds, serialized);
      return;
    } catch {
      // fallback to memory
    }
  }
  memoryCache.set(key, { value: serialized, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const r = getRedis();
  if (r) {
    try {
      const val = await r.get(key);
      return val ? JSON.parse(val) as T : null;
    } catch {
      // fallback to memory
    }
  }
  const cached = memoryCache.get(key);
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return JSON.parse(cached.value) as T;
}

export async function cacheDel(key: string): Promise<void> {
  const r = getRedis();
  if (r) {
    try {
      await r.del(key);
    } catch {
      // ignore
    }
  }
  memoryCache.delete(key);
}
