import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from './config/db.js'
import TwitterAccount from './models/TwitterAccount.js'
import LinkedInAccount from './models/LinkedInAccount.js'
import Post from './models/Post.js'
import PublishedPost from './models/PublishedPost.js'
import ScheduledJob from './models/ScheduledJob.js'
import PublishingJob from './models/PublishingJob.js'
import ScheduledPost from './models/ScheduledPost.js'
import ProviderFactory from './services/publishing/providerFactory.js'
import { encrypt } from './utils/encryption.js'

async function runTests() {
  console.log('=== STARTING PUBLISHING ENGINE VERIFICATION ===\n')

  // 1. Connect to Database
  await connectDB()

  // Clean up any existing test data to avoid pollution
  await TwitterAccount.deleteMany({ username: 'test_twt_user' })
  await LinkedInAccount.deleteMany({ displayName: 'Test LI Professional' })
  await PublishedPost.deleteMany({ publishedBy: 'test_verifier' })
  await Post.deleteMany({ topic: 'test_verif_topic' })

  // 2. Seed Mock Accounts
  const encryptedToken = encrypt('mock_access_token_secret')
  const encryptedRefresh = encrypt('mock_refresh_token_secret')

  const twitterAcc = await TwitterAccount.create({
    twitterUserId: 'twt_123456',
    username: 'test_twt_user',
    displayName: 'Test Twitter User',
    accessToken: encryptedToken,
    refreshToken: encryptedRefresh,
    scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
    connectionStatus: 'connected',
    lastTokenRefreshAt: new Date()
  })
  console.log(`✓ Seeded Twitter Account: @${twitterAcc.username} (${twitterAcc._id})`)

  const linkedinAcc = await LinkedInAccount.create({
    linkedinUserId: 'urn:li:person:li_123456',
    displayName: 'Test LI Professional',
    headline: 'Software Engineer',
    accessToken: encryptedToken,
    refreshToken: encryptedRefresh,
    scopes: ['w_member_social', 'openid', 'profile'],
    connectionStatus: 'active',
    linkedinEntityType: 'profile',
    canPublish: true,
    lastTokenRefreshAt: new Date()
  })
  console.log(`✓ Seeded LinkedIn Account: ${linkedinAcc.displayName} (${linkedinAcc._id})\n`)

  // 3. Test Provider Instantiation & Health
  const twitterProvider = ProviderFactory.getProvider('twitter')
  const linkedinProvider = ProviderFactory.getProvider('linkedin')

  console.log('Testing Provider Health checks:')
  const twtHealth = await twitterProvider.providerHealth(twitterAcc)
  console.log('Twitter Health:', JSON.stringify(twtHealth, null, 2))
  if (twtHealth.status !== 'healthy') throw new Error('Twitter provider should be healthy in mock mode')

  const liHealth = await linkedinProvider.providerHealth(linkedinAcc)
  console.log('LinkedIn Health:', JSON.stringify(liHealth, null, 2))
  if (liHealth.status !== 'healthy') throw new Error('LinkedIn provider should be healthy in mock mode')
  console.log('✓ Provider Health checks verified.\n')

  // 4. Test Content Validations & ErrorType Classifications
  console.log('Testing Twitter Content Validations:')
  // Empty check
  const emptyPost = new Post({
    content: { fullText: '' },
    platform: 'twitter',
    type: 'tweet',
    topic: 'test_verif_topic'
  })
  const emptyRes = await twitterProvider.publishPost(emptyPost, twitterAcc)
  console.log('Empty Text Response:', emptyRes)
  if (emptyRes.success || emptyRes.errorType !== 'validation_error') {
    throw new Error('Expected validation_error for empty text')
  }

  // Too long tweet check
  const longPost = new Post({
    content: { fullText: 'a'.repeat(281) },
    platform: 'twitter',
    type: 'tweet',
    topic: 'test_verif_topic'
  })
  const longRes = await twitterProvider.publishPost(longPost, twitterAcc)
  console.log('Long Text Response:', longRes)
  if (longRes.success || longRes.errorType !== 'validation_error') {
    throw new Error('Expected validation_error for tweet exceeding 280 characters')
  }

  console.log('Testing LinkedIn Content Validations:')
  const longLiPost = new Post({
    content: { fullText: 'a'.repeat(3001) },
    platform: 'linkedin',
    type: 'thought-leadership',
    topic: 'test_verif_topic'
  })
  const longLiRes = await linkedinProvider.publishPost(longLiPost, linkedinAcc)
  console.log('Long LinkedIn Text Response:', longLiRes)
  if (longLiRes.success || longLiRes.errorType !== 'validation_error') {
    throw new Error('Expected validation_error for LinkedIn post exceeding 3000 characters')
  }
  console.log('✓ Content validation & error classification signatures verified.\n')

  // 5. Test Simulated Failures and Error Classifications
  console.log('Testing Simulated Platform Exceptions:')
  const failingPost = new Post({
    content: { fullText: 'This will fail.' },
    platform: 'twitter',
    type: 'tweet',
    topic: 'test_verif_topic fail' // triggers simulated failure in mock mode
  })
  const failingRes = await twitterProvider.publishPost(failingPost, twitterAcc)
  console.log('Simulated Failure Response:', failingRes)
  if (failingRes.success || failingRes.errorType !== 'rate_limit') {
    throw new Error('Expected rate_limit errorType for simulated failure')
  }

  const failingLiPost = new Post({
    content: { fullText: 'This will fail on LinkedIn.' },
    platform: 'linkedin',
    type: 'thought-leadership',
    topic: 'test_verif_topic fail' // triggers simulated failure in mock mode
  })
  const failingLiRes = await linkedinProvider.publishPost(failingLiPost, linkedinAcc)
  console.log('Simulated LinkedIn Failure Response:', failingLiRes)
  if (failingLiRes.success || failingLiRes.errorType !== 'auth_error') {
    throw new Error('Expected auth_error errorType for simulated LinkedIn failure')
  }
  console.log('✓ Exception classification verified.\n')

  // 6. Test End-To-End Fallback Worker Loop (Simulated Job Processing)
  console.log('Testing End-to-End Fallback Worker Job processing:')
  const targetPost = await Post.create({
    channelId: twitterAcc._id,
    platform: 'twitter',
    type: 'tweet',
    content: { fullText: 'E2E Validation Tweet for Phase 4E.' },
    status: 'draft',
    topic: 'test_verif_topic'
  })

  const schedPost = await ScheduledPost.create({
    post: targetPost._id,
    platform: 'twitter',
    scheduledAt: new Date(Date.now() - 5000), // scheduled in the past to run immediately
    status: 'pending'
  })

  const pubJob = await PublishingJob.create({
    post: targetPost._id,
    platform: 'twitter',
    scheduledPost: schedPost._id,
    status: 'pending',
    runAt: new Date(Date.now() - 5000)
  })

  schedPost.publishJob = pubJob._id
  await schedPost.save()

  const schedJob = await ScheduledJob.create({
    platform: 'twitter',
    accountId: twitterAcc._id.toString(),
    jobType: 'twitter-post',
    content: 'E2E Validation Tweet for Phase 4E.',
    scheduledFor: new Date(Date.now() - 5000),
    status: 'waiting',
    publishingJob: pubJob._id,
    createdBy: 'test_verifier',
    postId: targetPost._id.toString()
  })

  console.log(`Created Job ${pubJob._id} and ScheduledJob ${schedJob._id} for Post ${targetPost._id}`)

  // Manually trigger a polling worker cycle execution
  // We'll mimic the worker loop logic in worker.js using the actual imported provider pipeline
  const job = await PublishingJob.findById(pubJob._id)
  const startTime = Date.now()
  job.status = 'processing'
  job.attempts += 1
  job.lastAttempt = new Date()
  await job.save()

  schedJob.status = 'active'
  schedJob.executedAt = new Date()
  await schedJob.save()

  // 1. Lifecycle: Post status → queued
  targetPost.status = 'queued'
  await targetPost.save()
  console.log(`- Post lifecycle updated: ${targetPost.status}`)

  const platform = job.platform.toLowerCase()
  const provider = ProviderFactory.getProvider(platform)
  const account = await TwitterAccount.findById(job.post ? twitterAcc._id : null).select('+accessToken +refreshToken')

  // 2. Lifecycle: Post status → publishing
  targetPost.status = 'publishing'
  await targetPost.save()
  console.log(`- Post lifecycle updated: ${targetPost.status}`)

  const result = await provider.publishPost(targetPost, account)
  const executionDurationMs = Date.now() - startTime

  if (result.success) {
    // 3. Create PublishedPost
    const publishedPostRecord = await PublishedPost.create({
      platform,
      accountId: account._id.toString(),
      content: targetPost.content.fullText,
      providerPostId: result.platformPostId,
      status: 'published',
      publishedAt: new Date(),
      responsePayload: result.platformResponse,
      scheduledJobId: schedJob._id,
      executionDurationMs,
      retryCount: job.attempts - 1,
      publishSource: 'mongodb_fallback',
      publishedBy: schedJob.createdBy || 'system'
    })

    console.log(`✓ PublishedPost Created in Database: ${publishedPostRecord._id}`)
    console.log(`- executionDurationMs: ${publishedPostRecord.executionDurationMs}ms`)
    console.log(`- retryCount: ${publishedPostRecord.retryCount}`)
    console.log(`- publishSource: ${publishedPostRecord.publishSource}`)
    console.log(`- publishedBy: ${publishedPostRecord.publishedBy}`)

    // Update Job
    job.status = 'completed'
    job.completedAt = new Date()
    await job.save()

    // 4. Lifecycle: Post status → published
    targetPost.status = 'published'
    targetPost.publishedAt = new Date()
    targetPost.platformPostId = result.platformPostId
    targetPost.platformResponse = result.platformResponse
    await targetPost.save()
    console.log(`- Post lifecycle updated: ${targetPost.status}`)

    // Update ScheduledPost
    await ScheduledPost.findByIdAndUpdate(schedPost._id, {
      status: 'completed',
      publishedAt: new Date()
    })

    // Update ScheduledJob
    schedJob.status = 'completed'
    schedJob.completedAt = new Date()
    schedJob.executionDurationMs = executionDurationMs
    schedJob.providerResponse = result.platformResponse
    await schedJob.save()
    console.log('✓ ScheduledJob and ScheduledPost updated successfully.')
  } else {
    throw new Error('E2E validation job execution failed unexpectedly')
  }

  // 7. Verify E2E Database State
  const verifiedPost = await Post.findById(targetPost._id)
  const verifiedPubPost = await PublishedPost.findOne({ scheduledJobId: schedJob._id })
  const verifiedSchedJob = await ScheduledJob.findById(schedJob._id)

  if (verifiedPost.status !== 'published') throw new Error('Post status is not published')
  if (!verifiedPubPost) throw new Error('PublishedPost record missing')
  if (verifiedSchedJob.status !== 'completed') throw new Error('ScheduledJob status is not completed')

  console.log('\n=== ALL TESTS PASSED SUCCESSFULLY ===')
  
  // Clean up
  await TwitterAccount.findByIdAndDelete(twitterAcc._id)
  await LinkedInAccount.findByIdAndDelete(linkedinAcc._id)
  await PublishedPost.findByIdAndDelete(verifiedPubPost._id)
  await Post.findByIdAndDelete(targetPost._id)
  await ScheduledPost.findByIdAndDelete(schedPost._id)
  await PublishingJob.findByIdAndDelete(pubJob._id)
  await ScheduledJob.findByIdAndDelete(schedJob._id)

  mongoose.disconnect()
}

runTests().catch(err => {
  console.error('\n❌ TEST RUN ENCOUNTERED AN ERROR:', err)
  mongoose.disconnect()
  process.exit(1)
})
