import mongoose from 'mongoose'

const twitterAccountSchema = new mongoose.Schema({
  twitterUserId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  username: {
    type: String,
    required: true,
    trim: true,
  },
  displayName: { type: String, default: '' },
  profileImage: { type: String, default: '' },
  
  // Encrypted tokens, server-side only (select: false ensures they aren't returned in queries by default)
  accessToken: {
    type: String,
    required: true,
    select: false,
  },
  refreshToken: {
    type: String,
    select: false,
  },
  tokenExpiresAt: { type: Date },

  provider: {
    type: String,
    default: 'twitter',
    required: true,
  },
  scopes: [{
    type: String,
  }],
  lastTokenRefreshAt: {
    type: Date,
  },
  connectionStatus: {
    type: String,
    enum: ['connected', 'expired', 'disconnected'],
    default: 'connected',
    required: true,
  },

  isActive: {
    type: Boolean,
    default: true,
  },
  connectedAt: {
    type: Date,
    default: Date.now,
  },
  lastSyncedAt: {
    type: Date,
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
  },
}, {
  timestamps: true,
})

twitterAccountSchema.index({ workspaceId: 1 })

export default mongoose.model('TwitterAccount', twitterAccountSchema)
