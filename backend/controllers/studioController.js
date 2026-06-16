import mongoose from 'mongoose'
import Post from '../models/Post.js'
import ConnectedAccount from '../models/ConnectedAccount.js'
import ScheduledPost from '../models/ScheduledPost.js'
import PublishingJob from '../models/PublishingJob.js'
import PublishedPost from '../models/PublishedPost.js'
import { getAIProvider } from '../services/ai/index.js'
import { AppError } from '../utils/errorHandler.js'
import { LinkedinProvider } from '../providers/linkedinProvider.js'
import { TwitterProvider } from '../providers/twitterProvider.js'
import AIGeneration from '../models/ai_generations.js'
import AISuggestion from '../models/ai_suggestions.js'
import TrendSnapshot from '../models/trend_snapshots.js'
import * as linkedinSchedulerService from '../services/linkedinSchedulerService.js'
import * as linkedinQueueService from '../services/linkedinQueueService.js'
import * as linkedinAutomationService from '../services/linkedinAutomationService.js'
import * as twitterSchedulerService from '../services/twitterSchedulerService.js'
import * as twitterQueueService from '../services/twitterQueueService.js'
import * as twitterAutomationService from '../services/twitterAutomationService.js'
import { executeTwitterRule } from '../jobs/workers/twitterAutomationWorker.js'
import LinkedinAIGeneration from '../models/linkedinAIGenerations.js'
import LinkedinContentIdea from '../models/linkedinContentIdeas.js'
import LinkedinTrendSnapshot from '../models/linkedinTrendSnapshots.js'
import AIUsageLog from '../models/AIUsageLog.js'
import AIResponseCache from '../models/AIResponseCache.js'
import * as queueService from '../services/queue/queueService.js'
import { getQueueMetrics as fetchQueueMetrics } from '../services/queue/queueMetrics.js'


const linkedin = new LinkedinProvider()
const twitter = new TwitterProvider()
const providers = { linkedin, twitter }

function withMeta(result, feature) {
  return {
    ...result,
    meta: { ...result.meta, feature, requestedAt: new Date().toISOString() },
  }
}

// ── AI Content Generation ──────────────────────────────────────────────

export async function generateLinkedIn(req, res, next) {
  try {
    const result = await getAIProvider().generateLinkedInPost(req.body, { feature: 'generate-linkedin' })
    res.json(withMeta(result, 'generate-linkedin'))
  } catch (err) { next(err) }
}

export async function generateTwitter(req, res, next) {
  try {
    const result = await getAIProvider().generateTwitterPost(req.body, { feature: 'generate-twitter' })
    res.json(withMeta(result, 'generate-twitter'))
  } catch (err) { next(err) }
}

export async function generateInstagram(req, res, next) {
  try {
    const result = await getAIProvider().generateInstagramContent(req.body, { feature: 'generate-instagram' })
    res.json(withMeta(result, 'generate-instagram'))
  } catch (err) { next(err) }
}

export async function generateThreads(req, res, next) {
  try {
    const result = await getAIProvider().generateThreadsPost(req.body, { feature: 'generate-threads' })
    res.json(withMeta(result, 'generate-threads'))
  } catch (err) { next(err) }
}

export async function repurpose(req, res, next) {
  try {
    const result = await getAIProvider().repurposeContent(req.body, { feature: 'repurpose-content' })
    res.json(withMeta(result, 'repurpose-content'))
  } catch (err) { next(err) }
}

export async function improveContent(req, res, next) {
  try {
    const result = await getAIProvider().improveContent(req.body, { feature: 'improve-content' })
    res.json(withMeta(result, 'improve-content'))
  } catch (err) { next(err) }
}

// ── Post CRUD ──────────────────────────────────────────────────────────

export async function createPost(req, res, next) {
  try {
    const post = await Post.create({ ...req.body, workspaceId: req.workspaceId })
    res.status(201).json({ success: true, data: post })
  } catch (err) { next(err) }
}

export async function getPosts(req, res, next) {
  try {
    const { status, platform, limit = 50 } = req.query
    let query = Post.find({ workspaceId: req.workspaceId }).sort({ createdAt: -1 })
    if (status) query = query.where('status', status)
    if (platform) query = query.where('platform', platform)
    const posts = await query.limit(Number(limit)).lean()
    res.json({ success: true, data: posts })
  } catch (err) { next(err) }
}

