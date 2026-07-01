import { Router } from 'express'
import {
  addAccount,
  listAccounts,
  deleteAccount,
  syncAccount,
  getAccountStatus,
} from '../controllers/instagramAccountController.js'
import { requireAuth, requireWorkspace } from '../middlewares/authMiddleware.js'

import { analyticsService } from '../services/instagram/analyticsService.js'
import { reelsService } from '../services/instagram/reelsService.js'
import { commentsService } from '../services/instagram/commentsService.js'
import { AppError } from '../utils/errorHandler.js'

const router = Router()

router.use(requireAuth, requireWorkspace)

// ── Account lifecycle (username-based) ───────────────────────────────
router.post('/accounts/:username', addAccount)
router.get('/accounts', listAccounts)
router.delete('/accounts/:username', deleteAccount)
router.post('/accounts/:username/sync', syncAccount)
router.get('/accounts/:username/status', getAccountStatus)

// ── Sync + read endpoints (existing) ────────────────────────────────
router.post('/sync/:username', async (req, res, next) => {
  try {
    const { username } = req.params
    const result = await analyticsService.syncAll(username, req.workspaceId)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
})

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

router.post('/recommendations/:username', async (req, res, next) => {
  try {
    const { username } = req.params
    const recommendations = await analyticsService.generateAIRecommendations(username, req.workspaceId)
    res.json({ success: true, data: recommendations })
  } catch (err) {
    next(err)
  }
})

export default router
