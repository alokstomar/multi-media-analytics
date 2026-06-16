import mongoose from 'mongoose'

const instagramAnalyticsSnapshotSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
  },
  followers: { type: Number, default: 0 },
  following: { type: Number, default: 0 },
  postsCount: { type: Number, default: 0 },
  averageLikes: { type: Number, default: 0 },
  averageComments: { type: Number, default: 0 },
  averageViews: { type: Number, default: 0 },
  engagementRate: { type: Number, default: 0 }, // percentage (e.g. 3.4)
  snapshotDate: { type: Date, default: Date.now },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
  },

  // Framework integration metadata
  provider: { type: String, default: '' },
  providerVersion: { type: String, default: 'v1' },
  syncedAt: { type: Date, default: Date.now },
  rawPayload: { type: mongoose.Schema.Types.Mixed, default: {} },
}, {
  timestamps: true,
})

// Compound index for querying snapshots by username and date for a specific workspace
instagramAnalyticsSnapshotSchema.index({ username: 1, workspaceId: 1, snapshotDate: -1 })

export default mongoose.model('InstagramAnalyticsSnapshot', instagramAnalyticsSnapshotSchema)