export async function getPost(req, res, next) {
  try {
    const post = await Post.findOne({ _id: req.params.id, workspaceId: req.workspaceId }).lean()
    if (!post) throw new AppError('Post not found', 404)
    res.json({ success: true, data: post })
  } catch (err) { next(err) }
}

export async function updatePost(req, res, next) {
  try {
    const post = await Post.findOneAndUpdate(
      { _id: req.params.id, workspaceId: req.workspaceId },
      req.body,
      { new: true, runValidators: true }
    ).lean()
    if (!post) throw new AppError('Post not found', 404)
    res.json({ success: true, data: post })
  } catch (err) { next(err) }
}

export async function deletePost(req, res, next) {
  try {
    const post = await Post.findOneAndDelete({ _id: req.params.id, workspaceId: req.workspaceId }).lean()
    if (!post) throw new AppError('Post not found', 404)
    res.json({ success: true, data: null })
  } catch (err) { next(err) }
}

export async function getPublishedPosts(req, res, next) {
  try {
    const { platform, limit = 50 } = req.query
    const query = { workspaceId: req.workspaceId }
    if (platform) query.platform = platform
    const posts = await PublishedPost.find(query).sort({ publishedAt: -1 }).limit(Number(limit)).lean()
    res.json({ success: true, data: posts })
  } catch (err) { next(err) }
}

// ── Calendar ───────────────────────────────────────────────────────────

export async function getCalendar(req, res, next) {
  try {
    const { start, end } = req.query
    const startDate = start ? new Date(start) : new Date(Date.now() - 30 * 86400000)
    const endDate = end ? new Date(end) : new Date(Date.now() + 30 * 86400000)
    const events = await Post.getCalendarEvents(startDate, endDate, req.workspaceId)
    res.json({ success: true, data: events })
  } catch (err) { next(err) }
}

// ── Connected Accounts ─────────────────────────────────────────────────

export async function getAccounts(req, res, next) {
  try {
    const { platform } = req.query
    const accounts = await ConnectedAccount.find({
      connected: true,
      workspaceId: req.workspaceId,
      ...(platform && { platform })
    }).lean()
    res.json({ success: true, data: accounts })
  } catch (err) { next(err) }
}

export async function connectAccount(req, res, next) {
  try {
    const account = await ConnectedAccount.findOneAndUpdate(
      { platform: req.body.platform, platformAccountId: req.body.platformAccountId, workspaceId: req.workspaceId },
      { ...req.body, connected: true, workspaceId: req.workspaceId },
      { upsert: true, new: true, runValidators: true },
    ).lean()
    res.json({ success: true, data: account })
  } catch (err) { next(err) }
}

export async function disconnectAccount(req, res, next) {
  try {
    await ConnectedAccount.findOneAndUpdate(
      { _id: req.params.id, workspaceId: req.workspaceId },
      { connected: false }
    )
    res.json({ success: true, data: null })
  } catch (err) { next(err) }
}

// ── Publishing (Preparation Layer) ─────────────────────────────────────

export async function publishPost(req, res, next) {
  try {
    const post = await Post.findOne({ _id: req.params.id, workspaceId: req.workspaceId })
    if (!post) throw new AppError('Post not found', 404)
    if (post.status === 'published') throw new AppError('Post already published', 400)

    post.status = 'publishing'
    await post.save()

    // 1. Create a PublishingJob record in MongoDB for state tracking
    const jobRecord = await PublishingJob.create({
      post: post._id,
      platform: post.platform,
      status: 'processing',
      runAt: new Date(),
      workspaceId: req.workspaceId
    })

    // 2. Delegate execution to modern Queue Service
    await queueService.publishNow({
      postId: post._id,
      platform: post.platform,
      publishingJobId: jobRecord._id
    })

    res.json({ success: true, data: post.toObject() })
  } catch (err) { next(err) }
}

