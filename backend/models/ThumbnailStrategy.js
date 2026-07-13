import mongoose from 'mongoose'

// Thumbnail Strategy — the versioned workspace for thumbnail concepts,
// prompt, and similarity analysis. One per (workspace, channel, idea).
// Mirrors ScriptWorkspace's version-history pattern: every generate / edit /
// rescore pushes a version, undo/redo moves the cursor, any new edit
// truncates the redo stack.
//
// Phase 3.2 will add `generatedImage` (URL/base64) to the working object so
// the same version history tracks image generations too. The schema is
// designed to accept that without migration (working is Mixed where needed).

const conceptSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  explanation: { type: String, default: '' },
  audienceReaction: { type: String, default: '' },
  whyItFits: { type: String, default: '' },
  predictedCTR: { type: Number, default: 0 },      // 0-100 (e.g., 9.3 → 9.3%)
  similarity: { type: Number, default: 0 },         // 0-100
  confidence: { type: Number, default: 0 },         // 0-100
}, { _id: false })

const similaritySchema = new mongoose.Schema({
  overall: { type: Number, default: 0 },
  colors: { type: Number, default: 0 },
  typography: { type: Number, default: 0 },
  layout: { type: Number, default: 0 },
  composition: { type: Number, default: 0 },
  emotion: { type: Number, default: 0 },
  branding: { type: Number, default: 0 },
  textStyle: { type: Number, default: 0 },
  visualIdentity: { type: Number, default: 0 },
}, { _id: false })

const workingFields = {
  title: { type: String, default: '' },
  concepts: { type: [conceptSchema], default: [] },
  prompt: { type: String, default: '' },
  similarity: { type: similaritySchema, default: () => ({}) },
}

const thumbnailStrategySchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true,
  },
  channelId: { type: String, required: true, index: true },
  ideaId: { type: String, required: true },

  channel: {
    title: String,
    handle: String,
    profileImage: String,
  },

  // The recommendation (idea) snapshot this thumbnail strategy belongs to.
  recommendation: { type: mongoose.Schema.Types.Mixed, default: {} },

  working: workingFields,

  versions: [{
    version: { type: Number, required: true },
    working: {
      title: String,
      concepts: { type: [conceptSchema], default: [] },
      prompt: String,
      similarity: { type: similaritySchema, default: () => ({}) },
    },
    source: {
      type: String,
      enum: ['ai-initial', 'ai-regen', 'user-edit', 'similarity-rescore'],
      default: 'user-edit',
    },
    action: { type: String, default: null },
    editedAt: { type: Date, default: Date.now },
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  }],

  cursor: { type: Number, default: 0 },

  // Ref to the ThumbnailProfile used for this strategy — so rescore knows
  // which DNA to compare against.
  profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'ThumbnailProfile', default: null },

  aiGeneratedAt: { type: Date, default: null },
  lastSavedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
})

thumbnailStrategySchema.index({ workspaceId: 1, channelId: 1, ideaId: 1 }, { unique: true })

// ── Statics ────────────────────────────────────────────────────────────────

// Get-or-create: returns the strategy for a given idea, creating an empty
// shell if none exists yet.
thumbnailStrategySchema.statics.findOrCreate = async function ({ workspaceId, channelId, ideaId, channel, recommendation, userId }) {
  const existing = await this.findOne({ workspaceId, channelId, ideaId }).lean()
  if (existing) return { doc: existing, created: false }

  const created = await this.create({
    workspaceId,
    channelId,
    ideaId,
    channel: {
      title: channel?.title || '',
      handle: channel?.handle || '',
      profileImage: channel?.profileImage || '',
    },
    recommendation: recommendation || {},
    working: { title: '', concepts: [], prompt: '', similarity: {} },
    versions: [],
    cursor: 0,
  })
  return { doc: created.toObject(), created: true, _id: created._id, userId }
}

// Push a new version and update working in one atomic operation. Truncates
// the redo stack (everything after cursor) before appending.
thumbnailStrategySchema.statics.pushVersion = async function (docId, working, meta = {}) {
  const doc = await this.findById(docId)
  if (!doc) throw new Error(`ThumbnailStrategy ${docId} not found`)

  doc.versions = doc.versions.slice(0, doc.cursor + 1)

  const nextVersionNumber = doc.versions.length === 0
    ? 1
    : doc.versions[doc.versions.length - 1].version + 1

  doc.versions.push({
    version: nextVersionNumber,
    working: {
      title: working.title ?? '',
      concepts: Array.isArray(working.concepts) ? working.concepts : [],
      prompt: working.prompt ?? '',
      similarity: working.similarity || {},
    },
    source: meta.source || 'user-edit',
    action: meta.action || null,
    editedAt: new Date(),
    editedBy: meta.editedBy || null,
  })

  doc.working = {
    title: working.title ?? '',
    concepts: Array.isArray(working.concepts) ? working.concepts : [],
    prompt: working.prompt ?? '',
    similarity: working.similarity || {},
  }

  doc.cursor = doc.versions.length - 1
  doc.lastSavedAt = new Date()

  if (meta.profileId) doc.profileId = meta.profileId

  await doc.save()
  return doc.toObject()
}

thumbnailStrategySchema.statics.undo = async function (docId) {
  const doc = await this.findById(docId)
  if (!doc) throw new Error(`ThumbnailStrategy ${docId} not found`)
  if (doc.cursor <= 0) return doc.toObject()

  doc.cursor -= 1
  doc.working = doc.versions[doc.cursor].working
  doc.lastSavedAt = new Date()
  await doc.save()
  return doc.toObject()
}

thumbnailStrategySchema.statics.redo = async function (docId) {
  const doc = await this.findById(docId)
  if (!doc) throw new Error(`ThumbnailStrategy ${docId} not found`)
  if (doc.cursor >= doc.versions.length - 1) return doc.toObject()

  doc.cursor += 1
  doc.working = doc.versions[doc.cursor].working
  doc.lastSavedAt = new Date()
  await doc.save()
  return doc.toObject()
}

// Patch working without creating a version — for lightweight prompt edits
// that don't pollute the undo stack.
thumbnailStrategySchema.statics.patchWorking = async function (docId, workingPatch, meta = {}) {
  const doc = await this.findById(docId)
  if (!doc) throw new Error(`ThumbnailStrategy ${docId} not found`)

  doc.working = {
    ...doc.working,
    ...Object.fromEntries(
      Object.entries(workingPatch).filter(([k]) =>
        ['title', 'concepts', 'prompt', 'similarity'].includes(k)
      )
    ),
  }

  doc.lastSavedAt = new Date()
  await doc.save()
  return doc.toObject()
}

thumbnailStrategySchema.statics.markGenerated = async function (docId, { profileId } = {}) {
  const doc = await this.findById(docId)
  if (!doc) throw new Error(`ThumbnailStrategy ${docId} not found`)
  doc.aiGeneratedAt = new Date()
  if (profileId) doc.profileId = profileId
  await doc.save()
  return doc.toObject()
}

export default mongoose.model('ThumbnailStrategy', thumbnailStrategySchema)
