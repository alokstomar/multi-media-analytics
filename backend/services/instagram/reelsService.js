import InstagramReel from '../../models/InstagramReel.js'
import { providerFactory } from './providerFactory.js'
import { cacheService } from './cacheService.js'

const CACHE_TTL = parseInt(process.env.CACHE_TTL_REELS || '1800')

export const reelsService = {
  /**
   * Sync and fetch Reels for a given username
   * @param {string} username 
   * @param {string} workspaceId 
   * @param {boolean} forceSync 
   * @returns {Promise<Array>}
   */
  async getReels(username, workspaceId, forceSync = false) {
    const cacheKey = `ig:reels:${workspaceId}:${username}`
    
    if (!forceSync) {
      const cached = await cacheService.get(cacheKey)
      if (cached) {
        console.log(`[ReelsService] Returning cached Reels list for ${username}`)
        return cached
      }
    }

    const provider = providerFactory.getProvider()
    const providerName = process.env.INSTAGRAM_PROVIDER || 'mock'
    const reelsData = await provider.getReels(username)

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

    // Cache the resulting Reels list
    await cacheService.set(cacheKey, savedReels, CACHE_TTL)

    return savedReels
  }
}
