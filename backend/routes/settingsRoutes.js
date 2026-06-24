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

export default router
