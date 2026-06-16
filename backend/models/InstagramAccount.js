import mongoose from 'mongoose'

/**
 * InstagramAccount — stores connected Instagram accounts.
 * Extended to support Meta Graph API OAuth integration and analytics.
 */
const instagramAccountSchema = new mongoose.Schema({
  userId: {
    type: String,
    default: '',
  },
  instagramUserId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  accountId: {
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
  bio: { type: String, default: '' },
  platform: { type: String, default: 'instagram', enum: ['instagram'], required: true },

  // OAuth fields
  scopes: [{
    type: String,
  }],
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
  lastTokenRefreshAt: { type: Date },
  connectionStatus: {
    type: String,
    enum: ['active', 'expired', 'revoked', 'error'],
    default: 'active',
    required: true,
  },
  canPublish: {
    type: Boolean,
    default: true,
    required: true,
  },

  // Public profile stats (refreshed periodically)
  followers: { type: Number, default: 0 },
  following: { type: Number, default: 0 },
  postsCount: { type: Number, default: 0 },
  isVerified: { type: Boolean, default: false },
  category: { type: String, default: 'General' },

  // Last time analytics were synced
  lastSyncedAt: { type: Date },
  connectedAt: { type: Date, default: Date.now },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
  },
}, {
  timestamps: true,
})

instagramAccountSchema.index({ workspaceId: 1 })

instagramAccountSchema.statics.buildIdentifierQuery = function(id, workspaceId) {
  const query = mongoose.Types.ObjectId.isValid(id)
    ? {
        $or: [
          { _id: new mongoose.Types.ObjectId(id) },
          { accountId: id }
        ]
      }
    : { accountId: id }
  
  if (workspaceId) {
    query.workspaceId = workspaceId
  }
  return query
}

// Pre-save validation to ensure backward compatibility
instagramAccountSchema.pre('validate', function(next) {
  if (this.instagramUserId && !this.accountId) {
    this.accountId = this.instagramUserId
  }
  next()
})

export default mongoose.model('InstagramAccount', instagramAccountSchema)