export async function schedulePost(req, res, next) {
  try {
    const post = await Post.findOne({ _id: req.params.id, workspaceId: req.workspaceId })
    if (!post) throw new AppError('Post not found', 404)

    const { scheduledAt } = req.body
    if (!scheduledAt) throw new AppError('scheduledAt is required', 400)

    const scheduleDate = new Date(scheduledAt)

    post.status = 'scheduled'
    post.scheduledAt = scheduleDate
    await post.save()

    // 1. Create a ScheduledPost record
    const scheduledRecord = await ScheduledPost.create({
      post: post._id,
      platform: post.platform,
      scheduledAt: scheduleDate,
      status: 'pending',
      workspaceId: req.workspaceId
    })

    // 2. Create a PublishingJob record in the database
    const jobRecord = await PublishingJob.create({
      post: post._id,
      platform: post.platform,
      scheduledPost: scheduledRecord._id,
      status: 'pending',
      runAt: scheduleDate,
      workspaceId: req.workspaceId
    })

    scheduledRecord.publishJob = jobRecord._id
    await scheduledRecord.save()

    // 3. Delegate to BullMQ / fallback queue service
    await queueService.schedulePublish({
      postId: post._id,
      platform: post.platform,
      scheduledAt: scheduleDate,
      scheduledPostId: scheduledRecord._id,
      publishingJobId: jobRecord._id
    })

    res.json({ success: true, data: post.toObject() })
  } catch (err) { next(err) }
}

export async function getQueueMetrics(req, res, next) {
  try {
    const metrics = await fetchQueueMetrics()
    res.json({ success: true, data: metrics })
  } catch (err) { next(err) }
}

// ── X AI Growth Engine Controller Methods ─────────────────────────────

