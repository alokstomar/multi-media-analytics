import Redis from 'ioredis'
import dotenv from 'dotenv'

dotenv.config()

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
let redisClient = null
let isRedisAvailable = false
let isRedisConnecting = true

export function getRedisClient() {
  if (redisClient) return redisClient

  try {
    console.log(`[Redis] Initializing connection to ${REDIS_URL}...`)
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null, // REQUIRED by BullMQ
      enableReadyCheck: false,
      connectTimeout: 3000,
      retryStrategy(times) {
        if (times > 3) {
          console.warn('[Redis] Connection attempts exceeded. Operating in fallback/MongoDB mode.')
          isRedisAvailable = false
          isRedisConnecting = false
          return null // Stop retrying connection
        }
        return Math.min(times * 200, 2000)
      }
    })

    redisClient.on('connect', () => {
      console.log('[Redis] Connected to Redis server successfully.')
      isRedisAvailable = true
      isRedisConnecting = false
    })

    redisClient.on('error', (err) => {
      console.warn(`[Redis] Connection error: ${err.message}`)
      isRedisAvailable = false
    })
  } catch (err) {
    console.error(`[Redis] Error initializing Redis client: ${err.message}`)
    isRedisAvailable = false
    isRedisConnecting = false
  }

  return redisClient
}

// Immediately trigger initialization attempt if not on Vercel
if (!process.env.VERCEL) {
  getRedisClient()
}

export function checkRedisAvailable() {
  return isRedisAvailable
}
