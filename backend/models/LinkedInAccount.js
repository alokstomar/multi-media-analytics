import mongoose from 'mongoose'

const linkedinAccountSchema = new mongoose.Schema({
  userId: { type: String }, // App user identifier
  linkedinUserId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  displayName: { type: String, default: '' },
  headline: { type: String, default: 'LinkedIn Professional' },
  profileImage: { type: String, default: '' },
  provider: { type: String, default: 'linkedin', required: true },
  scopes: [{ type: String }],
  
  // Encrypted tokens, server-side only (select: false)
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

  linkedinEntityType: {
    type: String,
    enum: ['profile', 'organization'],
    default: 'profile',
    required: true,
  },
  organizationId: { type: String, default: '' },
  organizationName: { type: String, default: '' },
  canPublish: { type: Boolean, default: true, required: true },
  
  connectedAt: { type: Date, default: Date.now },
  lastSyncedAt: { type: Date },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
  },
}, {
  timestamps: true,
})

linkedinAccountSchema.index({ workspaceId: 1 })

export default mongoose.model('LinkedInAccount', linkedinAccountSchema)
