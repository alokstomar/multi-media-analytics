import { Worker } from 'bullmq'
import { getRedisClient, checkRedisAvailable } from '../../config/redis.js'
import mongoose from 'mongoose'
import AutomationRule from '../../models/automationRules.js'
import TwitterAccount from '../../models/TwitterAccount.js'
import ScheduledTweet from '../../models/scheduledTweets.js'
import PublishingJobTwitter from '../../models/publishingJobs.js'
import TwitterAutomationExecution from '../../models/twitterAutomationExecution.js'
import { getAIProvider } from '../../services/ai/index.js'
import { TwitterPublishingProvider } from '../../services/publishing/twitterProvider.js'

const twitterProvider = new TwitterPublishingProvider()
let worker = null

/**
 * Execute a single Twitter automation rule.
 * 
 * Flow:
 * 1. Find Automation Rule
 * 2. Resolve Twitter Account
 * 3. Generate content via OpenAI/Stub provider
 * 4. Create ScheduledTweet record
 * 5. Create PublishingJobTwitter record
 * 6. Publish via Twitter provider with 3x retry loop & exponential backoff
 * 7. Store execution logs & update statuses
 */
export async function executeTwitterRule(ruleId, workspaceId) {
  const startTime = Date.now()
  console.log(`[TwitterAutomationWorker] Starting execution for rule: ${ruleId} in workspace: ${workspaceId}`)

  const rule = await AutomationRule.findOne({ _id: ruleId, workspaceId })
  if (!rule) {
    throw new Error(`Automation rule not found: ${ruleId}`)
  }

  // Resolve account
  let usernameClean = rule.targetAccount?.replace('@', '').trim()
  let account = await TwitterAccount.findOne({
    workspaceId,
    username: new RegExp(`^${usernameClean}$`, 'i'),
    connectionStatus: 'connected'
  }).select('+accessToken +refreshToken')

  // Fallback to any connected Twitter account in the workspace if exact username match fails
  if (!account) {
    account = await TwitterAccount.findOne({
      workspaceId,
      connectionStatus: 'connected'
    }).select('+accessToken +refreshToken')
  }

  if (!account) {
    const errorMsg = `No connected Twitter account found for rule: ${rule.name}`
    console.error(`[TwitterAutomationWorker] ${errorMsg}`)
    
    // Log failure
    await TwitterAutomationExecution.create({
      ruleId,
      accountId: new mongoose.Types.ObjectId(), // placeholder
      status: 'failed',
      errorMessage: errorMsg,
      workspaceId
    })
    return { success: false, error: errorMsg }
  }

  let scheduledTweet = null
  let publishingJob = null
  let status = 'failed'
  let errorMessage = ''
  let tweetId = null
  let tweetUrl = ''

  try {
    // Generate content based on rule type
    let contentText = ''
    let threadList = []
    
    if (rule.type === 'thread') {
      const res = await getAIProvider().generateThread(rule.name || rule.trigger, 3, 'Storytelling')
      if (res && res.thread) {
        threadList = res.thread
        contentText = `🧵 Thread (${threadList.length} posts): ${threadList[0]?.substring(0, 60)}...`
      } else {
        threadList = [
          `1/ Let's dive into ${rule.name || 'growth playbooks'}. Here is a short guide:`,
          `2/ Keep iterating on feedback metrics, and build custom automated loops.`,
          `3/ Share this with your developer circles if you found value!`
        ]
        contentText = `🧵 Thread (${threadList.length} posts): ${threadList[0].substring(0, 60)}...`
      }
    } else {
      const res = await getAIProvider().generateTweet(rule.name || rule.trigger, 'X audience', 'Viral', 'Engagement')
      contentText = res?.tweet || (typeof res === 'string' ? res : `Consistency yields social compounding. Rule trigger: ${rule.trigger} 🚀`)
    }

    // Create Scheduled Tweet
    scheduledTweet = await ScheduledTweet.create({
      content: contentText,
      type: rule.type === 'thread' ? 'thread' : 'tweet',
      threadPosts: threadList,
      scheduledAt: new Date(),
      account: `@${account.username}`,
      status: 'pending',
      workspaceId
    })

    // Create Publishing Job
    publishingJob = await PublishingJobTwitter.create({
      tweet: scheduledTweet._id,
      platform: 'twitter',
      scheduledTime: new Date(),
      status: 'processing',
      workspaceId
    })

    // Validate account token
    let isTokenValid = await twitterProvider.validateAccount(account)
    if (!isTokenValid) {
      console.log(`[TwitterAutomationWorker] Token expired for @${account.username}. Attempting auto-refresh...`)
      await twitterProvider.refreshToken(account)
      account = await TwitterAccount.findById(account._id).select('+accessToken +refreshToken')
    }

    // Publish tweet with 3x retry & exponential backoff
    let attempts = 0
    const maxAttempts = 3
    let publishResult = null
    let apiLatencyMs = 0

    while (attempts < maxAttempts) {
      attempts++
      try {
        console.log(`[TwitterAutomationWorker] Publishing attempt ${attempts}/${maxAttempts} for post ${scheduledTweet._id}`)
        const publishStart = Date.now()
        publishResult = await twitterProvider.publishPost({
          _id: scheduledTweet._id,
          content: {
            fullText: scheduledTweet.content,
            thread: scheduledTweet.threadPosts
          },
          topic: rule.name
        }, account)
        apiLatencyMs += (Date.now() - publishStart)

        if (publishResult && publishResult.success) {
          break
        } else {
          errorMessage = publishResult?.error || 'Provider returned success: false'
        }
      } catch (err) {
        errorMessage = err.message
      }

      if (attempts < maxAttempts) {
        // Backoff: 2s, 4s
        const backoffMs = 1000 * Math.pow(2, attempts)
        console.log(`[TwitterAutomationWorker] Attempt ${attempts} failed. Retrying in ${backoffMs}ms...`)
        await new Promise(resolve => setTimeout(resolve, backoffMs))
      }
    }

    if (publishResult && publishResult.success) {
      status = 'success'
      tweetId = publishResult.platformPostId
      tweetUrl = `https://x.com/${account.username}/status/${tweetId}`
      
      scheduledTweet.status = 'completed'
      scheduledTweet.publishedAt = new Date()
      scheduledTweet.twitterTweetId = tweetId
      scheduledTweet.twitterTweetUrl = tweetUrl
      await scheduledTweet.save()

      publishingJob.status = 'published'
      await publishingJob.save()

      console.log(`[TwitterAutomationWorker] Rule ${rule.name} executed successfully. Tweet URL: ${tweetUrl}`)
    } else {
      status = 'failed'
      
      scheduledTweet.status = 'failed'
      scheduledTweet.error = errorMessage
      await scheduledTweet.save()

      publishingJob.status = 'failed'
      publishingJob.errorLog = errorMessage
      await publishingJob.save()

      console.error(`[TwitterAutomationWorker] Rule ${rule.name} failed to publish after 3 attempts. Error: ${errorMessage}`)
    }

  } catch (err) {
    status = 'failed'
    errorMessage = err.message
    console.error(`[TwitterAutomationWorker] Rule execution crashed: ${err.message}`)
    
    if (scheduledTweet) {
      scheduledTweet.status = 'failed'
      scheduledTweet.error = err.message
      await scheduledTweet.save()
    }
    if (publishingJob) {
      publishingJob.status = 'failed'
      publishingJob.errorLog = err.message
      await publishingJob.save()
    }
  }

  const executionDurationMs = Date.now() - startTime

  // Store Execution Log
  const executionLog = await TwitterAutomationExecution.create({
    ruleId,
    accountId: account._id,
    tweetId: scheduledTweet ? scheduledTweet._id : null,
    tweetUrl,
    executionTime: new Date(),
    status,
    errorMessage: status === 'failed' ? errorMessage : '',
    workspaceId,
    responsePayload: publishResult ? (publishResult.success ? publishResult.platformResponse : publishResult.response) : null,
    apiLatencyMs,
    publishedAt: status === 'success' ? new Date() : null
  })

  return {
    success: status === 'success',
    executionId: executionLog._id,
    durationMs: executionDurationMs,
    tweetUrl,
    errorMessage
  }
}

/**
 * Start the BullMQ Twitter automation worker if Redis is available.
 */
export function startTwitterAutomationWorker() {
  const isRedis = checkRedisAvailable()
  if (!isRedis) {
    console.log('[TwitterAutomationWorker] Redis is NOT available. Twitter automation worker running in on-demand mode.')
    return null
  }

  const connection = getRedisClient()
  console.log('[TwitterAutomationWorker] Initializing BullMQ Twitter automation worker...')

  worker = new Worker('twitter-automation', async (job) => {
    const { ruleId, workspaceId } = job.data
    return await executeTwitterRule(ruleId, workspaceId)
  }, { connection })

  worker.on('completed', (job) => {
    console.log(`[TwitterAutomationWorker] Queue job ${job.id} completed.`)
  })

  worker.on('failed', (job, err) => {
    console.error(`[TwitterAutomationWorker] Queue job ${job?.id} failed: ${err.message}`)
  })

  return worker
}

/**
 * Gracefully close the worker connection.
 */
export async function closeTwitterAutomationWorker() {
  if (worker) {
    await worker.close()
    worker = null
  }
}
