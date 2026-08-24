const expressRateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const Redis = require('ioredis');

let redisClient;

function initRateLimit() {
  if (process.env.REDIS_URL) {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 50, 2000);
      }
    });
    redisClient.on('error', (err) => console.error('Redis Client Error', err));
  }
}

function rateLimit(windowMs = 60000, maxRequests = 60) {
  return expressRateLimit({
    windowMs,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    passOnStoreError: true,
    store: redisClient ? new RedisStore({
      sendCommand: (...args) => {
        if (redisClient.status !== 'ready') return Promise.reject(new Error('Redis not ready'));
        return redisClient.call(...args);
      },
    }) : undefined,
    message: { error: 'Too many requests — please slow down.' }
  });
}

function getRedisClient() {
  return redisClient;
}

module.exports = { initRateLimit, rateLimit, getRedisClient, redisClient };
