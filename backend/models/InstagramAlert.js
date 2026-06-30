import mongoose from 'mongoose'

/**
 * InstagramAlert — isolated alerts subsystem for Instagram accounts.
 *
 * Detection engine writes here; frontend reads via /api/instagram/alerts.
 * Indexes target the hot read path: list-by-workspace (newest-first) and
 * unread counts. The (workspaceId, accountId, createdAt) tuple is also used
 * by the engine's dedupe window queries.
 */
const instagramAlertSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    accountId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    // FOLLOWER_DROP | FOLLOWER_SPIKE | ENGAGEMENT_DROP | ENGAGEMENT_SPIKE |
    // VIRAL_REEL | NEGATIVE_SENTIMENT_SURGE | POSTING_INACTIVITY | MILESTONE_REACHED
    type: {
      type: String,
      required: true,
    },
    // critical | warning | info
    severity: {
      type: String,
      required: true,
      enum: ['critical', 'warning', 'info'],
      default: 'info',
    },

    title: { type: String, required: true },
    message: { type: String, default: '' },

    // Engine-written free-form context (delta %, milestone level, reel id,
    // signature for dedupe, etc.). `metadata.signature` is the dedupe key.
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
)

// Hot read paths: list-by-workspace newest-first, and per-account queries.
instagramAlertSchema.index({ workspaceId: 1, createdAt: -1 })
instagramAlertSchema.index({ workspaceId: 1, accountId: 1, createdAt: -1 })

export default mongoose.model('InstagramAlert', instagramAlertSchema)
