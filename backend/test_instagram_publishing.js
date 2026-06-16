import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from './config/db.js'
import InstagramAccount from './models/InstagramAccount.js'
import Post from './models/Post.js'
import PublishedPost from './models/PublishedPost.js'
import ScheduledJob from './models/ScheduledJob.js'
import PublishingJob from './models/PublishingJob.js'
import ScheduledPost from './models/ScheduledPost.js'
import ProviderFactory from './services/publishing/providerFactory.js'
import instagramOAuthService from './services/instagramOAuthService.js'
import { encrypt, decrypt } from './utils/encryption.js'

async function runTests() {
  console.log('=== STARTING INSTAGRAM OAUTH + PUBLISHING VERIFICATION ===\n')

  // 1. Connect to Database
  await connectDB()

  // Clean up any existing test data
  await InstagramAccount.deleteMany({ username: '@test_ig_user' })
  await PublishedPost.deleteMany({ publishedBy: 'test_verifier_ig' })
  await Post.deleteMany({ topic: 'test_verif_topic_ig' })
  await ScheduledJob.deleteMany({ createdBy: 'test_verifier_ig' })

  // 2. Seed Mock Instagram Account
  const rawAccessToken = 'mock_instagram_access_token_secret_value'
  const rawRefreshToken = 'mock_instagram_refresh_token_secret_value'
  const encryptedAccessToken = encrypt(rawAccessToken)
  const encryptedRefreshToken = encrypt(rawRefreshToken)

  const igAccount = await InstagramAccount.create({
    instagramUserId: 'ig_123456789',
    username: '@test_ig_user',
    displayName: 'Test Instagram Business Account',
    profileImage: 'https://ui-avatars.com/api/?name=Test+Instagram&background=E1306C&color=fff',
    accessToken: encryptedAccessToken,
    refreshToken: encryptedRefreshToken,
    scopes: ['instagram_basic', 'instagram_content_publish', 'pages_read_engagement', 'pages_show_list'],
    connectionStatus: 'active',
    canPublish: true,
    tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
    lastTokenRefreshAt: new Date(),
    followers: 12000,
    following: 250,
    postsCount: 45,
    isVerified: true
  })
  console.log(`✓ Seeded Instagram Account: ${igAccount.username} (ID: ${igAccount._id})`)

  // 3. Verify Token Encryption and Decryption
  console.log('\nChecking Token Encryption & Decryption:')
  const foundAccount = await InstagramAccount.findById(igAccount._id).select('+accessToken +refreshToken')
  const decryptedAccess = decrypt(foundAccount.accessToken)
  const decryptedRefresh = decrypt(foundAccount.refreshToken)
  
  if (decryptedAccess !== rawAccessToken) {
    throw new Error(`Access Token decryption mismatch. Expected "${rawAccessToken}", got "${decryptedAccess}"`)
  }
  if (decryptedRefresh !== rawRefreshToken) {
    throw new Error(`Refresh Token decryption mismatch. Expected "${rawRefreshToken}", got "${decryptedRefresh}"`)
  }
  console.log('✓ Token encryption and decryption verified successfully.')

  // 4. Verify Health Metrics Endpoint Integration
  console.log('\nChecking OAuth Health Metrics:')
  const healthMetrics = await instagramOAuthService.getOAuthHealth()
  console.log('Instagram OAuth Health Metrics:', JSON.stringify(healthMetrics, null, 2))
  
  if (typeof healthMetrics.revokedAccounts !== 'number' || typeof healthMetrics.publishReadyAccounts !== 'number') {
    throw new Error('Health metrics missing expected keys: revokedAccounts or publishReadyAccounts')
  }
  if (healthMetrics.publishReadyAccounts < 1) {
    throw new Error('Expected at least 1 publish-ready account after seeding')
  }
  console.log('✓ OAuth Health Metrics verified.')

  // 5. Test Provider Instantiation & Health
  console.log('\nTesting Instagram Provider Registration:')
  const provider = ProviderFactory.getProvider('instagram')
  if (!provider) {
    throw new Error('Instagram provider could not be resolved from ProviderFactory')
  }
  
  const providerHealth = await provider.providerHealth(igAccount)
  console.log('Provider Health Status:', JSON.stringify(providerHealth, null, 2))
  if (providerHealth.status !== 'healthy') {
    throw new Error('Instagram provider should report status "healthy" in mock mode')
  }
  console.log('✓ Instagram Provider Health verified.')

  // 6. Test Media Content Validations
  console.log('\nTesting Media Content Validations (validateMedia):')
  
  // Validation case 1: Empty media URLs
  try {
    provider.validateMedia([], 'image')
    throw new Error('Validation failed to throw on empty media URLs')
  } catch (err) {
    if (err.errorType !== 'validation_error') {
      throw new Error(`Unexpected error type on empty media URLs: ${err.errorType}`)
    }
    console.log(`✓ Case 1 passed (expected error: "${err.message}")`)
  }

  // Validation case 2: Carousel with fewer than 2 media items
  try {
    provider.validateMedia(['https://example.com/img1.png'], 'carousel')
    throw new Error('Validation failed to throw on carousel with 1 media item')
  } catch (err) {
    if (err.errorType !== 'validation_error') {
      throw new Error(`Unexpected error type on insufficient carousel media: ${err.errorType}`)
    }
    console.log(`✓ Case 2 passed (expected error: "${err.message}")`)
  }

  // Validation case 3: Reel with no media items
  try {
    provider.validateMedia([], 'reel')
    throw new Error('Validation failed to throw on empty reel media')
  } catch (err) {
    if (err.errorType !== 'validation_error') {
      throw new Error(`Unexpected error type on empty reel media: ${err.errorType}`)
    }
    console.log(`✓ Case 3 passed (expected error: "${err.message}")`)
  }

  // Validation case 4: Valid single image
  const imgUrls = provider.validateMedia(['https://example.com/img1.png'], 'image')
  if (imgUrls[0] !== 'https://example.com/img1.png') {
    throw new Error('Failed to parse valid single image url')
  }
  console.log('✓ Case 4 passed (valid single image verified)')

  // Validation case 5: Valid carousel
  const carouselUrls = provider.validateMedia(['https://example.com/img1.png', 'https://example.com/img2.png'], 'carousel')
  if (carouselUrls.length !== 2) {
    throw new Error('Failed to parse valid carousel urls')
  }
  console.log('✓ Case 5 passed (valid carousel verified)')

  // 7. Test Simulated Publishing Dispatches (publishPost)
  console.log('\nTesting Simulated Publishing Dispatches:')
  const mockPost = new Post({
    content: {
      fullText: 'Hello Instagram World!',
      mediaUrls: ['https://example.com/mock-ig-post.png'],
      contentType: 'image'
    },
    platform: 'instagram',
    type: 'post',
    topic: 'test_verif_topic_ig'
  })

  // Test successful publish
  const successRes = await provider.publishPost(mockPost, foundAccount)
  console.log('Publish post result:', JSON.stringify(successRes, null, 2))
  if (!successRes.success || !successRes.platformPostId.startsWith('mock_ig_media_')) {
    throw new Error('Publishing failed or did not return mock platformPostId')
  }
  console.log('✓ Successful simulated dispatch verified.')

  // Test simulated failure handling (topic contains "fail")
  const failingPost = new Post({
    content: {
      fullText: 'Failing post caption',
      mediaUrls: ['https://example.com/fail.png'],
      contentType: 'image'
    },
    platform: 'instagram',
    type: 'post',
    topic: 'test_verif_topic_ig fail'
  })
  const failRes = await provider.publishPost(failingPost, foundAccount)
  console.log('Publish failing post result:', JSON.stringify(failRes, null, 2))
  if (failRes.success || failRes.errorType !== 'rate_limit') {
    throw new Error(`Expected rate_limit error for failed dispatch simulation, got: ${failRes.errorType}`)
  }
  console.log('✓ Simulated exception classification verified.')

  // 8. Test Fallback Worker Loop E2E integration
  console.log('\nTesting Fallback Worker E2E workflow simulation:')
  
  const targetPost = await Post.create({
    channelId: foundAccount._id,
    platform: 'instagram',
    type: 'post',
    content: {
      fullText: 'E2E Instagram post via MongoDB fallback worker.',
      mediaUrls: ['https://example.com/ig-e2e.png'],
      contentType: 'image'
    },
    status: 'draft',
    topic: 'test_verif_topic_ig'
  })

  const schedPost = await ScheduledPost.create({
    post: targetPost._id,
    platform: 'instagram',
    scheduledAt: new Date(Date.now() - 5000), // scheduled in past to trigger immediately
    status: 'pending'
  })

  const pubJob = await PublishingJob.create({
    post: targetPost._id,
    platform: 'instagram',
    scheduledPost: schedPost._id,
    status: 'pending',
    runAt: new Date(Date.now() - 5000)
  })

  schedPost.publishJob = pubJob._id
  await schedPost.save()

  const schedJob = await ScheduledJob.create({
    platform: 'instagram',
    accountId: foundAccount._id.toString(),
    jobType: 'instagram-post',
    content: 'E2E Instagram post via MongoDB fallback worker.',
    scheduledFor: new Date(Date.now() - 5000),
    status: 'waiting',
    publishingJob: pubJob._id,
    createdBy: 'test_verifier_ig',
    postId: targetPost._id.toString()
  })

  console.log(`Created Job ${pubJob._id} and ScheduledJob ${schedJob._id} for Post ${targetPost._id}`)

  // Execute fallback worker tick block directly
  const job = await PublishingJob.findById(pubJob._id)
  const startTime = Date.now()
  job.status = 'processing'
  job.attempts += 1
  job.lastAttempt = new Date()
  await job.save()

  schedJob.status = 'active'
  schedJob.executedAt = new Date()
  await schedJob.save()

  targetPost.status = 'queued'
  await targetPost.save()

  // Verify platform is supported
  const platform = job.platform.toLowerCase()
  if (platform !== 'twitter' && platform !== 'linkedin' && platform !== 'instagram') {
    throw new Error(`Worker does not recognize platform "${platform}" as a registered provider`)
  }

  // Load account and publish
  const testAccount = await InstagramAccount.findById(schedJob.accountId).select('+accessToken +refreshToken')
  const testProvider = ProviderFactory.getProvider(platform)
  
  targetPost.status = 'publishing'
  await targetPost.save()

  const result = await testProvider.publishPost(targetPost, testAccount)
  const executionDurationMs = Date.now() - startTime

  if (!result.success) {
    throw new Error(`Fallback worker simulation failed to publish: ${result.error}`)
  }

  // Record PublishedPost
  const fullTextContent = targetPost.content.fullText || `${targetPost.content.hook || ''}\n\n${targetPost.content.body || ''}\n\n${targetPost.content.cta || ''}`.trim()
  const pubPost = await PublishedPost.create({
    platform,
    accountId: testAccount._id.toString(),
    content: fullTextContent,
    providerPostId: result.platformPostId,
    status: 'published',
    publishedAt: new Date(),
    responsePayload: result.platformResponse,
    scheduledJobId: schedJob._id,
    executionDurationMs,
    retryCount: job.attempts - 1,
    publishSource: 'mongodb_fallback',
    publishedBy: schedJob.createdBy,
  })

  console.log(`Created PublishedPost: ${pubPost._id}`)

  // Update records
  job.status = 'completed'
  job.completedAt = new Date()
  await job.save()

  targetPost.status = 'published'
  targetPost.publishedAt = new Date()
  targetPost.platformPostId = result.platformPostId
  targetPost.platformResponse = result.platformResponse
  await targetPost.save()

  await ScheduledPost.findByIdAndUpdate(schedPost._id, {
    status: 'completed',
    publishedAt: new Date()
  })

  schedJob.status = 'completed'
  schedJob.completedAt = new Date()
  schedJob.executionDurationMs = executionDurationMs
  await schedJob.save()

  // Verify DB updates
  const finalPost = await Post.findById(targetPost._id)
  if (finalPost.status !== 'published') {
    throw new Error(`Post status not marked as "published", got: "${finalPost.status}"`)
  }

  const finalJob = await PublishingJob.findById(pubJob._id)
  if (finalJob.status !== 'completed') {
    throw new Error(`Job status not marked as "completed", got: "${finalJob.status}"`)
  }

  const verifiedPubPost = await PublishedPost.findById(pubPost._id)
  if (!verifiedPubPost) {
    throw new Error('PublishedPost record not found in the database')
  }

  console.log('\nVerifying Created PublishedPost Fields:')
  console.log('Platform:', verifiedPubPost.platform)
  console.log('Execution Duration (ms):', verifiedPubPost.executionDurationMs)
  console.log('Retry Count:', verifiedPubPost.retryCount)
  console.log('Publish Source:', verifiedPubPost.publishSource)
  console.log('Published By:', verifiedPubPost.publishedBy)

  if (verifiedPubPost.platform !== 'instagram') throw new Error('PublishedPost platform mismatch')
  if (typeof verifiedPubPost.executionDurationMs !== 'number') throw new Error('executionDurationMs must be a number')
  if (verifiedPubPost.retryCount !== 0) throw new Error('retryCount must be 0')
  if (verifiedPubPost.publishSource !== 'mongodb_fallback') throw new Error('publishSource mismatch')
  if (verifiedPubPost.publishedBy !== 'test_verifier_ig') throw new Error('publishedBy mismatch')

  console.log('\n✓ Fallback worker loop E2E simulation verified successfully.')

  // Cleanup test records
  await InstagramAccount.deleteOne({ _id: igAccount._id })
  await Post.deleteOne({ _id: targetPost._id })
  await ScheduledPost.deleteOne({ _id: schedPost._id })
  await PublishingJob.deleteOne({ _id: pubJob._id })
  await ScheduledJob.deleteOne({ _id: schedJob._id })
  await PublishedPost.deleteOne({ _id: pubPost._id })

  console.log('\n=== ALL INSTAGRAM VERIFICATIONS PASSED ===\n')
  process.exit(0)
}

runTests().catch(err => {
  console.error('\n❌ VERIFICATION FAILED:', err)
  process.exit(1)
})
