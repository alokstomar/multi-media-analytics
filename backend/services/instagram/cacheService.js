import { getRedisClient, checkRedisAvailable } from '../../config/redis.js'

// In-memory cache fallback store
const memoryCache = new Map()

export const cacheService = {
  /**
   * Get a value from the cache
   * @param {string} key 
   * @returns {Promise<any>}
   */
  async get(key) {
    const isRedis = checkRedisAvailable()
    if (isRedis) {
      try {
        const client = getRedisClient()
        if (client) {
          const val = await client.get(key)
          return val ? JSON.parse(val) : null
        }
      } catch (err) {
        console.warn(`[Instagram Cache] Redis GET failed for key: ${key}. Error: ${err.message}`)
      }
    }

    // Memory fallback
    const cached = memoryCache.get(key)
    if (!cached) return null

    if (Date.now() > cached.expiresAt) {
      memoryCache.delete(key) // Expired
      return null
    }

    return cached.value
  },

  /**
   * Set a value in the cache with a specific TTL (in seconds)
   * @param {string} key 
   * @param {any} value 
   * @param {number} ttlSeconds 
   */
  async set(key, value, ttlSeconds) {
    const isRedis = checkRedisAvailable()
    const serializedValue = JSON.stringify(value)

    if (isRedis) {
      try {
        const client = getRedisClient()
        if (client) {
          await client.set(key, serializedValue, 'EX', ttlSeconds)
          return
        }
      } catch (err) {
        console.warn(`[Instagram Cache] Redis SET failed for key: ${key}. Error: ${err.message}`)
      }
    }

    // Memory fallback
    const expiresAt = Date.now() + (ttlSeconds * 1000)
    memoryCache.set(key, {
      value,
      expiresAt
    })
  },

  /**
   * Delete a key from the cache
   * @param {string} key 
   */
  async del(key) {
    const isRedis = checkRedisAvailable()
    if (isRedis) {
      try {
        const client = getRedisClient()
        if (client) {
          await client.del(key)
          return
        }
      } catch (err) {
        console.warn(`[Instagram Cache] Redis DEL failed for key: ${key}. Error: ${err.message}`)
      }
    }

    memoryCache.delete(key)
  },

  /**
   * Clear the entire in-memory cache fallback (mostly useful for tests)
   */
  clearMemory() {
    memoryCache.clear()
  }
}
