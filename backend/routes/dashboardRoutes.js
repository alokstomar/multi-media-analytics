import { Router } from 'express'
import { getDashboard } from '../controllers/dashboardController.js'

const router = Router()

// GET /api/dashboard/:channelId
router.get('/:channelId', getDashboard)

export default router
