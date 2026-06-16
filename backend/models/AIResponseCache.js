import mongoose from 'mongoose'

const aiResponseCacheSchema = new mongoose.Schema({
  cacheKey: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  method: {
    type: String,
    required: true,
    index: true
  },
  params: {
    type: mongoose.Schema.Types.Mixed
  },
  response: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  provider: {
    type: String,
    default: 'openai'
  },
  usage: {
    promptTokens: { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    model: { type: String },
    estimatedCost: { type: Number, default: 0 }
  },
  responseTimeMs: {
    type: Number,
    default: 0
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 }  // MongoDB TTL index — auto-deletes when expiresAt passes
  }
}, { timestamps: true })

export default mongoose.model('AIResponseCache', aiResponseCacheSchema)
