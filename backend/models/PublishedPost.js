import mongoose from 'mongoose'

const publishedPostSchema = new mongoose.Schema({
  platform: {
    type: String,
    required: true,
    enum: ['linkedin', 'twitter', 'instagram', 'threads'],
  },
  accountId: {
    type: String, // String identifier to hold Twitter/LinkedIn specific ID
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  providerPostId: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['published', 'failed'],
    default: 'published',
    required: true,
  },
  publishedAt: {
    type: Date,
    default: Date.now,
    required: true,
  },
  responsePayload: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  scheduledJobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ScheduledJob',
  },

  // Extended telemetry fields for Phase 4E
  executionDurationMs: {
    type: Number,
    default: 0,
  },
  retryCount: {
    type: Number,
    default: 0,
  },
  publishSource: {
    type: String,
    enum: ['bullmq', 'mongodb_fallback'],
    required: true,
  },
  publishedBy: {
    type: String,
    default: 'system',
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
  },
}, {
  timestamps: true,
})

publishedPostSchema.index({ workspaceId: 1 })
publishedPostSchema.index({ platform: 1, accountId: 1 })
publishedPostSchema.index({ publishedAt: -1 })

export default mongoose.model('PublishedPost', publishedPostSchema)
