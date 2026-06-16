import express from 'express'
import {
  getAuthUrl,
  handleCallback,
  getAccounts,
  disconnectAccount,
  refreshAccount,
  getHealth,
} from '../controllers/linkedinOAuthController.js'
import { requireAuth, requireWorkspace } from '../middlewares/authMiddleware.js'

const router = express.Router()

// Public callback
router.get('/auth/callback', handleCallback)

// Protected routes context
router.use(requireAuth, requireWorkspace)
router.get('/auth/url', getAuthUrl)
router.post('/auth/refresh', refreshAccount)
router.get('/accounts', getAccounts)
router.delete('/accounts/:id', disconnectAccount)
router.get('/oauth/health', getHealth)

export default router
