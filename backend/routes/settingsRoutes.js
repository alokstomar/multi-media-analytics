import { Router } from 'express'
import {
  getProfile,
  updateProfile,
  uploadAvatar,
  removeAvatar,
  getSessions,
  revokeSession,
  revokeAllOtherSessions,
  updatePassword,
  getIntegrations,
  updateIntegration,
  getApiKey,
  regenerateApiKey,
  getAIUsage,
  updateAIBudgets,
  getAIUsageHistory,
} from '../controllers/settingsController.js'

const router = Router()

// All routes require authentication (requireAuth applied in server.js).
// Profile is user-level, NOT workspace-level — no requireWorkspace needed.

router.get('/profile', getProfile)
router.patch('/profile', updateProfile)
router.post('/avatar', uploadAvatar)
router.delete('/avatar', removeAvatar)

// Active session tracking & security routes
router.get('/sessions', getSessions)
router.delete('/sessions/:sessionId', revokeSession)
router.delete('/sessions', revokeAllOtherSessions)
router.post('/password', updatePassword)

// Integrations & API Access routes
router.get('/integrations', getIntegrations)
router.patch('/integrations/:platform', updateIntegration)
router.get('/api-key', getApiKey)
router.post('/api-key/regenerate', regenerateApiKey)

// AI Growth Usage & Budgets routes
router.get('/ai-usage', getAIUsage)
router.patch('/ai-usage/budgets', updateAIBudgets)
router.get('/ai-usage/history', getAIUsageHistory)

export default router
