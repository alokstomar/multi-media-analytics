import { Router } from 'express'
import {
  generateLinkedIn, generateTwitter, generateInstagram, generateThreads,
  repurpose, improveContent,
  createPost, getPosts, getPublishedPosts, getPost, updatePost, deletePost,
  getCalendar,
  getAccounts, connectAccount, disconnectAccount,
  publishPost, schedulePost,
  aiGenerateTweet, aiGenerateThread, aiAnalyzeTweet, aiTrendingTopics, aiViralOpportunities,
  getLinkedinScheduled, createLinkedinScheduled, updateLinkedinScheduled, cancelLinkedinScheduled, deleteLinkedinScheduled,
  getLinkedinQueue, retryLinkedinQueueJob, getLinkedinQueueStats,
  getLinkedinRules, createLinkedinRule, updateLinkedinRule, deleteLinkedinRule, toggleLinkedinRule,
  aiGenerateLinkedinPost, aiGenerateLinkedinThoughtLeadership, aiAnalyzeLinkedinPost, aiGetLinkedinContentIdeas, aiDiscoverLinkedinTrends, aiRepurposeLinkedinContent,
  getAIUsageStats, getQueueMetrics,
  getTwitterScheduled, createTwitterScheduled, updateTwitterScheduled, cancelTwitterScheduled, publishTwitterScheduled, deleteTwitterScheduled,
  getTwitterQueue, retryTwitterQueueJob, getTwitterQueueStats,
  getTwitterRules, createTwitterRule, updateTwitterRule, deleteTwitterRule, toggleTwitterRule, executeTwitterAutomationRule,
  getTwitterDashboardStats, getTwitterBestTimes,
} from '../controllers/studioController.js'

const router = Router()

// ── AI Content Generation ──────────────────────────────────────────────
router.post('/generate/linkedin', generateLinkedIn)
router.post('/generate/twitter', generateTwitter)
router.post('/generate/instagram', generateInstagram)
router.post('/generate/threads', generateThreads)
router.post('/generate/repurpose', repurpose)
router.post('/generate/improve', improveContent)

// ── X AI Growth Engine ─────────────────────────────────────────────────
router.post('/ai/generate-tweet', aiGenerateTweet)
router.post('/ai/generate-thread', aiGenerateThread)
router.post('/ai/analyze-tweet', aiAnalyzeTweet)
router.get('/ai/trending-topics', aiTrendingTopics)
router.get('/ai/viral-opportunities', aiViralOpportunities)


// ── Posts CRUD ─────────────────────────────────────────────────────────
router.post('/posts', createPost)
router.get('/posts', getPosts)
router.get('/posts/published', getPublishedPosts)
router.get('/posts/calendar', getCalendar)
router.get('/posts/:id', getPost)
router.put('/posts/:id', updatePost)
router.delete('/posts/:id', deletePost)

// ── Publishing ─────────────────────────────────────────────────────────
router.post('/posts/:id/publish', publishPost)
router.post('/posts/:id/schedule', schedulePost)

// ── Connected Accounts ─────────────────────────────────────────────────
router.get('/accounts', getAccounts)
router.post('/accounts', connectAccount)
router.delete('/accounts/:id', disconnectAccount)

// ── LinkedIn Phase 2 Automation Routes ─────────────────────────────────
router.get('/linkedin/scheduled', getLinkedinScheduled)
router.post('/linkedin/scheduled', createLinkedinScheduled)
router.put('/linkedin/scheduled/:id', updateLinkedinScheduled)
router.post('/linkedin/scheduled/:id/cancel', cancelLinkedinScheduled)
router.delete('/linkedin/scheduled/:id', deleteLinkedinScheduled)

router.get('/linkedin/queue', getLinkedinQueue)
router.post('/linkedin/queue/:id/retry', retryLinkedinQueueJob)
router.get('/linkedin/queue/stats', getLinkedinQueueStats)

router.get('/linkedin/rules', getLinkedinRules)
router.post('/linkedin/rules', createLinkedinRule)
router.put('/linkedin/rules/:id', updateLinkedinRule)
router.delete('/linkedin/rules/:id', deleteLinkedinRule)
router.patch('/linkedin/rules/:id/toggle', toggleLinkedinRule)

// ── LinkedIn Phase 3 AI Routes ────────────────────────────────────────
router.post('/linkedin/ai/generate-post', aiGenerateLinkedinPost)
router.post('/linkedin/ai/thought-leadership', aiGenerateLinkedinThoughtLeadership)
router.post('/linkedin/ai/analyze-post', aiAnalyzeLinkedinPost)
router.get('/linkedin/ai/content-ideas', aiGetLinkedinContentIdeas)
router.get('/linkedin/ai/discover-trends', aiDiscoverLinkedinTrends)
router.post('/linkedin/ai/repurpose', aiRepurposeLinkedinContent)

// ── Queue Metrics Dashboard ──────────────────────────────────────────
router.get('/queue/metrics', getQueueMetrics)

// ── Twitter Automation Routes ─────────────────────────────────────────
router.get('/twitter/scheduled', getTwitterScheduled)
router.post('/twitter/scheduled', createTwitterScheduled)
router.put('/twitter/scheduled/:id', updateTwitterScheduled)
router.post('/twitter/scheduled/:id/cancel', cancelTwitterScheduled)
router.post('/twitter/scheduled/:id/publish', publishTwitterScheduled)
router.delete('/twitter/scheduled/:id', deleteTwitterScheduled)


router.get('/twitter/queue', getTwitterQueue)
router.post('/twitter/queue/:id/retry', retryTwitterQueueJob)
router.get('/twitter/queue/stats', getTwitterQueueStats)

router.get('/twitter/rules', getTwitterRules)
router.post('/twitter/rules', createTwitterRule)
router.put('/twitter/rules/:id', updateTwitterRule)
router.delete('/twitter/rules/:id', deleteTwitterRule)
router.patch('/twitter/rules/:id/toggle', toggleTwitterRule)
router.post('/twitter/rules/:id/execute', executeTwitterAutomationRule)

router.get('/twitter/dashboard-stats', getTwitterDashboardStats)
router.get('/twitter/best-times', getTwitterBestTimes)

// ── AI Usage Dashboard ────────────────────────────────────────────────
router.get('/ai/usage-stats', getAIUsageStats)

export default router
