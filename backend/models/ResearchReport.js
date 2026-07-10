import mongoose from 'mongoose'

// Research Report — Phase 2 Research Workspace output. Cached per workspace
// slot (workspaceId + channelId + ideaId) and keyed by scriptHash so an
// unchanged script doesn't re-run the AI pipeline. Suggestions carry state
// so the UI can mark them applied/ignored without rewriting the whole doc.
const sourceSchema = new mongoose.Schema({
  url: { type: String, required: true },
  title: { type: String, default: '' },
  domain: { type: String, default: '' },
  publishedDate: { type: String, default: '' },
}, { _id: false })

const claimSchema = new mongoose.Schema({
  id: { type: String, required: true },
  text: { type: String, required: true },
  type: { type: String, enum: ['statistic', 'fact', 'date', 'claim'], default: 'claim' },
  verdict: {
    type: String,
    enum: ['verified', 'needs-citation', 'weak', 'false', 'unverified'],
    default: 'unverified',
  },
  confidence: { type: Number, default: 0 },
  snippet: { type: String, default: '' },
  field: { type: String, default: 'fullScript' },
  sources: { type: [sourceSchema], default: [] },
}, { _id: false })

const suggestionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: {
    type: String,
    enum: ['fix-statistic', 'fix-date', 'replace-claim', 'add-context', 'remove-hallucination'],
    default: 'replace-claim',
  },
  field: { type: String, default: 'fullScript' },
  find: { type: String, default: '' },
  replace: { type: String, default: '' },
  rationale: { type: String, default: '' },
  confidence: { type: Number, default: 0 },
  sources: { type: [sourceSchema], default: [] },
  state: { type: String, enum: ['pending', 'applied', 'ignored'], default: 'pending' },
  appliedVersion: { type: Number, default: null },
}, { _id: false })

const missingContextSchema = new mongoose.Schema({
  topic: { type: String, required: true },
  why: { type: String, default: '' },
  suggestedAddition: { type: String, default: '' },
  priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
}, { _id: false })

const researchScoreSchema = new mongoose.Schema({
  overall: { type: Number, default: 0 },
  accuracy: { type: Number, default: 0 },
  freshness: { type: Number, default: 0 },
  credibility: { type: Number, default: 0 },
  citationCoverage: { type: Number, default: 0 },
}, { _id: false })

const researchReportSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true,
  },
  channelId: { type: String, required: true, index: true },
  ideaId: { type: String, required: true },

  // sha256 of working.fullScript + '\n' + working.title. When the script
  // changes such that the hash differs, the controller triggers re-analysis.
  scriptHash: { type: String, required: true },

  report: {
    claims: { type: [claimSchema], default: [] },
    suggestions: { type: [suggestionSchema], default: [] },
    missingContext: { type: [missingContextSchema], default: [] },
    researchScore: { type: researchScoreSchema, default: () => ({}) },
  },

  providerUsed: {
    ai: { type: String, default: 'deepseek' },
    search: { type: String, default: 'stub' },
  },
  // True when the active search provider is non-grounded (stub). The UI shows
  // the amber "Limited verification" banner in that case.
  limitedVerification: { type: Boolean, default: true },

  generatedAt: { type: Date, default: Date.now },
  analyzedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
})

researchReportSchema.index({ workspaceId: 1, channelId: 1, ideaId: 1 }, { unique: true })

// ── Statics ────────────────────────────────────────────────────────────────

researchReportSchema.statics.findForWorkspace = function ({ workspaceId, channelId, ideaId }) {
  return this.findOne({ workspaceId, channelId, ideaId }).lean()
}

researchReportSchema.statics.upsertReport = async function (
  { workspaceId, channelId, ideaId },
  update,
) {
  return this.findOneAndUpdate(
    { workspaceId, channelId, ideaId },
    { $set: update },
    { upsert: true, new: true },
  ).lean()
}

// Patch a single suggestion's state without rewriting the rest of the report.
// Used by Apply and Ignore endpoints.
researchReportSchema.statics.markSuggestionState = async function (
  { workspaceId, channelId, ideaId },
  suggestionId,
  state,
  appliedVersion = null,
) {
  const doc = await this.findOne({ workspaceId, channelId, ideaId })
  if (!doc) return null

  // suggestionSchema uses { _id: false }, so Mongoose's .id() (which searches
  // by _id) cannot find subdocuments. Look up by the business `id` field.
  const suggestion = doc.report.suggestions.find((s) => s.id === suggestionId)
  if (!suggestion) return null

  suggestion.state = state
  if (appliedVersion != null) suggestion.appliedVersion = appliedVersion

  await doc.save()
  return doc.toObject()
}

export default mongoose.model('ResearchReport', researchReportSchema)
