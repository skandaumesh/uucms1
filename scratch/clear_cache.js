const { Redis } = require('@upstash/redis');
require('dotenv').config();

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function clearCache(uucmsId) {
  const keys = [
    `uucms:cache:${uucmsId}:profile`,
    `uucms:cache:${uucmsId}:attendance`,
    `uucms:cache:${uucmsId}:results`
  ];
  for (const key of keys) {
    await redis.del(key);
    console.log(`Deleted ${key}`);
  }
}

// User's ID from screenshot is likely their register number/username
// I'll wait for the user to provide it or try to guess it from the logs if available
// Actually, I'll just make the API clear the cache if a certain param is passed
