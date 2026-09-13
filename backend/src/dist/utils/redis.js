"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCache = exports.writeCache = exports.readCache = exports.getRedis = exports.redis = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
exports.redis = new ioredis_1.default(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
});
let connectAttempted = false;
const getRedis = async () => {
    if (!connectAttempted) {
        connectAttempted = true;
        try {
            await exports.redis.connect();
        }
        catch {
            console.warn('Redis is unavailable; continuing without cache for this request.');
        }
    }
    return exports.redis.status === 'ready' ? exports.redis : null;
};
exports.getRedis = getRedis;
const readCache = async (key) => {
    const client = await (0, exports.getRedis)();
    if (!client)
        return null;
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
};
exports.readCache = readCache;
const writeCache = async (key, value, ttlSeconds = 60) => {
    const client = await (0, exports.getRedis)();
    if (!client)
        return;
    await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
};
exports.writeCache = writeCache;
const deleteCache = async (...keys) => {
    const client = await (0, exports.getRedis)();
    if (!client || keys.length === 0)
        return;
    await client.del(...keys);
};
exports.deleteCache = deleteCache;
