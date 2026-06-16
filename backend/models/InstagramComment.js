import mongoose from 'mongoose'

const instagramCommentSchema = new mongoose.Schema({
  commentId: {
    type: String,
    required: true,
  },
  reelId: {
    type: String,
    required: true,
    index: true,
  },
  text: {
    type: String,
    required: true,
  },
  author: { type: String, default: 'Anonymous' },
  sentiment: { type: String, default: 'neutral', enum: ['positive', 'negative', 'neutral'] },
  category: {
    type: String,
    default: 'neutral',
    enum: ['positive', 'negative', 'question', 'content_request', 'neutral']
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true,
  },

  // Framework integration metadata
  provider: { type: String, default: '' },
  providerVersion: { type: String, default: 'v1' },
  syncedAt: { type: Date, default: Date.now },
  rawPayload: { type: mongoose.Schema.Types.Mixed, default: {} },
}, {
  timestamps: true,
})

// Compound index to ensure uniqueness of a comment per workspace
instagramCommentSchema.index({ commentId: 1, workspaceId: 1 }, { unique: true })

export default mongoose.model('InstagramComment', instagramCommentSchema)
