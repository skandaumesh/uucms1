const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: 'https://integral-termite-122044.upstash.io',
  token: 'gQAAAAAAAdy8AAIgcDEzNThiYWYwNDQ2OTY0NjM0YTBmMWIwZGZjMmM0NjAyOQ',
});

async function clearAllProfileCaches() {
  console.log("Scanning for profile cache keys...");
  try {
    const keys = await redis.keys('uucms:cache:*:profile');
    console.log(`Found ${keys.length} profile cache keys.`);
    
    if (keys.length > 0) {
      const deleted = await redis.del(...keys);
      console.log(`Deleted ${deleted} cache keys.`);
    } else {
      console.log("No profile caches found to clear.");
    }
  } catch (e) {
    console.error("Redis Error:", e);
  }
}

clearAllProfileCaches().catch(console.error);
