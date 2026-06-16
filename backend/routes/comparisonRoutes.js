import { Router } from 'express'
import { compareChannels } from '../controllers/comparisonController.js'

const router = Router()

// POST /api/compare  { channelIds: ["UC...", "UC..."] }
router.post('/', compareChannels)

export default router
