import { Redis } from "ioredis";
import { logger } from "./logger.js";

export interface CacheClient {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSec: number): Promise<void>;
  quit(): Promise<void>;
}

class RedisCache implements CacheClient {
  constructor(private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    if (raw === null) {
      logger.debug({ msg: "cache miss", key });
      return null;
    }
    logger.debug({ msg: "cache hit", key });
    return JSON.parse(raw) as T;
  }

  async set(key: string, value: unknown, ttlSec: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), "EX", ttlSec);
  }

  async quit(): Promise<void> {
    await this.redis.quit();
  }
}

class NoOpCache implements CacheClient {
  async get<T>(_key: string): Promise<T | null> {
    return null;
  }
  async set(_key: string, _value: unknown, _ttlSec: number): Promise<void> {}
  async quit(): Promise<void> {}
}

export function createCache(redisUrl?: string): CacheClient {
  if (!redisUrl) return new NoOpCache();
  const redis = new Redis(redisUrl, { lazyConnect: true, enableReadyCheck: false });
  return new RedisCache(redis);
}

export async function withCache<T>(
  cache: CacheClient,
  key: string,
  ttlSec: number,
  fn: () => Promise<T>,
): Promise<T> {
  const cached = await cache.get<T>(key);
  if (cached !== null) return cached;
  const result = await fn();
  await cache.set(key, result, ttlSec);
  return result;
}
