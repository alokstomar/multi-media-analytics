import mongoose from 'mongoose'

// Creator Style Profile — the AI's learned model of how a specific creator
// writes. Built from their video titles, channel description, and (later)
// transcripts. Cached per channel so we don't re-analyze on every workspace
// open. Thumbnail style is stored separately in ThumbnailStyleProfile but
// denormalized here too for single-read access from the workspace bootstrap.
const creatorStyleProfileSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true,
  },
  channelId: { type: String, required: true, index: true },

  // The full analyzeCreatorStyle output. Kept as Mixed so the schema can
  // evolve without migrations — fields like languageMix, vocabulary,
  // hookStyle, retentionTechniques, signatureWords, etc.
  profile: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Nested thumbnail style profile — populated async by analyzeThumbnailStyle.
  // Null until that runs.
  thumbnailStyle: { type: mongoose.Schema.Types.Mixed, default: null },

  // Provenance — which videos were used to build this profile.
  generatedFromVideoIds: { type: [String], default: [] },
  generatedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
})

creatorStyleProfileSchema.index({ workspaceId: 1, channelId: 1 }, { unique: true })

creatorStyleProfileSchema.statics.findForChannel = function (workspaceId, channelId) {
  return this.findOne({ workspaceId, channelId }).lean()
}

creatorStyleProfileSchema.statics.upsertForChannel = async function (workspaceId, channelId, profile, extras = {}) {
  return this.findOneAndUpdate(
    { workspaceId, channelId },
    {
      profile,
      generatedAt: new Date(),
      ...extras,
    },
    { upsert: true, new: true },
  ).lean()
}

// Patch only the thumbnailStyle nested field — used when analyzeThumbnailStyle
// runs after the main profile is already cached.
creatorStyleProfileSchema.statics.setThumbnailStyle = async function (workspaceId, channelId, thumbnailStyle) {
  return this.findOneAndUpdate(
    { workspaceId, channelId },
    { thumbnailStyle, 'meta.thumbnailStyleAt': new Date() },
    { new: true },
  ).lean()
}

export default mongoose.model('CreatorStyleProfile', creatorStyleProfileSchema)
