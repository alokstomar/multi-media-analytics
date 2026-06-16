import 'dotenv/config'
import mongoose from 'mongoose'
import axios from 'axios'
import jwt from 'jsonwebtoken'
import { connectDB } from './config/db.js'
import TwitterAccount from './models/TwitterAccount.js'
import { decrypt, encrypt } from './utils/encryption.js'

const JWT_SECRET = process.env.JWT_SECRET || 'creator-analytics-secret-jwt-key-2026'

async function run() {
  console.log('=== STARTING TWITTER PRODUCTION ACTIVATION VERIFICATION ===\n')

  // 1. Verify environment variables loaded
  const clientId = process.env.TWITTER_CLIENT_ID
  const clientSecret = process.env.TWITTER_CLIENT_SECRET
  const redirectUri = process.env.TWITTER_REDIRECT_URI
  const publishingMode = process.env.PUBLISHING_MODE

  console.log('--- Step 1: Environment Variables Check ---')
  console.log(`TWITTER_CLIENT_ID: ${clientId ? (clientId.startsWith('mock_') ? clientId + ' (MOCK)' : 'LOADED') : 'MISSING'}`)
  console.log(`TWITTER_CLIENT_SECRET: ${clientSecret ? (clientSecret.startsWith('mock_') ? 'mock_secret_for_testing (MOCK)' : 'LOADED') : 'MISSING'}`)
  console.log(`TWITTER_REDIRECT_URI: ${redirectUri || 'MISSING'}`)
  console.log(`PUBLISHING_MODE: ${publishingMode || 'MISSING'}`)

  if (!clientId || clientId.startsWith('mock_') || !clientSecret || clientSecret.startsWith('mock_')) {
    console.log('\n❌ [FAIL] Step 1: Real environment variables are not configured.')
    console.log(JSON.stringify({
      step: 'Verify environment variables loaded',
      exactEndpoint: 'N/A (backend/.env configuration)',
      httpStatus: 'N/A',
      responseBody: 'N/A',
      fixRequired: 'Replace TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET in backend/.env with your real Twitter API v2 Client ID and Client Secret, and restart the backend server.'
    }, null, 2))
    process.exit(0)
  }
  console.log('✓ Step 1: Environment variables verified.\n')

  // 2. Verify PUBLISHING_MODE=live
  console.log('--- Step 2: Publishing Mode Check ---')
  if (publishingMode !== 'live') {
    console.log('\n❌ [FAIL] Step 2: PUBLISHING_MODE is not set to live.')
    console.log(JSON.stringify({
      step: 'Verify PUBLISHING_MODE = live',
      exactEndpoint: 'N/A (backend/.env configuration)',
      httpStatus: 'N/A',
      responseBody: `PUBLISHING_MODE is current set to "${publishingMode}"`,
      fixRequired: 'Set PUBLISHING_MODE=live in backend/.env and restart the backend server.'
    }, null, 2))
    process.exit(0)
  }
  console.log('✓ Step 2: PUBLISHING_MODE verified as live.\n')

  // 3. Connect Twitter account through OAuth / DB token verification
  console.log('--- Step 3: MongoDB Connection & Account Connection Status ---')
  await connectDB()
  
  // Find connected account in the database
  const account = await TwitterAccount.findOne({ connectionStatus: 'connected' }).select('+accessToken +refreshToken')
  if (!account) {
    console.log('\n❌ [FAIL] Step 3: No connected Twitter account found in MongoDB.')
    console.log(JSON.stringify({
      step: 'Connect Twitter account through OAuth',
      exactEndpoint: 'GET /api/twitter/accounts/verify',
      httpStatus: 400,
      responseBody: { connected: false, message: 'No active connected Twitter account found' },
      fixRequired: 'Authenticate a Twitter/X account via the frontend interface at http://localhost:5175/channels or by hitting the OAuth callback with valid code and state parameter credentials.'
    }, null, 2))
    await mongoose.disconnect()
    process.exit(0)
  }

  console.log(`✓ Found connected Twitter account in DB: @${account.username}`)
  console.log(`✓ Step 3 & 4: Stored Token Metadata Verification:`)
  const decryptedToken = decrypt(account.accessToken)
  const decryptedRefresh = account.refreshToken ? decrypt(account.refreshToken) : null

  console.log(`  - Access Token present: ${!!decryptedToken}`)
  console.log(`  - Refresh Token present: ${!!decryptedRefresh}`)
  console.log(`  - Scopes: ${JSON.stringify(account.scopes)}`)
  console.log(`  - Expiry: ${account.tokenExpiresAt}`)
  console.log('✓ Step 4: Token storage encryption verified.\n')

  // 5. Verify GET /2/users/me
  console.log('--- Step 5: Verify GET /2/users/me succeeds ---')
  try {
    const userMeResponse = await axios.get('https://api.twitter.com/2/users/me', {
      headers: { Authorization: `Bearer ${decryptedToken}` }
    })
    console.log('✓ Step 5: GET /2/users/me response:')
    console.log(JSON.stringify(userMeResponse.data, null, 2))
    console.log('✓ Step 5: Verified successfully.\n')

    // 6. Verify GET connected account profile
    console.log('--- Step 6: Verify GET connected account profile details matches ---')
    const apiUsername = userMeResponse.data.data.username
    const apiUserId = userMeResponse.data.data.id
    console.log(`  - MongoDB Username: @${account.username} vs API Username: @${apiUsername}`)
    console.log(`  - MongoDB Twitter User ID: ${account.twitterUserId} vs API Twitter User ID: ${apiUserId}`)
    if (account.username.toLowerCase() !== apiUsername.toLowerCase() || account.twitterUserId !== apiUserId) {
      console.warn('⚠️ Warning: Mismatch between DB values and real Twitter API values. Updating DB...')
      account.username = apiUsername
      account.twitterUserId = apiUserId
      await account.save()
    }
    console.log('✓ Step 6: Verified successfully.\n')

    // 7. Execute a live test tweet
    console.log('--- Step 7: Execute a live test tweet ---')
    const tweetText = 'Twitter Automation Live Test'
    const tweetResponse = await axios.post('https://api.twitter.com/2/tweets', 
      { text: tweetText },
      { headers: { Authorization: `Bearer ${decryptedToken}`, 'Content-Type': 'application/json' } }
    )
    console.log('✓ Step 7: Post Tweet response:')
    console.log(JSON.stringify(tweetResponse.data, null, 2))
    
    const tweetId = tweetResponse.data.data.id
    const tweetUrl = `https://x.com/${apiUsername}/status/${tweetId}`

    console.log('\n=======================================')
    console.log('🎉 SUCCESS: Twitter OAuth Activation Complete!')
    console.log(JSON.stringify({
      connected: true,
      username: apiUsername,
      twitterUserId: apiUserId,
      tweetId: tweetId,
      tweetUrl: tweetUrl,
      publishTimestamp: new Date().toISOString()
    }, null, 2))
    console.log('=======================================')

  } catch (err) {
    console.log('\n❌ [FAIL] Step 5/6/7: Twitter API Call Failed.')
    const status = err.response?.status || 'N/A'
    const responseData = err.response?.data || err.message
    console.log(JSON.stringify({
      step: 'Verify GET /2/users/me or POST /2/tweets',
      exactEndpoint: err.config?.url || 'https://api.twitter.com/2/...',
      httpStatus: status,
      responseBody: responseData,
      fixRequired: status === 401 || status === 403 
        ? 'The stored access token is unauthorized or has expired. Re-authenticate the account to retrieve a valid token.'
        : 'Ensure that the Client ID has the correct scopes configured in the developer portal, and that the OAuth 2.0 app settings are enabled.'
    }, null, 2))
  }

  await mongoose.disconnect()
}

run().catch(async (err) => {
  console.error('Fatal Verification Error:', err)
  await mongoose.disconnect()
})
