import mongoose from 'mongoose'

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

  // Extraction schema version. Old docs have `undefined` here, which the
  // controllers treat as v1 — see CURRENT_PROFILE_VERSION below.
  profileVersion: { type: Number, default: 1 },

  // Provenance — which videos were used to build this profile.
  generatedFromVideoIds: { type: [String], default: [] },
  generatedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
})

// Bump when the analyzeCreatorStyle extraction schema changes in a way that
// should invalidate every cached profile. Controllers compare the stored
// profileVersion against this constant and trigger a cold rebuild on mismatch
// — so users get the new extraction automatically without clicking Regenerate.
//
//   v1 — original extraction (writing-style signals)
//   v2 — Speech Engine 2.0: structured `speakingStyle` block (12 dimensions)
//   v3 — Speech Engine Round 2: real YouTube transcripts as Tier-1 corpus +
//        four new speakingStyle dimensions (cameraFacingStyle, qaPatterns,
//        repetitionPatterns, spokenGrammar)
creatorStyleProfileSchema.statics.CURRENT_PROFILE_VERSION = 3

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
