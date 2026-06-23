import { Router } from 'express'
import {
  healthCheck,
  analyzeTitle,
  analyzeThumbnail,
  analyzeScript,
  generateVideoIdeas,
  generateShortsIdeas,
  getContentGaps,
  getStrategistTips,
  predictPerformance,
  summarizeAlerts,
} from '../controllers/intelligenceController.js'

const router = Router()

router.get('/health', healthCheck)

// Channel-scoped intelligence
router.post('/:channelId/ideas', generateVideoIdeas)
router.post('/:channelId/shorts-ideas', generateShortsIdeas)
router.post('/:channelId/content-gaps', getContentGaps)
router.post('/:channelId/strategist', getStrategistTips)
router.post('/:channelId/predict-performance', predictPerformance)
router.post('/:channelId/alerts-summary', summarizeAlerts)

// Input-scoped analysis (no channel required)
router.post('/analyze/title', analyzeTitle)
router.post('/analyze/thumbnail', analyzeThumbnail)
router.post('/analyze/script', analyzeScript)

export default router
