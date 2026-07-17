import InstagramProfile from '../../models/InstagramProfile.js'
import InstagramAnalyticsSnapshot from '../../models/InstagramAnalyticsSnapshot.js'
import InstagramReel from '../../models/InstagramReel.js'
import InstagramComment from '../../models/InstagramComment.js'
import { providerFactory } from './providerFactory.js'
import { cacheService } from './cacheService.js'

const CACHE_TTL_PROFILE = parseInt(process.env.CACHE_TTL_PROFILE || '3600')

export const analyticsService = {
  /**
   * Fetch and sync Profile data
   * @param {string} username 
   * @param {string} workspaceId 
   * @param {boolean} forceSync 
   */
  async getProfile(username, workspaceId, forceSync = false) {
    const cacheKey = `ig:profile:${workspaceId}:${username}`

    if (!forceSync) {
      const cached = await cacheService.get(cacheKey)
      if (cached) {
        console.log(`[AnalyticsService] Returning cached profile for: ${username}`)
        return cached
      }
    }

    const provider = providerFactory.getProvider()
    const providerName = process.env.INSTAGRAM_PROVIDER || 'mock'
    const data = await provider.getProfile(username)

    // Save profile with compound index username + workspaceId
    const profile = await InstagramProfile.findOneAndUpdate(
      { username, workspaceId },
      {
        fullName: data.fullName,
        bio: data.bio,
        profilePic: data.profilePic,
        followers: data.followers,
        following: data.following,
        postsCount: data.postsCount,
        verified: data.verified,
        provider: providerName,
        providerVersion: 'v1',
        syncedAt: new Date(),
        rawPayload: data.rawPayload || {}
      },
      { new: true, upsert: true }
    )

    await cacheService.set(cacheKey, profile, CACHE_TTL_PROFILE)
    return profile
  },

  /**
   * Fetch aggregated analytics and save a snapshot in the DB
   * @param {string} username 
   * @param {string} workspaceId 
   * @param {boolean} forceSync 
   */
  async getAnalytics(username, workspaceId, forceSync = false) {
    const cacheKey = `ig:analytics:${workspaceId}:${username}`

    if (!forceSync) {
      const cached = await cacheService.get(cacheKey)
      if (cached) {
        console.log(`[AnalyticsService] Returning cached analytics metrics for: ${username}`)
        return cached
      }
    }

    const provider = providerFactory.getProvider()
    const providerName = process.env.INSTAGRAM_PROVIDER || 'mock'
    const data = await provider.getAnalytics(username)

    // Create a new snapshot
    const snapshot = await InstagramAnalyticsSnapshot.create({
      username,
      followers: data.followers,
      following: data.following,
      postsCount: data.postsCount,
      averageLikes: data.averageLikes,
      averageComments: data.averageComments,
      averageViews: data.averageViews,
      engagementRate: data.engagementRate,
      snapshotDate: new Date(),
      workspaceId,
      provider: providerName,
      providerVersion: 'v1',
      syncedAt: new Date(),
      rawPayload: data.rawPayload || {}
    })

    await cacheService.set(cacheKey, snapshot, CACHE_TTL_PROFILE)
    return snapshot
  },

  /**
   * Perform a manual sync of all profile, reels, and comments data
   * @param {string} username 
   * @param {string} workspaceId 
   */
  async syncAll(username, workspaceId) {
    console.log(`[AnalyticsService] Syncing all Instagram data for user: ${username} under workspace: ${workspaceId}`)
    
    // 1. Sync profile
    const profile = await this.getProfile(username, workspaceId, true)

    // 2. Sync reels
    const reels = await providerFactory.getProvider().getReels(username)
    const savedReels = []
    for (const item of reels) {
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
          provider: process.env.INSTAGRAM_PROVIDER || 'mock',
          providerVersion: 'v1',
          syncedAt: new Date(),
          rawPayload: item.rawPayload || {}
        },
        { new: true, upsert: true }
      )
      savedReels.push(reel)
    }

    // 3. Sync comments for the top reels (limit to first 3 to reduce API usage).
    //    Comments are OPTIONAL — any failure is logged as a warning and does NOT
    //    abort the sync or set syncStatus="error". Profile, reels, and analytics
    //    always complete regardless of comments outcome.
    const commentWarnings = []
    for (let i = 0; i < Math.min(savedReels.length, 3); i++) {
      const reelDoc = savedReels[i]
      try {
        const comments = await providerFactory.getProvider().getComments(reelDoc.reelId)
        for (const c of comments) {
          let sentiment = c.sentiment || 'neutral'
          const textLower = (c.text || '').toLowerCase()
          if (textLower.includes('best') || textLower.includes('love') || textLower.includes('awesome') || textLower.includes('great') || textLower.includes('genius') || textLower.includes('amazing')) {
            sentiment = 'positive'
          } else if (textLower.includes('fail') || textLower.includes('disagree') || textLower.includes('bad') || textLower.includes('hate')) {
            sentiment = 'negative'
          }

          await InstagramComment.findOneAndUpdate(
            { commentId: c.commentId, workspaceId },
            {
              reelId: reelDoc.reelId,
              text: c.text,
              author: c.author,
              sentiment,
              provider: process.env.INSTAGRAM_PROVIDER || 'mock',
              providerVersion: 'v1',
              syncedAt: new Date(),
              rawPayload: c.rawPayload || {}
            },
            { new: true, upsert: true }
          )
        }
      } catch (commentErr) {
        // Comments are optional — warn and continue; do not fail the sync.
        const warning = `[AnalyticsService] Comments skipped for reel ${reelDoc.reelId} (@${username}): ${commentErr.message}`
        console.warn(warning)
        commentWarnings.push({ reelId: reelDoc.reelId, error: commentErr.message })
      }
    }

    // 4. Update aggregated analytics snapshots
    const snapshot = await this.getAnalytics(username, workspaceId, true)

    // Invalidating cache keys to guarantee fresh loads
    await cacheService.del(`ig:reels:${workspaceId}:${username}`)
    for (const r of savedReels.slice(0, 3)) {
      await cacheService.del(`ig:comments:${workspaceId}:${r.reelId}`)
    }

    return {
      profile,
      reelsCount: savedReels.length,
      snapshot,
      ...(commentWarnings.length > 0 && { commentWarnings }),
    }
  },

  /**
   * Bulk Sync details for multiple usernames at once
   * @param {Array<string>} usernames 
   * @param {string} workspaceId 
   */
  async syncBulk(usernames, workspaceId) {
    console.log(`[AnalyticsService] Bulk syncing accounts: [${usernames.join(', ')}]`)
    const results = []
    for (const username of usernames) {
      try {
        const syncResult = await this.syncAll(username, workspaceId)
        results.push({ username, status: 'success', details: syncResult })
      } catch (err) {
        results.push({ username, status: 'failed', error: err.message })
      }
    }
    return results
  },

  /**
   * Compute Instagram analytics insights from real MongoDB data.
   * 
   * This function NEVER fabricates numbers.
   * Every value is computed from actual stored documents.
   * If data is insufficient, fields return null or empty arrays.
   *
   * @param {string} username 
   * @param {string} workspaceId 
   */
  async generateAIRecommendations(username, workspaceId) {
    console.log(`[AnalyticsService] Computing real analytics for: ${username}`)

    // Fetch real data from MongoDB
    const profile = await InstagramProfile.findOne({ username, workspaceId }).lean()
    const reels = await InstagramReel.find({ username, workspaceId })
      .sort({ views: -1 })
      .limit(10)
      .lean()

    // Fetch ALL comments for this account's reels
    const reelIds = reels.map(r => r.reelId)
    const allComments = reelIds.length
      ? await InstagramComment.find({ reelId: { $in: reelIds }, workspaceId }).lean()
      : []

    // Sentiment breakdown from real comments
    const total = allComments.length
    const positive = allComments.filter(c => c.sentiment === 'positive').length
    const negative = allComments.filter(c => c.sentiment === 'negative').length
    const neutral = total - positive - negative
    const questions = allComments.filter(c => c.category === 'question').length
    const contentRequests = allComments.filter(c => c.category === 'content_request').length

    const sentimentAnalysis = total > 0
      ? {
          summary: `Based on ${total} real comments synced from Instagram.`,
          ratio: {
            positive: parseFloat(((positive / total) * 100).toFixed(1)),
            neutral:  parseFloat(((neutral  / total) * 100).toFixed(1)),
            negative: parseFloat(((negative / total) * 100).toFixed(1)),
          },
          totalComments: total,
          questionCount: questions,
          contentRequestCount: contentRequests,
        }
      : null

    // Top reels by engagement
    const topReels = reels.slice(0, 5).map(r => ({
      reelId: r.reelId,
      caption: (r.caption || '').slice(0, 80),
      views: r.views || 0,
      likes: r.likes || 0,
      comments: r.comments || 0,
      publishDate: r.publishDate,
    }))

    // Profile stats
    const profileStats = profile
      ? {
          followers: profile.followers || 0,
          following: profile.following || 0,
          postsCount: profile.postsCount || 0,
          engagementRate: null, // computed below if possible
        }
      : null

    if (profileStats && reels.length > 0) {
      const totalLikes = reels.reduce((s, r) => s + (r.likes || 0), 0)
      const totalComments = reels.reduce((s, r) => s + (r.comments || 0), 0)
      const avgEngagement = (totalLikes + totalComments) / reels.length
      profileStats.engagementRate = profileStats.followers > 0
        ? parseFloat(((avgEngagement / profileStats.followers) * 100).toFixed(2))
        : null
    }

    return {
      username,
      analysisDate: new Date(),
      dataSource: 'mongodb',
      totalCommentsAnalyzed: total,
      totalReelsAnalyzed: reels.length,
      sentimentAnalysis,
      topReels: topReels.length > 0 ? topReels : null,
      profileStats,
      // These sections require AI provider integration and are not fabricated
      contentGapAnalysis: null,
      competitorAnalysis: null,
      viralPatternDetection: null,
      nextReelRecommendations: [],
    }
  }
}
