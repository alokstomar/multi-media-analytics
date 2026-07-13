import { Router } from 'express'
import multer from 'multer'
import {
  healthCheck,
  analyzeTitle,
  analyzeThumbnail,
  analyzeScript,
  generateVideoIdeas,
  generateShortsIdeas,
  generateProductionScript,
  getContentGaps,
  getStrategistTips,
  predictPerformance,
  summarizeAlerts,
  simulatePerformance,
  getCompetitorOpportunities,
} from '../controllers/intelligenceController.js'
import {
  getScriptWorkspace,
  generateStyledScriptController,
  saveScriptWorkspace,
  undoScriptWorkspace,
  redoScriptWorkspace,
  transformScript,
  scoreScriptStyleController,
  analyzeCreatorStyleController,
} from '../controllers/scriptWorkspaceController.js'
import {
  getResearch,
  analyzeResearch,
  applySuggestion,
  ignoreSuggestion,
} from '../controllers/researchController.js'
import {
  getThumbnailWorkspace,
  generateThumbnailStrategyController,
  saveThumbnailStrategy,
  undoThumbnailStrategy,
  redoThumbnailStrategy,
  scoreThumbnailSimilarityController,
  analyzeThumbnailProfileController,
} from '../controllers/thumbnailController.js'

const router = Router()

// Configure Multer for in-memory image uploads with 10MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'))
    }
    cb(null, true)
  }
})

router.get('/health', healthCheck)
router.get('/competitor-opportunities', getCompetitorOpportunities)

// Channel-scoped intelligence
router.post('/:channelId/ideas', generateVideoIdeas)
router.post('/:channelId/shorts-ideas', generateShortsIdeas)
// ideaId in the URL path so the recommendation is a true resource identifier
// and req.params.ideaId is populated (matches the /script/:channelId/:ideaId
// route on the frontend).
router.post('/:channelId/production-script/:ideaId', generateProductionScript)
router.post('/:channelId/content-gaps', getContentGaps)
router.post('/:channelId/strategist', getStrategistTips)
router.post('/:channelId/predict-performance', predictPerformance)
router.post('/:channelId/alerts-summary', summarizeAlerts)

// ── Script Workspace 2.0 ────────────────────────────────────────────────
// Channel-aware AI content studio. Replaces the legacy read-only production-
// script page on the frontend. Server-side persistence + version history.
router.get('/:channelId/script-workspace/:ideaId', getScriptWorkspace)
router.post('/:channelId/script-workspace/:ideaId/generate', generateStyledScriptController)
router.post('/:channelId/script-workspace/:ideaId/save', saveScriptWorkspace)
router.post('/:channelId/script-workspace/:ideaId/undo', undoScriptWorkspace)
router.post('/:channelId/script-workspace/:ideaId/redo', redoScriptWorkspace)
router.post('/:channelId/script-workspace/:ideaId/transform', transformScript)
router.post('/:channelId/script-workspace/:ideaId/style-score', scoreScriptStyleController)
router.post('/:channelId/creator-style', analyzeCreatorStyleController)

// ── Research Workspace (Phase 2) ─────────────────────────────────────────
// Provider-agnostic fact-checking & suggestion engine. Reads the script
// from the workspace, runs claim extraction + (optional) web search + final
// analysis, returns a ResearchReport with claims/suggestions/score. Apply
// pushes a new version with source='research-suggestion'.
router.get('/:channelId/script-workspace/:ideaId/research', getResearch)
router.post('/:channelId/script-workspace/:ideaId/research/analyze', analyzeResearch)
router.post('/:channelId/script-workspace/:ideaId/research/suggestions/:suggestionId/apply', applySuggestion)
router.post('/:channelId/script-workspace/:ideaId/research/suggestions/:suggestionId/ignore', ignoreSuggestion)

// ── Thumbnail Intelligence (Phase 3.1) ────────────────────────────────────
// Versioned workspace for thumbnail concepts + editable prompt + similarity
// analysis. Grounded in the creator's Thumbnail DNA profile (cached per
// channel) and the current script. NO image generation in Phase 3.1 — the
// prompt is a text artifact the user edits; "Generate Thumbnail" is disabled.
router.get('/:channelId/thumbnail-workspace/:ideaId', getThumbnailWorkspace)
router.post('/:channelId/thumbnail-workspace/:ideaId/generate', generateThumbnailStrategyController)
router.post('/:channelId/thumbnail-workspace/:ideaId/save', saveThumbnailStrategy)
router.post('/:channelId/thumbnail-workspace/:ideaId/undo', undoThumbnailStrategy)
router.post('/:channelId/thumbnail-workspace/:ideaId/redo', redoThumbnailStrategy)
router.post('/:channelId/thumbnail-workspace/:ideaId/similarity-score', scoreThumbnailSimilarityController)
router.post('/:channelId/thumbnail-profile', analyzeThumbnailProfileController)

// Input-scoped analysis (no channel required)
router.post('/analyze/title', analyzeTitle)
router.post('/analyze/thumbnail', upload.single('thumbnail'), (err, req, res, next) => {
  // Catch Multer/Upload specific errors (e.g. fileFilter rejection or size limits)
  if (err) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'FILE_UPLOAD_ERROR',
        message: err.message
      }
    })
  }
  next()
}, analyzeThumbnail)
router.post('/analyze/script', analyzeScript)
router.post('/performance/simulate', upload.single('thumbnail'), (err, req, res, next) => {
  if (err) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'FILE_UPLOAD_ERROR',
        message: err.message
      }
    })
  }
  next()
}, simulatePerformance)

export default router
