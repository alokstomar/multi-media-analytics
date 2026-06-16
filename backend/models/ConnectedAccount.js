import mongoose from 'mongoose'

const connectedAccountSchema = new mongoose.Schema({
  platform: {
    type: String,
    required: true,
    enum: ['linkedin', 'twitter'],
  },
  accountType: {
    type: String,
    enum: ['profile', 'page'],
    default: 'profile',
  },
  platformAccountId: { type: String, required: true },
  displayName: { type: String, default: '' },
  avatar: { type: String, default: '' },
  // Encrypted tokens (stored as strings for now — encrypt in production)
  accessToken: { type: String, default: '' },
  refreshToken: { type: String, default: '' },
  tokenExpiresAt: { type: Date, default: null },
  // Connection status
  connected: { type: Boolean, default: false },
  lastSyncedAt: { type: Date, default: null },
  // Config
  config: {
    autoPublish: { type: Boolean, default: false },
    defaultTone: { type: String, default: 'professional' },
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
  },
}, { timestamps: true })

connectedAccountSchema.index({ workspaceId: 1 })
connectedAccountSchema.index({ workspaceId: 1, platform: 1, platformAccountId: 1 }, { unique: true })

connectedAccountSchema.statics.findConnected = function (platform) {
  const query = { connected: true }
  if (platform) query.platform = platform
  return this.find(query).lean()
}

connectedAccountSchema.statics.findByPlatform = function (platformAccountId, platform) {
  return this.findOne({ platformAccountId, platform }).lean()
}

export default mongoose.model('ConnectedAccount', connectedAccountSchema)