export async function aiGenerateTweet(req, res, next) {
  try {
    const { topic, audience, tone, goal } = req.body
    const result = await getAIProvider().generateTweet(topic, audience, tone, goal)
    
    // Save to database
    await AIGeneration.create({
      prompt: `topic: ${topic}, audience: ${audience}, tone: ${tone}, goal: ${goal}`,
      response: result,
      platform: 'twitter'
    })
    
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function aiGenerateThread(req, res, next) {
  try {
    const { topic, count, style } = req.body
    const result = await getAIProvider().generateThread(topic, count, style)
    
    // Save to database
    await AIGeneration.create({
      prompt: `topic: ${topic}, count: ${count}, style: ${style}`,
      response: result,
      platform: 'twitter'
    })
    
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function aiAnalyzeTweet(req, res, next) {
  try {
    const { text } = req.body
    const result = await getAIProvider().analyzeTweet(text)
    
    // Save to database
    await AISuggestion.create({
      prompt: text,
      response: result,
      platform: 'twitter'
    })
    
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function aiTrendingTopics(req, res, next) {
  try {
    const { category = 'AI' } = req.query
    const result = await getAIProvider().findTrendingTopics(category)
    
    // Save snapshot
    await TrendSnapshot.create({
      prompt: `Trending topics for category: ${category}`,
      response: result,
      platform: 'twitter'
    })
    
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function aiViralOpportunities(req, res, next) {
  try {
    const { category = 'AI' } = req.query
    const result = await getAIProvider().generateContentIdeas(category)
    
    // Save suggestion
    await AISuggestion.create({
      prompt: `Viral opportunities for category: ${category}`,
      response: result,
      platform: 'twitter'
    })
    
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
}

// ── LinkedIn Phase 2 Automation Suite Controller Methods ──────────────

export async function getLinkedinScheduled(req, res, next) {
  try {
    const list = await linkedinSchedulerService.getScheduledPosts(req.workspaceId)
    res.json({ success: true, data: list })
  } catch (err) { next(err) }
}

export async function createLinkedinScheduled(req, res, next) {
  try {
    const post = await linkedinSchedulerService.schedulePost(req.body, req.workspaceId)
    res.status(201).json({ success: true, data: post })
  } catch (err) { next(err) }
}

export async function updateLinkedinScheduled(req, res, next) {
  try {
    const post = await linkedinSchedulerService.updateScheduledPost(req.params.id, req.body, req.workspaceId)
    res.json({ success: true, data: post })
  } catch (err) { next(err) }
}

export async function cancelLinkedinScheduled(req, res, next) {
  try {
    const post = await linkedinSchedulerService.cancelScheduledPost(req.params.id, req.workspaceId)
    res.json({ success: true, data: post })
  } catch (err) { next(err) }
}

export async function deleteLinkedinScheduled(req, res, next) {
  try {
    await linkedinSchedulerService.deleteScheduledPost(req.params.id, req.workspaceId)
    res.json({ success: true, data: null })
  } catch (err) { next(err) }
}

// Queue
export async function getLinkedinQueue(req, res, next) {
  try {
    const list = await linkedinQueueService.getPublishingJobs(req.workspaceId)
    res.json({ success: true, data: list })
  } catch (err) { next(err) }
}

export async function retryLinkedinQueueJob(req, res, next) {
  try {
    const job = await linkedinQueueService.retryPublishingJob(req.params.id, req.workspaceId)
    res.json({ success: true, data: job })
  } catch (err) { next(err) }
}

export async function getLinkedinQueueStats(req, res, next) {
  try {
    const stats = await linkedinQueueService.getQueueHealthStats(req.workspaceId)
    res.json({ success: true, data: stats })
  } catch (err) { next(err) }
}

// Rules
export async function getLinkedinRules(req, res, next) {
  try {
    const list = await linkedinAutomationService.getAutomationRules(req.workspaceId)
    res.json({ success: true, data: list })
  } catch (err) { next(err) }
}

export async function createLinkedinRule(req, res, next) {
  try {
    const rule = await linkedinAutomationService.createAutomationRule(req.body, req.workspaceId)
    res.status(201).json({ success: true, data: rule })
  } catch (err) { next(err) }
}

export async function updateLinkedinRule(req, res, next) {
  try {
    const rule = await linkedinAutomationService.updateAutomationRule(req.params.id, req.body, req.workspaceId)
    res.json({ success: true, data: rule })
  } catch (err) { next(err) }
}

export async function deleteLinkedinRule(req, res, next) {
  try {
    await linkedinAutomationService.deleteAutomationRule(req.params.id, req.workspaceId)
    res.json({ success: true, data: null })
  } catch (err) { next(err) }
}

export async function toggleLinkedinRule(req, res, next) {
  try {
    const rule = await linkedinAutomationService.toggleRuleStatus(req.params.id, req.workspaceId)
    res.json({ success: true, data: rule })
  } catch (err) { next(err) }
}

// ── Twitter Automation Suite Controller Methods ───────────────────────

export async function getTwitterScheduled(req, res, next) {
  try {
    const list = await twitterSchedulerService.getScheduledTweets(req.workspaceId)
    res.json({ success: true, data: list })
  } catch (err) { next(err) }
}

export async function createTwitterScheduled(req, res, next) {
  try {
    const post = await twitterSchedulerService.scheduleTweet(req.body, req.workspaceId)
    res.status(201).json({ success: true, data: post })
  } catch (err) { next(err) }
}

export async function updateTwitterScheduled(req, res, next) {
  try {
    const post = await twitterSchedulerService.updateScheduledTweet(req.params.id, req.body, req.workspaceId)
    res.json({ success: true, data: post })
  } catch (err) { next(err) }
}

export async function cancelTwitterScheduled(req, res, next) {
  try {
    const post = await twitterSchedulerService.cancelScheduledTweet(req.params.id, req.workspaceId)
    res.json({ success: true, data: post })
  } catch (err) { next(err) }
}

export async function publishTwitterScheduled(req, res, next) {
  try {
    const scheduledTweet = await mongoose.model('ScheduledTweet').findOne({ _id: req.params.id, workspaceId: req.workspaceId })
    if (!scheduledTweet) throw new Error('Scheduled tweet not found')

    let usernameClean = scheduledTweet.account?.replace('@', '').trim()
    let account = await mongoose.model('TwitterAccount').findOne({
      workspaceId: req.workspaceId,
      username: new RegExp(`^${usernameClean}$`, 'i'),
      connectionStatus: 'connected'
    }).select('+accessToken +refreshToken')

    if (!account) {
      account = await mongoose.model('TwitterAccount').findOne({
        workspaceId: req.workspaceId,
        connectionStatus: 'connected'
      }).select('+accessToken +refreshToken')
    }

    if (!account) throw new Error('No connected Twitter account found')

    const { TwitterPublishingProvider } = await import('../services/publishing/twitterProvider.js')
    const provider = new TwitterPublishingProvider()
    const publishStart = Date.now()
    const result = await provider.publishPost({
      _id: scheduledTweet._id,
      content: {
        fullText: scheduledTweet.content,
        thread: scheduledTweet.threadPosts
      }
    }, account)
    const executionDurationMs = Date.now() - publishStart

    if (result.success) {
      const tweetId = result.platformPostId
      const tweetUrl = `https://x.com/${account.username}/status/${tweetId}`

      scheduledTweet.status = 'completed'
      scheduledTweet.publishedAt = new Date()
      scheduledTweet.twitterTweetId = tweetId
      scheduledTweet.twitterTweetUrl = tweetUrl
      await scheduledTweet.save()

      // Also create a PublishedPost record
      await PublishedPost.create({
        platform: 'twitter',
        accountId: account._id.toString(),
        content: scheduledTweet.content,
        providerPostId: result.platformPostId,
        status: 'published',
        publishedAt: new Date(),
        responsePayload: result.platformResponse,
        workspaceId: req.workspaceId,
        publishSource: 'mongodb_fallback',
        executionDurationMs
      })

      res.json({ success: true, data: scheduledTweet })
    } else {
      scheduledTweet.status = 'failed'
      scheduledTweet.error = result.error
      await scheduledTweet.save()
      throw new Error(result.error)
    }
  } catch (err) { next(err) }
}

export async function deleteTwitterScheduled(req, res, next) {
  try {
    await twitterSchedulerService.deleteScheduledTweet(req.params.id, req.workspaceId)
    res.json({ success: true, data: null })
  } catch (err) { next(err) }
}

// Queue
export async function getTwitterQueue(req, res, next) {
  try {
    const list = await twitterQueueService.getPublishingJobs(req.workspaceId)
    res.json({ success: true, data: list })
  } catch (err) { next(err) }
}

export async function retryTwitterQueueJob(req, res, next) {
  try {
    const job = await twitterQueueService.retryPublishingJob(req.params.id, req.workspaceId)
    res.json({ success: true, data: job })
  } catch (err) { next(err) }
}

export async function getTwitterQueueStats(req, res, next) {
  try {
    const stats = await twitterQueueService.getQueueHealthStats(req.workspaceId)
    res.json({ success: true, data: stats })
  } catch (err) { next(err) }
}

// Rules
export async function getTwitterRules(req, res, next) {
  try {
    const list = await twitterAutomationService.getAutomationRules(req.workspaceId)
    res.json({ success: true, data: list })
  } catch (err) { next(err) }
}

export async function createTwitterRule(req, res, next) {
  try {
    const rule = await twitterAutomationService.createAutomationRule(req.body, req.workspaceId)
    res.status(201).json({ success: true, data: rule })
  } catch (err) { next(err) }
}

export async function updateTwitterRule(req, res, next) {
  try {
    const rule = await twitterAutomationService.updateAutomationRule(req.params.id, req.body, req.workspaceId)
    res.json({ success: true, data: rule })
  } catch (err) { next(err) }
}

export async function deleteTwitterRule(req, res, next) {
  try {
    await twitterAutomationService.deleteAutomationRule(req.params.id, req.workspaceId)
    res.json({ success: true, data: null })
  } catch (err) { next(err) }
}

export async function toggleTwitterRule(req, res, next) {
  try {
    const rule = await twitterAutomationService.toggleRuleStatus(req.params.id, req.workspaceId)
    res.json({ success: true, data: rule })
  } catch (err) { next(err) }
}

export async function executeTwitterAutomationRule(req, res, next) {
  try {
    const result = await executeTwitterRule(req.params.id, req.workspaceId)
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
}

// Dashboard stats
export async function getTwitterDashboardStats(req, res, next) {
  try {
    const workspaceId = req.workspaceId

    // Total tweets = published tweets + completed scheduled tweets
    const publishedCount = await PublishedPost.countDocuments({ platform: 'twitter', workspaceId })
    const completedScheduledCount = await mongoose.model('ScheduledTweet').countDocuments({ status: 'completed', workspaceId })
    const totalTweets = publishedCount + completedScheduledCount

    // Scheduled posts count
    const scheduledPosts = await mongoose.model('ScheduledTweet').countDocuments({ status: 'pending', workspaceId })

    // Active automations count
    const activeAutomations = await mongoose.model('AutomationRule').countDocuments({ status: 'Active', workspaceId })

    // Engagement Forecast logic: derived dynamically from execution history success rates
    const totalExecs = await mongoose.model('TwitterAutomationExecution').countDocuments({ workspaceId })
    const successExecs = await mongoose.model('TwitterAutomationExecution').countDocuments({ status: 'success', workspaceId })
    const rate = totalExecs > 0 ? (successExecs / totalExecs) * 100 : 100
    let forecast = 'Stable'
    if (rate > 90) forecast = 'Growth'
    else if (rate > 75) forecast = 'Steady'
    else if (rate > 50) forecast = 'Warning'

    res.json({
      success: true,
      data: {
        totalTweets,
        scheduledPosts,
        activeAutomations,
        forecast
      }
    })
  } catch (err) { next(err) }
}

// Best posting times
export async function getTwitterBestTimes(req, res, next) {
  try {
    const workspaceId = req.workspaceId
    const published = await PublishedPost.find({ platform: 'twitter', workspaceId }).select('publishedAt').lean()

    // Default Heatmap fallback
    const defaultHeatmap = {
      Mon: [40, 55, 75, 60, 65, 88, 70, 45],
      Tue: [45, 60, 80, 65, 70, 92, 75, 50],
      Wed: [50, 65, 85, 70, 75, 95, 80, 55],
      Thu: [48, 62, 82, 68, 72, 94, 78, 52],
      Fri: [42, 58, 78, 62, 85, 90, 82, 60],
      Sat: [30, 40, 50, 55, 60, 72, 85, 65],
      Sun: [35, 45, 55, 60, 65, 80, 90, 70]
    }

    const defaultBestWindows = [
      { day: 'Wednesdays', time: '6:00 PM', score: 95, competition: 'Low', reason: 'High professional mid-week activity overlap.' },
      { day: 'Tuesdays', time: '6:00 PM', score: 92, competition: 'Medium', reason: 'Highest click-through rates for case studies.' },
      { day: 'Thursdays', time: '6:00 PM', score: 94, competition: 'Low', reason: 'Optimal bookmarking and sharing volume peaks.' }
    ]

    if (published.length === 0) {
      return res.json({ success: true, data: { heatmap: defaultHeatmap, bestWindows: defaultBestWindows } })
    }

    // Dynamic heatmap generation: group by day of week and hour slots (8 AM, 10 AM, 12 PM, 2 PM, 4 PM, 6 PM, 8 PM, 10 PM)
    const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const heatmap = {
      Mon: [0,0,0,0,0,0,0,0],
      Tue: [0,0,0,0,0,0,0,0],
      Wed: [0,0,0,0,0,0,0,0],
      Thu: [0,0,0,0,0,0,0,0],
      Fri: [0,0,0,0,0,0,0,0],
      Sat: [0,0,0,0,0,0,0,0],
      Sun: [0,0,0,0,0,0,0,0]
    }

    for (const post of published) {
      if (!post.publishedAt) continue
      const date = new Date(post.publishedAt)
      let dayIndex = date.getDay() - 1 // getDay() is 0 (Sun) to 6 (Sat)
      if (dayIndex === -1) dayIndex = 6 // Map Sun to 6
      const dayName = DAYS[dayIndex]
      const hour = date.getHours()

      // map 24h to nearest slot: 8, 10, 12, 14, 16, 18, 20, 22
      let slotIndex = 0
      if (hour >= 22 || hour < 8) slotIndex = 7
      else if (hour >= 20) slotIndex = 6
      else if (hour >= 18) slotIndex = 5
      else if (hour >= 16) slotIndex = 4
      else if (hour >= 14) slotIndex = 3
      else if (hour >= 12) slotIndex = 2
      else if (hour >= 10) slotIndex = 1
      else slotIndex = 0

      heatmap[dayName][slotIndex] += 1
    }

    // Normalize heatmap values to 10-100 scale for UI rendering
    let maxCount = 0
    for (const day of DAYS) {
      for (let i = 0; i < 8; i++) {
        if (heatmap[day][i] > maxCount) maxCount = heatmap[day][i]
      }
    }

    if (maxCount > 0) {
      for (const day of DAYS) {
        for (let i = 0; i < 8; i++) {
          const raw = heatmap[day][i]
          // scale raw count to [10, 100], if 0 make it a baseline value (e.g. 20)
          heatmap[day][i] = raw === 0 ? 20 : Math.round(10 + (raw / maxCount) * 90)
        }
      }
    } else {
      Object.assign(heatmap, defaultHeatmap)
    }

    res.json({ success: true, data: { heatmap, bestWindows: defaultBestWindows } })
  } catch (err) { next(err) }
}

// ── LinkedIn Phase 3 AI Growth Engine Controller Methods ─────────────

export async function aiGenerateLinkedinPost(req, res, next) {
  try {
    const { topic, industry, audience, goal, tone } = req.body
    const result = await getAIProvider().generateLinkedInPost(topic, industry, audience, goal, tone)
    
    // Save to database
    await LinkedinAIGeneration.create({
      prompt: `topic: ${topic}, industry: ${industry}, audience: ${audience}, goal: ${goal}, tone: ${tone}`,
      response: result,
      type: 'post-generation',
      workspaceId: req.workspaceId
    })
    
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function aiGenerateLinkedinThoughtLeadership(req, res, next) {
  try {
    const { topic, category } = req.body
    const result = await getAIProvider().generateThoughtLeadership(topic, category)
    
    // Save to database
    await LinkedinAIGeneration.create({
      prompt: `topic: ${topic}, category: ${category}`,
      response: result,
      type: 'thought-leadership',
      workspaceId: req.workspaceId
    })
    
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function aiAnalyzeLinkedinPost(req, res, next) {
  try {
    const { text } = req.body
    const result = await getAIProvider().analyzeLinkedInPost(text)
    
    // Save to database
    await LinkedinAIGeneration.create({
      prompt: text,
      response: result,
      type: 'post-analysis',
      workspaceId: req.workspaceId
    })
    
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function aiGetLinkedinContentIdeas(req, res, next) {
  try {
    const { category = 'AI' } = req.query
    const result = await getAIProvider().generateContentIdeas(category)
    
    // Save to database
    await LinkedinContentIdea.create({
      prompt: `Content ideas for category: ${category}`,
      response: result,
      type: 'idea-suggestions',
      workspaceId: req.workspaceId
    })
    
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function aiDiscoverLinkedinTrends(req, res, next) {
  try {
    const { category = 'AI' } = req.query
    const result = await getAIProvider().discoverIndustryTrends(category)
    
    // Save snapshot
    await LinkedinTrendSnapshot.create({
      prompt: `Trend snapshot for category: ${category}`,
      response: result,
      type: 'trend-snapshots',
      workspaceId: req.workspaceId
    })
    
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function aiRepurposeLinkedinContent(req, res, next) {
  try {
    const { sourceText, targetFormat } = req.body
    const result = await getAIProvider().repurposeContent(sourceText, targetFormat)
    
    // Save to database
    await LinkedinAIGeneration.create({
      prompt: `repurpose source: ${sourceText.substring(0, 100)}, format: ${targetFormat}`,
      response: result,
      type: 'repurposed-generation',
      workspaceId: req.workspaceId
    })
    
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
}

// ── AI Usage Statistics Dashboard ─────────────────────────────────────

export async function getAIUsageStats(req, res, next) {
  try {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfWeek = new Date(now)
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
    startOfWeek.setHours(0, 0, 0, 0)

    const workspaceObjectId = new mongoose.Types.ObjectId(req.workspaceId)

    // Aggregate daily, weekly, monthly spend and token usage
    const [dailyAgg, weeklyAgg, monthlyAgg] = await Promise.all([
      AIUsageLog.aggregate([
        { $match: { workspaceId: workspaceObjectId, createdAt: { $gte: startOfDay } } },
        { $group: {
          _id: null,
          totalCost: { $sum: '$estimatedCost' },
          totalTokens: { $sum: '$totalTokens' },
          totalCalls: { $sum: 1 },
          cacheHits: { $sum: { $cond: ['$cacheHit', 1, 0] } },
          failures: { $sum: { $cond: ['$success', 0, 1] } }
        }}
      ]),
      AIUsageLog.aggregate([
        { $match: { workspaceId: workspaceObjectId, createdAt: { $gte: startOfWeek } } },
        { $group: {
          _id: null,
          totalCost: { $sum: '$estimatedCost' },
          totalTokens: { $sum: '$totalTokens' },
          totalCalls: { $sum: 1 },
          cacheHits: { $sum: { $cond: ['$cacheHit', 1, 0] } }
        }}
      ]),
      AIUsageLog.aggregate([
        { $match: { workspaceId: workspaceObjectId, createdAt: { $gte: startOfMonth } } },
        { $group: {
          _id: null,
          totalCost: { $sum: '$estimatedCost' },
          totalTokens: { $sum: '$totalTokens' },
          totalCalls: { $sum: 1 },
          cacheHits: { $sum: { $cond: ['$cacheHit', 1, 0] } }
        }}
      ])
    ])

    // Per-method breakdown (this month)
    const methodBreakdown = await AIUsageLog.aggregate([
      { $match: { workspaceId: workspaceObjectId, createdAt: { $gte: startOfMonth }, cacheHit: false } },
      { $group: {
        _id: '$method',
        calls: { $sum: 1 },
        totalTokens: { $sum: '$totalTokens' },
        totalCost: { $sum: '$estimatedCost' },
        avgResponseMs: { $avg: '$responseTimeMs' }
      }},
      { $sort: { totalCost: -1 } }
    ])

    // Per-model breakdown (this month)
    const modelBreakdown = await AIUsageLog.aggregate([
      { $match: { workspaceId: workspaceObjectId, createdAt: { $gte: startOfMonth }, cacheHit: false } },
      { $group: {
        _id: '$model',
        calls: { $sum: 1 },
        totalTokens: { $sum: '$totalTokens' },
        totalCost: { $sum: '$estimatedCost' }
      }},
      { $sort: { totalCost: -1 } }
    ])

    // Recent logs (last 20)
    const recentLogs = await AIUsageLog.find({ workspaceId: req.workspaceId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()

    // Cache stats
    const cacheCount = await AIResponseCache.countDocuments()

    // Budget configuration
    const dailyBudget = parseFloat(process.env.OPENAI_DAILY_BUDGET_USD) || 0
    const monthlyBudget = parseFloat(process.env.OPENAI_MONTHLY_BUDGET_USD) || 0

    const daily = dailyAgg[0] || { totalCost: 0, totalTokens: 0, totalCalls: 0, cacheHits: 0, failures: 0 }
    const weekly = weeklyAgg[0] || { totalCost: 0, totalTokens: 0, totalCalls: 0, cacheHits: 0 }
    const monthly = monthlyAgg[0] || { totalCost: 0, totalTokens: 0, totalCalls: 0, cacheHits: 0 }

    res.json({
      success: true,
      data: {
        provider: process.env.AI_PROVIDER || 'stub',
        fastModel: process.env.OPENAI_FAST_MODEL || 'gpt-4o-mini',
        premiumModel: process.env.OPENAI_PREMIUM_MODEL || 'gpt-4o',
        budget: {
          daily: { limit: dailyBudget, spent: daily.totalCost, remaining: Math.max(0, dailyBudget - daily.totalCost) },
          monthly: { limit: monthlyBudget, spent: monthly.totalCost, remaining: Math.max(0, monthlyBudget - monthly.totalCost) }
        },
        today: {
          calls: daily.totalCalls,
          tokens: daily.totalTokens,
          cost: daily.totalCost,
          cacheHits: daily.cacheHits,
          failures: daily.failures
        },
        thisWeek: {
          calls: weekly.totalCalls,
          tokens: weekly.totalTokens,
          cost: weekly.totalCost,
          cacheHits: weekly.cacheHits
        },
        thisMonth: {
          calls: monthly.totalCalls,
          tokens: monthly.totalTokens,
          cost: monthly.totalCost,
          cacheHits: monthly.cacheHits
        },
        methodBreakdown,
        modelBreakdown,
        cacheEntries: cacheCount,
        recentLogs: recentLogs.map(l => ({
          method: l.method,
          model: l.model,
          tokens: l.totalTokens,
          cost: l.estimatedCost,
          responseMs: l.responseTimeMs,
          cacheHit: l.cacheHit,
          success: l.success,
          error: l.error,
          createdAt: l.createdAt
        }))
      }
    })
  } catch (err) { next(err) }
}
