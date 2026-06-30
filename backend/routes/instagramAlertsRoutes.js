/**
 * Instagram alerts router.
 *
 * Mounted at /api/instagram/alerts in server.js. Auth + workspace context is
 * applied at the router level so every route below inherits it.
 *
 *   GET   /                         → listAlerts
 *   POST  /refresh                  → refreshAlerts
 *   POST  /:id/read                 → markRead
 *   POST  /read-all                 → markAllRead
 */

import { Router } from 'express'
import { requireAuth, requireWorkspace } from '../middlewares/authMiddleware.js'
import {
  listAlerts,
  refreshAlerts,
  markRead,
  markAllRead,
} from '../controllers/instagramAlertsController.js'

const router = Router()

// All IG alerts routes require authentication + workspace binding.
router.use(requireAuth, requireWorkspace)

router.get('/', listAlerts)
router.post('/refresh', refreshAlerts)
router.post('/read-all', markAllRead)
router.post('/:id/read', markRead)

export default router
