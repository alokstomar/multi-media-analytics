import InstagramComment from '../../models/InstagramComment.js'
import InstagramReel from '../../models/InstagramReel.js'
import { providerFactory } from './providerFactory.js'

const PROVIDER_NAME = () => process.env.INSTAGRAM_PROVIDER || 'rapidapi'

/**
 * Classify comment text into sentiment + category.
 * Applied to every real comment fetched from RapidAPI.
 */
export function classifyComment(text) {
  const t = (text || '').toLowerCase()
  let sentiment = 'neutral'
  let category = 'neutral'

  if (
    t.includes('?') || t.startsWith('how') || t.startsWith('why') ||
    t.startsWith('what') || t.startsWith('where') || t.startsWith('can you') ||
    t.startsWith('is there')
  ) {
    category = 'question'
  } else if (
    t.includes('link') || t.includes('share') || t.includes('github') ||
    t.includes('repo') || t.includes('code') || t.includes('source') ||
    t.includes('tutorial') || t.includes('download')
  ) {
    category = 'content_request'
  } else if (
    t.includes('best') || t.includes('love') || t.includes('awesome') ||
    t.includes('great') || t.includes('genius') || t.includes('amazing') ||
    t.includes('🔥') || t.includes('🚀')
  ) {
    sentiment = 'positive'
    category = 'positive'
  } else if (
    t.includes('fail') || t.includes('disagree') || t.includes('bad') ||
    t.includes('hate') || t.includes('trap') || t.includes('generic') ||
    t.includes('useless') || t.includes('poor')
  ) {
    sentiment = 'negative'
    category = 'negative'
  }

  return { sentiment, category }
}

export const commentsService = {
  /**
   * MongoDB-first comment fetch. Production pipeline:
   *
   * 1. If forceSync=false AND MongoDB has comments → return them immediately.
   *    RapidAPI is NOT called. Page refreshes are served from DB.
   * 2. If forceSync=true OR no comments in DB → call provider (RapidAPI).
   * 3. Upsert every fetched comment into MongoDB.
   * 4. If provider returns [] (no comments / unsupported endpoint) → return DB.
   * 5. If provider throws → return whatever is in DB (may be []).
   *
   * This ensures:
   *  - RapidAPI quota is used efficiently (not on every page load)
   *  - Redis / cache availability is NOT required
   *  - No fake/mock data is ever produced
   *
   * @param {string} reelId
   * @param {string} workspaceId
   * @param {boolean} forceSync  true = re-fetch from provider even if DB has data
   */
  async getComments(reelId, workspaceId, forceSync = false) {
    let targetReelId = reelId
    if (reelId && String(reelId).includes('_')) {
      const reelDoc = await InstagramReel.findOne({ reelId, workspaceId }).lean().catch(() => null)
      const code = reelDoc?.rawPayload?.media?.code || reelDoc?.rawPayload?.code
      if (code) {
        targetReelId = code
      }
    }

    const reelIdsToMatch = Array.from(new Set([reelId, targetReelId].filter(Boolean)))

    // ── Step 1: Serve from MongoDB unless force-syncing ────────────
    if (!forceSync) {
      const existing = await InstagramComment.find({ reelId: { $in: reelIdsToMatch }, workspaceId })
        .sort({ syncedAt: -1 })
        .lean()

      if (existing.length > 0) {
        console.log(`[CommentsService] Returning ${existing.length} MongoDB comments for reel ${targetReelId}`)
        return existing
      }
    }

    // ── Step 2: Call provider (RapidAPI) ───────────────────────────
    const provider = providerFactory.getProvider()
    const providerName = PROVIDER_NAME()

    // Short-circuit: some RapidAPI hosts (e.g. instagram120) do not expose
    // a comments endpoint at all. Skip the doomed call and serve whatever
    // MongoDB has. The provider's getComments() would throw a typed
    // COMMENTS_NOT_SUPPORTED error — checking supportsComments() here
    // avoids the throw and the noise.
    if (typeof provider.supportsComments === 'function' && !provider.supportsComments()) {
      console.log(`[CommentsService] Provider does not support comments — serving MongoDB only for reel ${targetReelId}`)
      const existing = await InstagramComment.find({ reelId: { $in: reelIdsToMatch }, workspaceId })
        .sort({ syncedAt: -1 })
        .lean()
      return existing
    }

    console.log(`[CommentsService] Fetching real comments from provider for reel ${targetReelId}`)

    let commentsData = []
    try {
      commentsData = await provider.getComments(targetReelId)
    } catch (err) {
      console.warn(`[CommentsService] Provider error for reel ${targetReelId}: ${err.message}`)
      // Provider failed — return whatever MongoDB has (never fabricate)
      const fallback = await InstagramComment.find({ reelId: { $in: reelIdsToMatch }, workspaceId })
        .sort({ syncedAt: -1 })
        .lean()
      console.log(`[CommentsService] Fallback: returning ${fallback.length} MongoDB comments after provider error`)
      return fallback
    }

    if (!commentsData.length) {
      console.log(`[CommentsService] Provider returned 0 comments for reel ${targetReelId} — serving existing DB data`)
      const fallback = await InstagramComment.find({ reelId: { $in: reelIdsToMatch }, workspaceId })
        .sort({ syncedAt: -1 })
        .lean()
      return fallback
    }

    // ── Step 3: Upsert real comments into MongoDB ──────────────────
    const savedComments = []
    for (const item of commentsData) {
      const { sentiment, category } = classifyComment(item.text)

      try {
        const comment = await InstagramComment.findOneAndUpdate(
          { commentId: item.commentId, workspaceId },
          {
            reelId: targetReelId,
            text: item.text,
            author: item.author,
            sentiment: item.sentiment || sentiment,
            category,
            provider: providerName,
            providerVersion: 'v1',
            syncedAt: new Date(),
            rawPayload: item.rawPayload || {},
          },
          { new: true, upsert: true }
        )
        savedComments.push(comment)
      } catch (upsertErr) {
        console.warn(`[CommentsService] Upsert skipped for comment ${item.commentId}: ${upsertErr.message}`)
      }
    }

    console.log(`[CommentsService] Synced ${savedComments.length} real comments to MongoDB for reel ${targetReelId}`)
    return savedComments
  },
}
