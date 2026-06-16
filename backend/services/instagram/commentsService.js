import InstagramComment from '../../models/InstagramComment.js'
import { providerFactory } from './providerFactory.js'
import { cacheService } from './cacheService.js'

const CACHE_TTL = parseInt(process.env.CACHE_TTL_COMMENTS || '1800')

export const commentsService = {
  /**
   * Sync and fetch comments for a specific Reel ID
   * @param {string} reelId 
   * @param {string} workspaceId 
   * @param {boolean} forceSync 
   * @returns {Promise<Array>}
   */
  async getComments(reelId, workspaceId, forceSync = false) {
    const cacheKey = `ig:comments:${workspaceId}:${reelId}`

    if (!forceSync) {
      const cached = await cacheService.get(cacheKey)
      if (cached) {
        console.log(`[CommentsService] Returning cached comments for Reel ${reelId}`)
        return cached
      }
    }

    const provider = providerFactory.getProvider()
    const providerName = process.env.INSTAGRAM_PROVIDER || 'mock'
    const commentsData = await provider.getComments(reelId)

    // Save/upsert comments in database
    const savedComments = []
    for (const item of commentsData) {
      // Basic sentiment and category detection helper (stub)
      let sentiment = item.sentiment || 'neutral'
      let category = 'neutral'
      
      const textLower = (item.text || '').toLowerCase()
      
      if (textLower.includes('?') || textLower.startsWith('how') || textLower.startsWith('why') || textLower.startsWith('what') || textLower.startsWith('where') || textLower.startsWith('can you') || textLower.startsWith('is there')) {
        category = 'question'
      } else if (textLower.includes('link') || textLower.includes('share') || textLower.includes('github') || textLower.includes('repo') || textLower.includes('code') || textLower.includes('source') || textLower.includes('tutorial') || textLower.includes('download')) {
        category = 'content_request'
      } else if (textLower.includes('best') || textLower.includes('love') || textLower.includes('awesome') || textLower.includes('great') || textLower.includes('genius') || textLower.includes('amazing') || textLower.includes('🔥') || textLower.includes('🚀')) {
        sentiment = 'positive'
        category = 'positive'
      } else if (textLower.includes('fail') || textLower.includes('disagree') || textLower.includes('bad') || textLower.includes('hate') || textLower.includes('trap') || textLower.includes('generic') || textLower.includes('useless') || textLower.includes('poor')) {
        sentiment = 'negative'
        category = 'negative'
      }

      const comment = await InstagramComment.findOneAndUpdate(
        { commentId: item.commentId, workspaceId },
        {
          reelId,
          text: item.text,
          author: item.author,
          sentiment,
          category,
          provider: providerName,
          providerVersion: 'v1',
          syncedAt: new Date(),
          rawPayload: item.rawPayload || {}
        },
        { new: true, upsert: true }
      )
      savedComments.push(comment)
    }

    // Cache results
    await cacheService.set(cacheKey, savedComments, CACHE_TTL)

    return savedComments
  }
}
