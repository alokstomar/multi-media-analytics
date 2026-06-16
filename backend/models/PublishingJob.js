import mongoose from 'mongoose'

const publishingJobSchema = new mongoose.Schema({
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true,
  },
  platform: {
    type: String,
    required: true,
    enum: ['linkedin', 'twitter', 'instagram', 'threads'],
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
  },
  scheduledPost: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ScheduledPost',
    default: null,
  },
  attempts: {
    type: Number,
    default: 0,
  },
  maxAttempts: {
    type: Number,
    default: 3,
  },
  lastAttempt: {
    type: Date,
    default: null,
  },
  error: {
    type: String,
    default: '',
  },
  runAt: {
    type: Date,
    required: true,
    default: Date.now,
  },
  completedAt: {
    type: Date,
    default: null,
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
  },
}, { timestamps: true })

publishingJobSchema.index({ status: 1, runAt: 1 })
publishingJobSchema.index({ workspaceId: 1 })

export default mongoose.model('PublishingJob', publishingJobSchema)
