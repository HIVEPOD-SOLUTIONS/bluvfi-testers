import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
});

let connectAttempted = false;

export const getRedis = async () => {
  if (!connectAttempted) {
    connectAttempted = true;
    try {
      await redis.connect();
    } catch {
      console.warn('Redis is unavailable; continuing without cache for this request.');
    }
  }

  return redis.status === 'ready' ? redis : null;
};

export const readCache = async <T>(key: string): Promise<T | null> => {
  const client = await getRedis();
  if (!client) return null;

  const value = await client.get(key);
  return value ? (JSON.parse(value) as T) : null;
};

export const writeCache = async (key: string, value: unknown, ttlSeconds = 60) => {
  const client = await getRedis();
  if (!client) return;

  await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
};

export const deleteCache = async (...keys: string[]) => {
  const client = await getRedis();
  if (!client || keys.length === 0) return;

  await client.del(...keys);
};
