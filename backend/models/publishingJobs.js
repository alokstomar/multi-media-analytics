import mongoose from 'mongoose'

const publishingJobSchema = new mongoose.Schema({
  tweet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ScheduledTweet',
    required: true,
  },
  platform: {
    type: String,
    required: true,
    default: 'twitter',
  },
  scheduledTime: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'processing', 'published', 'failed'],
    default: 'scheduled',
  },
  retryCount: {
    type: Number,
    default: 0,
  },
  maxRetries: {
    type: Number,
    default: 3,
  },
  errorLog: {
    type: String,
    default: '',
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
  }
}, { timestamps: true })

publishingJobSchema.index({ workspaceId: 1 })
publishingJobSchema.index({ status: 1, scheduledTime: 1 })

export default mongoose.model('PublishingJobTwitter', publishingJobSchema)

