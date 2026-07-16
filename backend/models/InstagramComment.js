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
  // username of the Instagram account whose post this comment belongs to
  username: {
    type: String,
    default: '',
    index: true,
  },
  text: {
    type: String,
    required: true,
  },
  author: { type: String, default: 'Anonymous' },
  // Number of likes on the comment (if returned by provider)
  likes: { type: Number, default: 0 },
  // Original comment timestamp from Instagram (if returned by provider)
  timestamp: { type: Date, default: null },
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

  // Provider metadata
  provider: { type: String, default: '' },
  providerVersion: { type: String, default: 'v1' },
  syncedAt: { type: Date, default: Date.now },
  rawPayload: { type: mongoose.Schema.Types.Mixed, default: {} },
}, {
  timestamps: true,
})

// Unique comment per workspace
instagramCommentSchema.index({ commentId: 1, workspaceId: 1 }, { unique: true })
// Scope queries by username within a workspace
instagramCommentSchema.index({ workspaceId: 1, username: 1 })
// Scope queries by reelId within a workspace
instagramCommentSchema.index({ workspaceId: 1, reelId: 1 })

export default mongoose.model('InstagramComment', instagramCommentSchema)
