import { Router } from 'express'
import { getVideos } from '../controllers/videoController.js'

const router = Router()

// GET /api/channels/:id/videos?page=1&limit=20&refresh=true
router.get('/:id/videos', getVideos)

export default router
