import { Router } from 'express'
import {
  listAccounts,
  addAccount,
  getAccount,
  removeAccount,
  getAccountAnalytics,
  getAccountPosts,
} from '../controllers/instagramController.js'
import {
  getAuthUrl,
  handleCallback,
  refreshAccount,
  getAccounts,
  disconnectAccount,
  getHealth,
} from '../controllers/instagramOAuthController.js'
import { requireAuth, requireWorkspace } from '../middlewares/authMiddleware.js'

// Import new integration framework services
import { analyticsService } from '../services/instagram/analyticsService.js'
import { reelsService } from '../services/instagram/reelsService.js'
import { commentsService } from '../services/instagram/commentsService.js'
import { AppError } from '../utils/errorHandler.js'

const router = Router()

// Public callback
router.get('/auth/callback', handleCallback)

// Protected routes context
router.use(requireAuth, requireWorkspace)

// ── Instagram OAuth & Connected Accounts (Phase 4F) ───────────────────
router.get('/auth/url', getAuthUrl)
router.post('/auth/refresh', refreshAccount)
router.get('/accounts', getAccounts)
router.delete('/accounts/:id', disconnectAccount)
router.get('/oauth/health', getHealth)

// ── New Instagram Integration Framework Routes ─────────────────────────
// Sync Instagram profile, reels, and comments
router.post('/sync/:username', async (req, res, next) => {
  try {
    const { username } = req.params
    const result = await analyticsService.syncAll(username, req.workspaceId)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
})

// Bulk sync Instagram profiles
router.post('/sync-bulk', async (req, res, next) => {
  try {
    const { usernames } = req.body
    if (!usernames || !Array.isArray(usernames)) {
      throw new AppError('Provide an array of usernames in the body', 400)
    }
    const result = await analyticsService.syncBulk(usernames, req.workspaceId)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
})

// Get cached or synced profile
router.get('/profile/:username', async (req, res, next) => {
  try {
    const { username } = req.params
    const force = req.query.force === 'true'
    const profile = await analyticsService.getProfile(username, req.workspaceId, force)
    res.json({ success: true, data: profile })
  } catch (err) {
    next(err)
  }
})

// Get cached or synced reels
router.get('/reels/:username', async (req, res, next) => {
  try {
    const { username } = req.params
    const force = req.query.force === 'true'
    const reels = await reelsService.getReels(username, req.workspaceId, force)
    res.json({ success: true, data: reels })
  } catch (err) {
    next(err)
  }
})

// Get cached or synced comments for a reel
router.get('/comments/:reelId', async (req, res, next) => {
  try {
    const { reelId } = req.params
    const force = req.query.force === 'true'
    const comments = await commentsService.getComments(reelId, req.workspaceId, force)
    res.json({ success: true, data: comments })
  } catch (err) {
    next(err)
  }
})

// Get analytics snapshot
router.get('/analytics/:username', async (req, res, next) => {
  try {
    const { username } = req.params
    const force = req.query.force === 'true'
    const analytics = await analyticsService.getAnalytics(username, req.workspaceId, force)
    res.json({ success: true, data: analytics })
  } catch (err) {
    next(err)
  }
})

// Manually trigger AI recommendations analysis
router.post('/recommendations/:username', async (req, res, next) => {
  try {
    const { username } = req.params
    const recommendations = await analyticsService.generateAIRecommendations(username, req.workspaceId)
    res.json({ success: true, data: recommendations })
  } catch (err) {
    next(err)
  }
})

// ── Legacy Analytics & Mock Dashboard compatibility ──────────────────
router.get('/', listAccounts)
router.post('/', addAccount)
router.get('/:id', getAccount)
router.delete('/:id', removeAccount)
router.get('/:id/analytics', getAccountAnalytics)
router.get('/:id/posts', getAccountPosts)

export default router
