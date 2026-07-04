import mongoose from 'mongoose'

const workingFields = {
  title: { type: String, default: '' },
  hook: { type: String, default: '' },
  fullScript: { type: String, default: '' },
  cta: { type: String, default: '' },
  description: { type: String, default: '' },
  hashtags: { type: [String], default: [] },
}

const styleMatchSchema = {
  overall: { type: Number, default: 0 },
  language: { type: Number, default: 0 },
  hook: { type: Number, default: 0 },
  flow: { type: Number, default: 0 },
  rhythm: { type: Number, default: 0 },
  vocabulary: { type: Number, default: 0 },
  retention: { type: Number, default: 0 },
}

const scriptWorkspaceSchema = new mongoose.Schema({
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

  recommendation: { type: mongoose.Schema.Types.Mixed, default: {} },

  working: {
    ...workingFields,
    // Working is the live, current state of the editor — what the user sees
    // and what every downstream module consumes. Updated on every edit,
    // transform, regenerate, undo, redo.
  },

  versions: [{
    version: { type: Number, required: true },
    working: workingFields,
    source: {
      type: String,
      enum: ['ai-initial', 'ai-rewrite', 'ai-regen', 'user-edit', 'ai-transform', 'research-suggestion'],
      default: 'user-edit',
    },
    action: { type: String, default: null },
    editedAt: { type: Date, default: Date.now },
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  }],

  // Cursor points into versions[] — index of the active version. Undo moves
  // it backward, redo moves it forward, any new edit truncates everything
  // after the cursor and appends.
  cursor: { type: Number, default: 0 },

  styleMatch: styleMatchSchema,

  aiGeneratedAt: { type: Date, default: null },
  lastSavedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
})

scriptWorkspaceSchema.index({ workspaceId: 1, channelId: 1, ideaId: 1 }, { unique: true })

// ── Statics ────────────────────────────────────────────────────────────────

// Get-or-create: returns the workspace for a given idea, creating an empty
// shell if none exists yet. The shell is populated by the controller after
// the AI generates the initial script.
scriptWorkspaceSchema.statics.findOrCreate = async function ({ workspaceId, channelId, ideaId, channel, recommendation, userId }) {
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
    working: { title: '', hook: '', fullScript: '', cta: '', description: '', hashtags: [] },
    versions: [],
    cursor: 0,
  })
  return { doc: created.toObject(), created: true, _id: created._id, userId }
}

// Push a new version and update working in one atomic operation. Used by
// every state change (AI generate, transform, user edit). Truncates the
// redo stack (everything after cursor) before appending.
scriptWorkspaceSchema.statics.pushVersion = async function (docId, working, meta = {}) {
  const doc = await this.findById(docId)
  if (!doc) throw new Error(`ScriptWorkspace ${docId} not found`)

  // Drop any versions after the current cursor —- redo stack invalidated.
  doc.versions = doc.versions.slice(0, doc.cursor + 1)

  const nextVersionNumber = doc.versions.length === 0
    ? 1
    : doc.versions[doc.versions.length - 1].version + 1

  doc.versions.push({
    version: nextVersionNumber,
    working: {
      title: working.title ?? '',
      hook: working.hook ?? '',
      fullScript: working.fullScript ?? '',
      cta: working.cta ?? '',
      description: working.description ?? '',
      hashtags: Array.isArray(working.hashtags) ? working.hashtags : [],
    },
    source: meta.source || 'user-edit',
    action: meta.action || null,
    editedAt: new Date(),
    editedBy: meta.editedBy || null,
  })

  doc.working = {
    title: working.title ?? '',
    hook: working.hook ?? '',
    fullScript: working.fullScript ?? '',
    cta: working.cta ?? '',
    description: working.description ?? '',
    hashtags: Array.isArray(working.hashtags) ? working.hashtags : [],
  }

  doc.cursor = doc.versions.length - 1
  doc.lastSavedAt = new Date()

  if (meta.styleMatch) {
    doc.styleMatch = {
      overall: meta.styleMatch.overall ?? doc.styleMatch?.overall ?? 0,
      language: meta.styleMatch.language ?? doc.styleMatch?.language ?? 0,
      hook: meta.styleMatch.hook ?? doc.styleMatch?.hook ?? 0,
      flow: meta.styleMatch.flow ?? doc.styleMatch?.flow ?? 0,
      rhythm: meta.styleMatch.rhythm ?? doc.styleMatch?.rhythm ?? 0,
      vocabulary: meta.styleMatch.vocabulary ?? doc.styleMatch?.vocabulary ?? 0,
      retention: meta.styleMatch.retention ?? doc.styleMatch?.retention ?? 0,
    }
  }

  await doc.save()
  return doc.toObject()
}

// Move cursor back one step (if possible) and set working to that version.
scriptWorkspaceSchema.statics.undo = async function (docId) {
  const doc = await this.findById(docId)
  if (!doc) throw new Error(`ScriptWorkspace ${docId} not found`)
  if (doc.cursor <= 0) return doc.toObject()

  doc.cursor -= 1
  doc.working = doc.versions[doc.cursor].working
  doc.lastSavedAt = new Date()
  await doc.save()
  return doc.toObject()
}

// Move cursor forward one step (if possible).
scriptWorkspaceSchema.statics.redo = async function (docId) {
  const doc = await this.findById(docId)
  if (!doc) throw new Error(`ScriptWorkspace ${docId} not found`)
  if (doc.cursor >= doc.versions.length - 1) return doc.toObject()

  doc.cursor += 1
  doc.working = doc.versions[doc.cursor].working
  doc.lastSavedAt = new Date()
  await doc.save()
  return doc.toObject()
}

// Patch working fields without creating a version (for lightweight field
// autosave that doesn't pollute the undo stack). Used when the user is just
// typing in a field — we coalesce frequent keystroke-saves into one version
// on blur or transform.
scriptWorkspaceSchema.statics.patchWorking = async function (docId, workingPatch, meta = {}) {
  const doc = await this.findById(docId)
  if (!doc) throw new Error(`ScriptWorkspace ${docId} not found`)

  doc.working = {
    ...doc.working,
    ...Object.fromEntries(
      Object.entries(workingPatch).filter(([k]) =>
        ['title', 'hook', 'fullScript', 'cta', 'description', 'hashtags'].includes(k)
      )
    ),
  }

  doc.lastSavedAt = new Date()
  if (meta.styleMatch) {
    doc.styleMatch = { ...doc.styleMatch, ...meta.styleMatch }
  }
  await doc.save()
  return doc.toObject()
}

// Mark the AI generation timestamp — used by the controller after the
// initial generate call completes.
scriptWorkspaceSchema.statics.markGenerated = async function (docId, { styleMatch } = {}) {
  const doc = await this.findById(docId)
  if (!doc) throw new Error(`ScriptWorkspace ${docId} not found`)
  doc.aiGeneratedAt = new Date()
  if (styleMatch) doc.styleMatch = { ...doc.styleMatch, ...styleMatch }
  await doc.save()
  return doc.toObject()
}

export default mongoose.model('ScriptWorkspace', scriptWorkspaceSchema)
