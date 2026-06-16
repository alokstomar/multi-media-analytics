import mongoose from 'mongoose'

const scheduledTweetSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['tweet', 'thread'],
    default: 'tweet',
  },
  threadPosts: [{
    type: String
  }],
  scheduledAt: {
    type: Date,
    required: true,
  },
  account: {
    type: String,
    required: true,
    default: '@samay_raina'
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
  twitterTweetId: {
    type: String,
    default: null,
  },
  twitterTweetUrl: {
    type: String,
    default: null,
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
  }
}, { timestamps: true })

scheduledTweetSchema.index({ workspaceId: 1 })
scheduledTweetSchema.index({ status: 1, scheduledAt: 1 })

export default mongoose.model('ScheduledTweet', scheduledTweetSchema)
