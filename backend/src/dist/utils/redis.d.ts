import Redis from 'ioredis';
export declare const redis: Redis<"legacy">;
export declare const getRedis: () => Promise<Redis<"legacy"> | null>;
export declare const readCache: <T>(key: string) => Promise<T | null>;
export declare const writeCache: (key: string, value: unknown, ttlSeconds?: number) => Promise<void>;
export declare const deleteCache: (...keys: string[]) => Promise<void>;
//# sourceMappingURL=redis.d.ts.map