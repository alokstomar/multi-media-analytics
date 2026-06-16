import { Router } from 'express'
import {
  schedulePost,
  cancelScheduledPost,
  reschedulePost,
  getMetrics,
  getJobs,
  retryJob,
} from '../controllers/schedulerController.js'

const router = Router()

// ── Scheduling ─────────────────────────────────────────────────────────
router.post('/post', schedulePost)
router.post('/cancel', cancelScheduledPost)
router.post('/reschedule', reschedulePost)
router.post('/retry', retryJob)

// ── Monitoring ─────────────────────────────────────────────────────────
router.get('/metrics', getMetrics)
router.get('/jobs', getJobs)

export default router
