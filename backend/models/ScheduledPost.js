import mongoose from 'mongoose'

const scheduledPostSchema = new mongoose.Schema({
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
  scheduledAt: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending',
  },
  publishedAt: {
    type: Date,
    default: null,
  },
  publishJob: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PublishingJob',
    default: null,
  },
  error: {
    type: String,
    default: '',
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
  },
}, { timestamps: true })

scheduledPostSchema.index({ status: 1, scheduledAt: 1 })
scheduledPostSchema.index({ workspaceId: 1 })

export default mongoose.model('ScheduledPost', scheduledPostSchema)
