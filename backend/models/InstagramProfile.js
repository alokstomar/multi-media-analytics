import mongoose from 'mongoose'

const instagramProfileSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true,
  },
  fullName: { type: String, default: '' },
  bio: { type: String, default: '' },
  profilePic: { type: String, default: '' },
  followers: { type: Number, default: 0 },
  following: { type: Number, default: 0 },
  postsCount: { type: Number, default: 0 },
  verified: { type: Boolean, default: false },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true,
  },

  // Account lifecycle (Smart Restore + Instant Add)
  deletedAt: { type: Date, default: null, index: true },
  syncStatus: { type: String, enum: ['syncing', 'ready', 'error'], default: 'ready' },
  syncError: { type: String, default: '' },

  // Framework integration metadata
  provider: { type: String, default: '' },
  providerVersion: { type: String, default: 'v1' },
  syncedAt: { type: Date, default: Date.now },
  rawPayload: { type: mongoose.Schema.Types.Mixed, default: {} },
}, {
  timestamps: true,
})

// Compound index to ensure uniqueness per workspace
instagramProfileSchema.index({ username: 1, workspaceId: 1 }, { unique: true })

// Partial index to back the active-accounts list query efficiently
instagramProfileSchema.index({ workspaceId: 1, deletedAt: 1 }, {
  partialFilterExpression: { deletedAt: null },
})

export default mongoose.model('InstagramProfile', instagramProfileSchema)
