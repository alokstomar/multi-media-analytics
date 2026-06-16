import mongoose from 'mongoose'
import ProviderFactory from './providerFactory.js'
import TwitterAccount from '../../models/TwitterAccount.js'
import LinkedInAccount from '../../models/LinkedInAccount.js'
import InstagramAccount from '../../models/InstagramAccount.js'
import PublishedPost from '../../models/PublishedPost.js'

let isRunning = false

export function startPublishingWorker() {
  console.log('[PublishingWorker] Initializing background publishing loop worker...')
  
  // Tick every 10 seconds to check for pending schedule times
  setInterval(async () => {
    if (isRunning) return
    isRunning = true
    
    try {
      const PublishingJob = mongoose.model('PublishingJob')
      const ScheduledPost = mongoose.model('ScheduledPost')
      const Post = mongoose.model('Post')
      const ScheduledJob = mongoose.model('ScheduledJob')

      // Query jobs whose runAt timestamp has passed
      const jobs = await PublishingJob.find({
        status: 'pending',
        runAt: { $lte: new Date() }
      }).limit(5)

      if (jobs.length > 0) {
        console.log(`[PublishingWorker] Found ${jobs.length} jobs to process.`)
      }

      for (const job of jobs) {
        const startTime = Date.now()
        console.log(`[PublishingWorker] Processing job ${job._id} for post ${job.post}`)
        job.status = 'processing'
        job.attempts += 1
        job.lastAttempt = new Date()
        await job.save()

        // Update related ScheduledJob record if exists
        let scheduledJobRecord = await ScheduledJob.findOne({ publishingJob: job._id })
        if (scheduledJobRecord) {
          scheduledJobRecord.status = 'active'
          scheduledJobRecord.executedAt = new Date()
          await scheduledJobRecord.save()
        }

        try {
          const post = await Post.findById(job.post)
          if (!post) {
            throw new Error('Post not found in database')
          }

          // 1. Update Post lifecycle status → queued
          post.status = 'queued'
          await post.save()

          const platform = job.platform?.toLowerCase()
          if (platform !== 'twitter' && platform !== 'linkedin' && platform !== 'instagram') {
            // For other platforms (e.g. instagram), fallback simulation
            console.log(`[PublishingWorker] Platform ${job.platform} has no specific provider. Using fallback simulation.`)
            await new Promise((resolve) => setTimeout(resolve, 500))
            const mockId = `mock_${job.platform}_${Date.now()}`
            const executionDurationMs = Date.now() - startTime

            job.status = 'completed'
            job.completedAt = new Date()
            await job.save()

            // Update Post status -> published
            post.status = 'published'
            post.publishedAt = new Date()
            post.platformPostId = mockId
            post.platformResponse = { simulated: true, publishedAt: new Date().toISOString() }
            await post.save()

            if (job.scheduledPost) {
              await ScheduledPost.findByIdAndUpdate(job.scheduledPost, {
                status: 'completed',
                publishedAt: new Date()
              })
            }
            if (scheduledJobRecord) {
              scheduledJobRecord.status = 'completed'
              scheduledJobRecord.completedAt = new Date()
              await scheduledJobRecord.save()
            }
            continue
          }

          // Load target account
          let account = null
          let AccountModel = null
          const accountId = scheduledJobRecord?.accountId || post.channelId

          if (!accountId) {
            const err = new Error(`No connected account ID provided for post: ${post._id}`)
            err.errorType = 'validation_error'
            throw err
          }

          if (platform === 'twitter') {
            AccountModel = TwitterAccount
            account = await AccountModel.findById(accountId).select('+accessToken +refreshToken')
          } else if (platform === 'instagram') {
            AccountModel = InstagramAccount
            const query = InstagramAccount.buildIdentifierQuery(accountId)
            account = await AccountModel.findOne(query).select('+accessToken +refreshToken')
          } else {
            AccountModel = LinkedInAccount
            account = await AccountModel.findById(accountId).select('+accessToken +refreshToken')
          }
          if (!account) {
            const err = new Error(`Connected account not found: ${accountId} on platform: ${platform}`)
            err.errorType = 'validation_error'
            throw err
          }

          // Resolve provider
          const provider = ProviderFactory.getProvider(platform)

          // Validate token and refresh if invalid
          let isTokenValid = await provider.validateAccount(account)
          if (!isTokenValid) {
            console.log(`[PublishingWorker] Access token for account ${account._id} is invalid/expired. Attempting auto-refresh...`)
            try {
              await provider.refreshToken(account)
              account = await AccountModel.findById(accountId).select('+accessToken +refreshToken')
              isTokenValid = await provider.validateAccount(account)
              if (!isTokenValid) {
                throw new Error('Auto-refresh completed but token remains invalid')
              }
            } catch (refreshErr) {
              const err = new Error(`Authentication token expired and auto-refresh failed: ${refreshErr.message}`)
              err.errorType = 'auth_error'
              throw err
            }
          }

          // 2. Update Post lifecycle status → publishing
          post.status = 'publishing'
          await post.save()

          // Publish
          const result = await provider.publishPost(post, account)
          const executionDurationMs = Date.now() - startTime

          if (result.success) {
            console.log(`[PublishingWorker] Job ${job._id} completed successfully in ${executionDurationMs}ms!`)

            // Create PublishedPost record (extended fields for Phase 4E)
            const fullTextContent = post.content.fullText || `${post.content.hook || ''}\n\n${post.content.body || ''}\n\n${post.content.cta || ''}`.trim()
            await PublishedPost.create({
              platform,
              accountId: account._id.toString(),
              content: fullTextContent,
              providerPostId: result.platformPostId,
              status: 'published',
              publishedAt: new Date(),
              responsePayload: result.platformResponse,
              scheduledJobId: scheduledJobRecord?._id,
              executionDurationMs,
              retryCount: job.attempts - 1,
              publishSource: 'mongodb_fallback',
              publishedBy: scheduledJobRecord?.createdBy || 'system',
            })

            // Update Job
            job.status = 'completed'
            job.completedAt = new Date()
            await job.save()

            // Update Post lifecycle status → published
            post.status = 'published'
            post.publishedAt = new Date()
            post.platformPostId = result.platformPostId
            post.platformResponse = result.platformResponse
            await post.save()

            // Update ScheduledPost
            if (job.scheduledPost) {
              await ScheduledPost.findByIdAndUpdate(job.scheduledPost, {
                status: 'completed',
                publishedAt: new Date()
              })
            }

            // Update ScheduledJob
            if (scheduledJobRecord) {
              scheduledJobRecord.status = 'completed'
              scheduledJobRecord.completedAt = new Date()
              scheduledJobRecord.executionDurationMs = executionDurationMs
              scheduledJobRecord.error = ''
              scheduledJobRecord.stackTrace = ''
              scheduledJobRecord.errorCode = ''
              scheduledJobRecord.errorMessage = ''
              scheduledJobRecord.errorType = ''
              scheduledJobRecord.providerResponse = result.platformResponse
              await scheduledJobRecord.save()
            }
          } else {
            const errorObj = new Error(result.error || 'Provider failed to publish')
            errorObj.errorCode = result.response?.error_code || result.response?.error || 'PUBLISH_API_ERROR'
            errorObj.errorMessage = result.error || 'Provider returned success: false'
            errorObj.errorType = result.errorType || 'provider_error'
            errorObj.providerResponse = result.response || null
            throw errorObj
          }

        } catch (err) {
          console.error(`[PublishingWorker] Job ${job._id} execution failed:`, err.message)
          job.error = err.message
          
          if (scheduledJobRecord) {
            scheduledJobRecord.retries = job.attempts
            scheduledJobRecord.error = err.message
            scheduledJobRecord.stackTrace = err.stack || ''
            scheduledJobRecord.errorCode = err.errorCode || 'WORKER_INTERNAL_ERROR'
            scheduledJobRecord.errorMessage = err.errorMessage || err.message
            scheduledJobRecord.errorType = err.errorType || 'provider_error'
            scheduledJobRecord.providerResponse = err.providerResponse || null
          }

          if (job.attempts >= job.maxAttempts) {
            job.status = 'failed'
            
            // Mark Post as failed
            await Post.findByIdAndUpdate(job.post, {
              status: 'failed',
              platformResponse: {
                error: err.message,
                errorCode: err.errorCode,
                errorMessage: err.errorMessage,
                errorType: err.errorType || 'provider_error',
                providerResponse: err.providerResponse
              }
            })
            
            // Mark ScheduledPost as failed
            if (job.scheduledPost) {
              await ScheduledPost.findByIdAndUpdate(job.scheduledPost, {
                status: 'failed',
                error: err.message
              })
            }

            if (scheduledJobRecord) {
              scheduledJobRecord.status = 'failed'
            }
          } else {
            job.status = 'pending'
            // Retry in 30 seconds
            job.runAt = new Date(Date.now() + 30 * 1000)
            console.log(`[PublishingWorker] Job rescheduled for retry at: ${job.runAt}`)
            
            if (scheduledJobRecord) {
              scheduledJobRecord.status = 'delayed'
            }
          }
          await job.save()
          if (scheduledJobRecord) {
            await scheduledJobRecord.save()
          }
        }
      }
    } catch (err) {
      console.error('[PublishingWorker] Error in background execution loop:', err)
    } finally {
      isRunning = false
    }
  }, 10000)
}
