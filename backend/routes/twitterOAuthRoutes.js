import express from 'express'
import {
  getAuthUrl,
  handleCallback,
  getAccounts,
  disconnectAccount,
  refreshAccount,
  getHealth,
  verifyAccount,
} from '../controllers/twitterOAuthController.js'
import { requireAuth, requireWorkspace } from '../middlewares/authMiddleware.js'

const router = express.Router()

// Public debug env
router.get('/auth/debug-env', (req, res) => {
  res.json({
    clientId: process.env.TWITTER_CLIENT_ID,
    clientSecret: process.env.TWITTER_CLIENT_SECRET,
    publishingMode: process.env.PUBLISHING_MODE
  })
})

// Public callback
router.get('/auth/callback', handleCallback)

// Protected routes context
router.use(requireAuth, requireWorkspace)
router.get('/auth/url', getAuthUrl)
router.post('/auth/refresh', refreshAccount)
router.get('/accounts', getAccounts)
router.get('/accounts/verify', verifyAccount)
router.delete('/accounts/:id', disconnectAccount)
router.get('/oauth/health', getHealth)

export default router
