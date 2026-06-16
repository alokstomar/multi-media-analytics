import mongoose from 'mongoose'

const scheduledJobSchema = new mongoose.Schema({
  platform: {
    type: String,
    required: true,
    enum: ['youtube', 'twitter', 'linkedin', 'instagram'],
  },
  accountId: {
    type: String,
    default: '',
  },
  jobType: {
    type: String,
    required: true,
    enum: [
      // Publishing
      'twitter-post', 'linkedin-post', 'instagram-post',
      // Automation
      'automation',
      // AI Automation
      'generate-linkedin-post', 'generate-thread', 'generate-content-ideas', 'repurpose-content',
      // Retry
      'retry',
    ],
  },
  status: {
    type: String,
    enum: ['waiting', 'active', 'completed', 'failed', 'delayed', 'cancelled'],
    default: 'waiting',
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  scheduledFor: {
    type: Date,
    required: true,
  },
  executedAt: {
    type: Date,
    default: null,
  },
  completedAt: {
    type: Date,
    default: null,
  },
  executionDurationMs: {
    type: Number,
    default: null,
  },
  retries: {
    type: Number,
    default: 0,
  },
  maxRetries: {
    type: Number,
    default: 3,
  },
  error: {
    type: String,
    default: '',
  },
  stackTrace: {
    type: String,
    default: '',
  },
  errorCode: {
    type: String,
    default: '',
  },
  errorMessage: {
    type: String,
    default: '',
  },
  providerResponse: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  errorType: {
    type: String,
    enum: ['auth_error', 'rate_limit', 'network_error', 'provider_error', 'validation_error', ''],
    default: '',
  },


  bullmqJobId: {
    type: String,
    default: '',
  },
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    default: null,
  },
  publishingJob: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PublishingJob',
    default: null,
  },
  createdBy: {
    type: String,
    default: 'system',
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
  },
}, { timestamps: true })

scheduledJobSchema.index({ workspaceId: 1 })
scheduledJobSchema.index({ status: 1, scheduledFor: 1 })
scheduledJobSchema.index({ platform: 1, status: 1 })
scheduledJobSchema.index({ bullmqJobId: 1 })

export default mongoose.model('ScheduledJob', scheduledJobSchema)
