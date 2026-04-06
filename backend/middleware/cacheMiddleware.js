import NodeCache from "node-cache";

// Initialize cache with a default TTL of 60 seconds.
// deleteOnExpire handles automatic cleanup of expired keys.
const cache = new NodeCache({ stdTTL: 60, deleteOnExpire: true });

/**
 * Middleware to cache API responses.
 * Caches routes based on their originalUrl (including query params).
 * @param {number} duration - Time to live in seconds (optional, defaults to 60)
 */
export const cacheData = (duration = 60) => {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== "GET") {
      return next();
    }

    const key = req.originalUrl || req.url;
    const cachedResponse = cache.get(key);

    if (cachedResponse) {
      console.log(`⚡ Serving from Cache: ${key}`);
      return res.json(cachedResponse);
    }

    // Safely hook into res.send (which res.json calls internally)
    const originalSend = res.send;
    res.send = function (body) {
      // Restore original function immediately to avoid infinite loops or context loss
      res.send = originalSend;
      
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          // Express res.send often sends JSON as a string
          const dataToCache = typeof body === "string" ? JSON.parse(body) : body;
          cache.set(key, dataToCache, duration);
        } catch (error) {
          // If not JSON, just cache the raw body
          cache.set(key, body, duration);
        }
      }
      return originalSend.call(this, body);
    };

    next();
  };
};

/**
 * Middleware to clear cache based on a specific prefix.
 * e.g., clearCachePrefix("/api/sales-orders") clears all cached sales orders.
 * @param {string} prefix - The cache key prefix to invalidate
 */
export const clearCachePrefix = (prefix) => {
  return (req, res, next) => {
    // Call next first, so that the route executes its database mutation.
    // We hook into the response finish event to clear the cache.
    res.on("finish", () => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        let keysDeleted = 0;
        const keys = cache.keys();
        for (const key of keys) {
          if (key.startsWith(prefix)) {
            cache.del(key);
            keysDeleted++;
          }
        }
        if (keysDeleted > 0) {
          console.log(`🧹 Cache cleared for prefix: ${prefix} (${keysDeleted} keys)`);
        }
      }
    });
    next();
  };
};

export default { cacheData, clearCachePrefix };
