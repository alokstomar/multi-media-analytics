import mongoose from 'mongoose'

const intelligenceCacheSchema = new mongoose.Schema({
  channelId: { type: String, required: true },
  feature: {
    type: String,
    required: true,
    enum: ['video-ideas', 'shorts-ideas', 'content-gaps', 'strategist-tips', 'analyze-thumbnail', 'analyze-script', 'portfolio-summary', 'portfolio-audience-overlap', 'portfolio-cross-promotion', 'portfolio-content-gaps', 'portfolio-cannibalization', 'portfolio-strategist', 'generate-linkedin', 'generate-twitter', 'generate-instagram', 'generate-threads', 'repurpose-content', 'improve-content'],
  },
  result: { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now },
})

intelligenceCacheSchema.index({ channelId: 1, feature: 1 }, { unique: true })
intelligenceCacheSchema.index({ createdAt: 1 }, { expireAfterSeconds: 21600 })

intelligenceCacheSchema.statics.findCached = function (channelId, feature) {
  return this.findOne({ channelId, feature }).lean()
}

intelligenceCacheSchema.statics.upsert = function (channelId, feature, result) {
  return this.findOneAndUpdate(
    { channelId, feature },
    { result, createdAt: new Date() },
    { upsert: true, new: true },
  )
}

intelligenceCacheSchema.statics.cacheKey = function (channelIds) {
  return [...channelIds].sort().join('|')
}

intelligenceCacheSchema.statics.findCachedPortfolio = function (channelIds, feature) {
  return this.findOne({ channelId: this.cacheKey(channelIds), feature }).lean()
}

intelligenceCacheSchema.statics.upsertPortfolio = function (channelIds, feature, result) {
  return this.findOneAndUpdate(
    { channelId: this.cacheKey(channelIds), feature },
    { result, createdAt: new Date() },
    { upsert: true, new: true },
  )
}

export default mongoose.model('IntelligenceCache', intelligenceCacheSchema)
