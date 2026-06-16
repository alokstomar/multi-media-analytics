import { Router } from 'express'
import {
  getPortfolioSummary,
  getAudienceOverlap,
  getCrossPromotion,
  getPortfolioContentGaps,
  getCannibalization,
  getPortfolioStrategist,
} from '../controllers/portfolioController.js'

const router = Router()

router.post('/summary', getPortfolioSummary)
router.post('/audience-overlap', getAudienceOverlap)
router.post('/cross-promotion', getCrossPromotion)
router.post('/content-gaps', getPortfolioContentGaps)
router.post('/cannibalization', getCannibalization)
router.post('/strategist', getPortfolioStrategist)

export default router
