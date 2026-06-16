import { Router } from 'express'
import {
  addChannel,
  getChannels,
  getChannel,
  refreshChannel,
  deleteChannel,
} from '../controllers/channelController.js'
import { channelCommentRouter } from '../routes/commentRoutes.js'

const router = Router()

router.post('/', addChannel)           // POST /api/channels          { input }
router.get('/', getChannels)           // GET  /api/channels
router.get('/:id', getChannel)         // GET  /api/channels/:id
router.post('/:id/refresh', refreshChannel) // POST /api/channels/:id/refresh
router.delete('/:id', deleteChannel)   // DELETE /api/channels/:id
router.use('/:id/comments', channelCommentRouter)

export default router
