/**
 * Instagram AI intelligence router.
 *
 * Mounted at /api/instagram/intelligence in server.js. Auth + workspace +
 * AI-context middleware are applied at the router level so every route
 * below inherits them.
 *
 *   GET  /recommendations       → listRecommendations
 *   GET  /best-times            → listBestTimes
 *   GET  /growth-opportunities  → listGrowthOpportunities
 *   GET  /competitors           → listCompetitors
 *   GET  /hashtags              → listHashtags
 *   POST /content-ideas         → createContentIdeas
 */

import { Router } from 'express'
import { requireAuth, requireWorkspace } from '../middlewares/authMiddleware.js'
import { attachAIContext } from '../middlewares/aiContextMiddleware.js'
import {
  listRecommendations,
  listBestTimes,
  listGrowthOpportunities,
  listCompetitors,
  listHashtags,
  createContentIdeas,
  getCommentSummary,
  getPortfolioInsights,
} from '../controllers/instagramAIController.js'

const router = Router()

// Every IG AI route requires auth + workspace binding + AI context.
router.use(requireAuth, requireWorkspace, attachAIContext)

router.get('/recommendations', listRecommendations)
router.get('/best-times', listBestTimes)
router.get('/growth-opportunities', listGrowthOpportunities)
router.get('/competitors', listCompetitors)
router.get('/hashtags', listHashtags)
router.post('/content-ideas', createContentIdeas)
router.get('/comments-summary', getCommentSummary)
router.get('/portfolio-insights', getPortfolioInsights)

export default router
