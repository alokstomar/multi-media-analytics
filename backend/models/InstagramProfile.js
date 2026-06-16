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

export default mongoose.model('InstagramProfile', instagramProfileSchema)
