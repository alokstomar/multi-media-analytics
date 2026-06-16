import mongoose from 'mongoose'

const linkedinPublishingJobSchema = new mongoose.Schema({
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LinkedinScheduledPost',
    required: true,
  },
  platform: {
    type: String,
    required: true,
    default: 'linkedin',
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
  }
}, { timestamps: true })

linkedinPublishingJobSchema.index({ status: 1, scheduledTime: 1 })

export default mongoose.model('LinkedinPublishingJob', linkedinPublishingJobSchema)
