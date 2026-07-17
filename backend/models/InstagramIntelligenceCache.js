import mongoose from 'mongoose'

/**
 * InstagramIntelligenceCache — workspace + account-scoped cache for the IG
 * AI intelligence features (recommendations / best-times / growth /
 * competitors / hashtags / content-ideas).
 *
 * Why a separate model (vs. reusing IntelligenceCache):
 *   - IntelligenceCache has a uniform 6h TTL (expireAfterSeconds: 21600),
 *     which would cap our 24h / 7d windows. We need per-feature TTLs.
 *   - Per-record `expiresAt` + `expireAfterSeconds: 0` lets each feature
 *     type set its own lifetime, and MongoDB auto-evicts at the right
 *     instant. The read path still re-checks `expiresAt` so a clock skew
 *     or a delayed eviction can't serve stale data.
 *   - Mirrors the isolation pattern established by InstagramAlert (Phase 8).
 */
const instagramIntelligenceCacheSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true,
  },
  accountId: { type: String, required: true, index: true },
  type: {
    type: String,
    required: true,
    enum: [
      'recommendations',
      'best-times',
      'growth-opportunities',
      'competitors',
      'hashtags',
      'content-ideas',
      'comments-summary',
      'portfolio-insights',
    ],
  },
  // For GET endpoints this is always '' (the cache is keyed only by
  // workspace+account+type). For POST /content-ideas we hash the user input
  // so different prompts get independent cache slots.
  inputHash: { type: String, default: '', required: true },

  result: { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
})

// One fresh record per (workspace, account, type, inputHash).
instagramIntelligenceCacheSchema.index(
  { workspaceId: 1, accountId: 1, type: 1, inputHash: 1 },
  { unique: true }
)

// TTL index — documents expire at their own `expiresAt` moment.
instagramIntelligenceCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

/**
 * Read a still-fresh record. The `$gt: now` guard is belt-and-braces: the
 * TTL thread may lag, so we still check expiry at read time.
 */
instagramIntelligenceCacheSchema.statics.findFresh = function ({
  workspaceId,
  accountId,
  type,
  inputHash = '',
}) {
  return this.findOne({
    workspaceId,
    accountId,
    type,
    inputHash,
    expiresAt: { $gt: new Date() },
  }).lean()
}

/**
 * Upsert a cache record. ttlMs is the per-feature lifetime in milliseconds;
 * we convert to an absolute `expiresAt` for the TTL index.
 */
instagramIntelligenceCacheSchema.statics.upsert = function ({
  workspaceId,
  accountId,
  type,
  inputHash = '',
  result,
  ttlMs,
}) {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + ttlMs)
  return this.findOneAndUpdate(
    { workspaceId, accountId, type, inputHash },
    { result, createdAt: now, expiresAt },
    { upsert: true, new: true }
  )
}

export default mongoose.model(
  'InstagramIntelligenceCache',
  instagramIntelligenceCacheSchema
)
