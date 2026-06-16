import mongoose from 'mongoose'

const twitterAutomationExecutionSchema = new mongoose.Schema({
  ruleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AutomationRule',
    required: true,
  },
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TwitterAccount',
    required: true,
  },
  tweetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ScheduledTweet',
  },
  tweetUrl: {
    type: String,
    default: '',
  },
  executionTime: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['success', 'failed'],
    required: true,
  },
  errorMessage: {
    type: String,
    default: '',
  },
  responsePayload: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  apiLatencyMs: {
    type: Number,
    default: 0,
  },
  publishedAt: {
    type: Date,
    default: null,
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
  }
}, { timestamps: true })

twitterAutomationExecutionSchema.index({ workspaceId: 1 })
twitterAutomationExecutionSchema.index({ ruleId: 1 })

export default mongoose.model('TwitterAutomationExecution', twitterAutomationExecutionSchema)
