import mongoose from 'mongoose'

const instagramReelSchema = new mongoose.Schema({
  reelId: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: true,
    index: true,
  },
  caption: { type: String, default: '' },
  views: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  comments: { type: Number, default: 0 },
  publishDate: { type: Date, default: Date.now },
  mediaType: { type: String, default: 'Video' },
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

// Compound index to ensure uniqueness of a Reel per workspace
instagramReelSchema.index({ reelId: 1, workspaceId: 1 }, { unique: true })

export default mongoose.model('InstagramReel', instagramReelSchema)
