import mongoose from 'mongoose'

const linkedinScheduledPostSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['personal', 'company', 'thought-leadership', 'industry-insight', 'story'],
    default: 'thought-leadership',
  },
  scheduledAt: {
    type: Date,
    required: true,
  },
  account: {
    type: String,
    required: true,
    default: 'Samay Raina'
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
  error: {
    type: String,
    default: '',
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
  }
}, { timestamps: true })

linkedinScheduledPostSchema.index({ workspaceId: 1 })
linkedinScheduledPostSchema.index({ status: 1, scheduledAt: 1 })

export default mongoose.model('LinkedinScheduledPost', linkedinScheduledPostSchema)
