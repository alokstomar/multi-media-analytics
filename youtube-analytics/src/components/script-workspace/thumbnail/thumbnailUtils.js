// ─────────────────────────────────────────────────────────────────────────
// Thumbnail Workspace presentation utilities.
//
// Pure derivation functions and constants — no AI calls, no state. Reads the
// backend strategy/DNA shapes and produces presentation-layer metadata:
// score colors, CTR bands, clickbait intensity labels, collapse persistence,
// loading stage messages.
//
// Backend strategy shape:
//   strategy.working: { title, concepts[], prompt, similarity }
//   concept:          { id, title, explanation, audienceReaction, whyItFits, predictedCTR, similarity, confidence }
//   similarity:       { overall, colors, typography, layout, composition, emotion, branding, textStyle, visualIdentity }
//
// Backend DNA profile shape (Mixed, evolved by AI):
//   profile: { summary, colors, typography, layout, branding, elements, emotion,
//              clickbaitIntensity, ctrStyle, visualHierarchy, consistencyScore }
// ─────────────────────────────────────────────────────────────────────────

// The 9 similarity sub-scores shown in ThumbnailSimilarityCard. Order matters —
// visualIdentity and colors are weighted highest so they appear first.
export const SIMILARITY_SUB_SCORES = [
  { key: 'visualIdentity', label: 'Visual Identity' },
  { key: 'colors',         label: 'Colors' },
  { key: 'typography',     label: 'Typography' },
  { key: 'textStyle',      label: 'Text Style' },
  { key: 'layout',         label: 'Layout' },
  { key: 'composition',    label: 'Composition' },
  { key: 'emotion',        label: 'Emotion' },
  { key: 'branding',       label: 'Branding' },
]

// Score → color tint (shared with StyleMatchPanel'scheme: emerald/violet/amber/red).
export function scoreColor(score) {
  if (score == null) return { text: 'text-gray-400', bar: 'bg-gray-300' }
  if (score >= 85) return { text: 'text-emerald-600', bar: 'bg-emerald-500' }
  if (score >= 70) return { text: 'text-violet-600', bar: 'bg-violet-500' }
  if (score >= 50) return { text: 'text-amber-600', bar: 'bg-amber-500' }
  return { text: 'text-red-600', bar: 'bg-red-500' }
}

// Clickbait intensity (0-1) → label + tint.
export function clickbaitBand(intensity) {
  const i = Number(intensity)
  if (Number.isNaN(i)) return { label: 'Unknown', tint: 'gray' }
  if (i >= 0.75) return { label: 'High Clickbait', tint: 'red' }
  if (i >= 0.5)  return { label: 'Moderate Clickbait', tint: 'amber' }
  if (i >= 0.25) return { label: 'Subtle Hook', tint: 'sky' }
  return { label: 'Clean / Minimal', tint: 'emerald' }
}

// predictedCTR (0-20 %) → band label. Based on typical YouTube CTR distributions:
//   <4% = low, 4-8% = average, 8-12% = strong, 12%+ = outlier.
export function ctrBand(ctr) {
  const c = Number(ctr)
  if (Number.isNaN(c)) return { label: '—', tint: 'gray' }
  if (c >= 12) return { label: 'Outlier', tint: 'emerald' }
  if (c >= 8)  return { label: 'Strong', tint: 'sky' }
  if (c >= 4)  return { label: 'Average', tint: 'amber' }
  return { label: 'Below Average', tint: 'red' }
}

// Overall similarity → plain-English qualitative label.
export function similarityVerdict(score) {
  if (score == null) return 'No similarity data yet.'
  if (score >= 85) return 'Strongly on-brand — closely matches the creator\'s visual DNA.'
  if (score >= 70) return 'Good alignment — minor deviations from the creator\'s style.'
  if (score >= 50) return 'Partial match — concepts diverge in a few key areas.'
  return 'Off-brand — consider regenerating for closer alignment.'
}

// ── Session-persistent collapse state ─────────────────────────────────────
const COLLAPSE_KEY = 'thumbnail-workspace-collapsed'

export function readCollapseState() {
  try {
    return sessionStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

export function writeCollapseState(collapsed) {
  try {
    sessionStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
  } catch { /* ignore */ }
}

// ── Staged loading messages ───────────────────────────────────────────────
// Cycled while generating. Pure UI — no relation to actual backend steps.
export const LOADING_STAGES = [
  'Analyzing creator thumbnails…',
  'Building Thumbnail DNA…',
  'Designing concepts…',
  'Scoring similarity…',
  'Drafting editable prompt…',
]

// Tint class → bg/text/border classes for badges. Centralized so all thumbnail
// components share the same color vocabulary.
export const TINT_CLASSES = {
  gray:    'bg-gray-100 text-gray-700 border-gray-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  sky:     'bg-sky-50 text-sky-700 border-sky-200',
  violet:  'bg-violet-50 text-violet-700 border-violet-200',
  amber:   'bg-amber-50 text-amber-700 border-amber-200',
  red:     'bg-red-50 text-red-700 border-red-200',
  orange:  'bg-orange-50 text-orange-700 border-orange-200',
}

export function tintClass(tint) {
  return TINT_CLASSES[tint] || TINT_CLASSES.gray
}
