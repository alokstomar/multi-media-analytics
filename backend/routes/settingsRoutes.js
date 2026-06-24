import { Router } from 'express'
import {
  getProfile,
  updateProfile,
  uploadAvatar,
  removeAvatar,
} from '../controllers/settingsController.js'

const router = Router()

// All routes require authentication (requireAuth applied in server.js).
// Profile is user-level, NOT workspace-level — no requireWorkspace needed.

router.get('/profile', getProfile)
router.patch('/profile', updateProfile)
router.post('/avatar', uploadAvatar)
router.delete('/avatar', removeAvatar)

export default router
