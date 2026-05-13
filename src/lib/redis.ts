import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  connectTimeout: 10000,
});

redis.on('error', (err) => console.error('Redis connection error:', err));
redis.on('connect', () => console.log('Successfully connected to Redis'));

export default redis;
