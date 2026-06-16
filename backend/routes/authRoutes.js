import express from 'express'
import {
  signup,
  login,
  logout,
  me,
  verifyEmail,
  forgotPassword,
  resetPassword
} from '../controllers/authController.js'
import { requireAuth } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.post('/signup', signup)
router.post('/login', login)
router.post('/logout', logout)
router.post('/verify-email', verifyEmail)
router.post('/forgot-password', forgotPassword)
router.post('/reset-password', resetPassword)
router.get('/me', requireAuth, me)

export default router
