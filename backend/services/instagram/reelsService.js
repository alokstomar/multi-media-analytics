import InstagramReel from '../../models/InstagramReel.js'
import { providerFactory } from './providerFactory.js'
import { cacheService } from './cacheService.js'

const CACHE_TTL = parseInt(process.env.CACHE_TTL_REELS || '1800')

export const reelsService = {
  /**
   * Sync and fetch Reels for a given username.
   * Uses MongoDB-first caching when Redis is unavailable to prevent timeouts.
   *
   * @param {string} username 
   * @param {string} workspaceId 
   * @param {boolean} forceSync 
   * @returns {Promise<Array>}
   */
  async getReels(username, workspaceId, forceSync = false) {
    const cacheKey = `ig:reels:${workspaceId}:${username}`
    
    // ── Step 1: Check Redis cache first ────────────────────────────
    if (!forceSync) {
      const cached = await cacheService.get(cacheKey)
      if (cached) {
        console.log(`[ReelsService] Returning cached Reels list for ${username}`)
        return cached
      }
    }

    // ── Step 2: Serve from MongoDB if not forceSyncing and records exist ──
    if (!forceSync) {
      const existing = await InstagramReel.find({ username, workspaceId })
        .sort({ publishDate: -1 })
        .lean()
      if (existing.length > 0) {
        console.log(`[ReelsService] Returning ${existing.length} reels from MongoDB for ${username}`)
        return existing
      }
    }

    // ── Step 3: Fetch from provider ────────────────────────────────
    console.log(`[ReelsService] Fetching real Reels from provider for: ${username}`)
    const provider = providerFactory.getProvider()
    const providerName = process.env.INSTAGRAM_PROVIDER || 'mock'
    
    let reelsData = []
    try {
      reelsData = await provider.getReels(username)
    } catch (err) {
      console.warn(`[ReelsService] Provider error for ${username}: ${err.message}`)
      // Fallback to existing MongoDB data on failure so the page doesn't break
      const fallback = await InstagramReel.find({ username, workspaceId })
        .sort({ publishDate: -1 })
        .lean()
      return fallback
    }

    // Save/upsert reels in the DB under workspaceId isolation
    const savedReels = []
    for (const item of reelsData) {
      const reel = await InstagramReel.findOneAndUpdate(
        { reelId: item.reelId, workspaceId },
        {
          username,
          caption: item.caption,
          views: item.views,
          likes: item.likes,
          comments: item.comments,
          publishDate: item.publishDate,
          mediaType: item.mediaType || 'Video',
          provider: providerName,
          providerVersion: 'v1',
          syncedAt: new Date(),
          rawPayload: item.rawPayload || {}
        },
        { new: true, upsert: true }
      )
      savedReels.push(reel)
    }

    // Cache the resulting Reels list in Redis
    await cacheService.set(cacheKey, savedReels, CACHE_TTL)

    return savedReels
  }
}

