import mongoose from 'mongoose'

// Thumbnail Profile (the "DNA") — the AI's learned model of how a specific
// creator designs thumbnails. Built from the channel's historical video
// titles, niche, performance data, and creator style. Cached per channel so
// the Thumbnail Workspace doesn't re-analyze on every open.
//
// Phase 3.1: DNA is AI-inferred from metadata (titles, niche, CTR patterns).
// Phase 3.2+ can enrich this with real image analysis (color extraction, face
// detection, OCR) — the schema already has slots for those fields.
const thumbnailProfileSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true,
  },
  channelId: { type: String, required: true, index: true },

  // The full analyzeThumbnailStyle output. Kept as Mixed so the schema can
  // evolve without migrations — fields like colors, typography, layout,
  // branding, emotion, clickbaitIntensity, consistencyScore, etc.
  profile: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Provenance — which videos were used to build this profile.
  generatedFromVideoIds: { type: [String], default: [] },
  generatedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
})

thumbnailProfileSchema.index({ workspaceId: 1, channelId: 1 }, { unique: true })

thumbnailProfileSchema.statics.findForChannel = function (workspaceId, channelId) {
  return this.findOne({ workspaceId, channelId }).lean()
}

thumbnailProfileSchema.statics.upsertForChannel = async function (workspaceId, channelId, profile, extras = {}) {
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

export default mongoose.model('ThumbnailProfile', thumbnailProfileSchema)
