import { Router } from 'express'
import {
  listChannelComments,
  getChannelCommentsSummary,
  refreshChannelComments,
  listMultiChannelComments,
  getMultiChannelCommentsSummary,
} from '../controllers/commentController.js'

const router = Router()

// Multi-channel routes (must be before /:id)
router.get('/portfolio', listMultiChannelComments)
router.get('/portfolio/summary', getMultiChannelCommentsSummary)

// Single-channel routes mounted under /api/channels/:id/comments
export const channelCommentRouter = Router({ mergeParams: true })
channelCommentRouter.get('/', listChannelComments)
channelCommentRouter.get('/summary', getChannelCommentsSummary)
channelCommentRouter.post('/refresh', refreshChannelComments)

export default router
