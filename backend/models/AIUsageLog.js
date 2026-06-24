import mongoose from 'mongoose'

const aiUsageLogSchema = new mongoose.Schema({
  method: {
    type: String,
    required: true,
    index: true
  },
  model: {
    type: String,
    required: true
  },
  promptTokens: {
    type: Number,
    default: 0
  },
  completionTokens: {
    type: Number,
    default: 0
  },
  totalTokens: {
    type: Number,
    default: 0
  },
  estimatedCost: {
    type: Number,
    default: 0
  },
  responseTimeMs: {
    type: Number,
    default: 0
  },
  success: {
    type: Boolean,
    default: true
  },
  error: {
    type: String
  },
  cacheHit: {
    type: Boolean,
    default: false
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  provider: {
    type: String,
    index: true
  },
  params: {
    type: mongoose.Schema.Types.Mixed
  }
}, { timestamps: true })

aiUsageLogSchema.index({ workspaceId: 1 })
aiUsageLogSchema.index({ createdAt: -1 })
aiUsageLogSchema.index({ userId: 1, createdAt: -1 })
aiUsageLogSchema.index({ userId: 1, provider: 1, createdAt: -1 })
aiUsageLogSchema.index({ userId: 1, method: 1, createdAt: -1 })

export default mongoose.model('AIUsageLog', aiUsageLogSchema)
