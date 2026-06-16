import { Router } from 'express'
import { getAnalytics, getInsights } from '../controllers/analyticsController.js'

const router = Router()

router.get('/:id', getAnalytics)         // GET /api/analytics/:id
router.get('/:id/insights', getInsights) // GET /api/analytics/:id/insights

export default router
