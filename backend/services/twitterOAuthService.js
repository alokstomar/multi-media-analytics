import crypto from 'crypto'
import axios from 'axios'
import TwitterAccount from '../models/TwitterAccount.js'
import OAuthState from '../models/OAuthState.js'
import { encrypt, decrypt } from '../utils/encryption.js'

class TwitterOAuthService {
  /**
   * Generates Twitter OAuth 2.0 Authorization URL with PKCE.
   * Stores the state and code_verifier in OAuthState collection in MongoDB.
   */
  async generateAuthUrl(workspaceId) {
    const clientId = process.env.TWITTER_CLIENT_ID
    const redirectUri = process.env.TWITTER_REDIRECT_URI
    const scopes = process.env.TWITTER_SCOPES || 'tweet.read users.read offline.access'

    if (!clientId || !redirectUri) {
      throw new Error('Twitter credentials (TWITTER_CLIENT_ID, TWITTER_REDIRECT_URI) not configured in environment variables')
    }

    const state = crypto.randomBytes(16).toString('hex')
    const codeVerifier = crypto.randomBytes(32).toString('base64url')
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')

    // Store state and codeVerifier in MongoDB TTL collection (expires in 15 minutes)
    await OAuthState.create({
      state,
      codeVerifier,
      workspaceId,
      provider: 'twitter',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000)
    })

    const authUrl = `https://twitter.com/i/oauth2/authorize?response_type=code` +
      `&client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&state=${encodeURIComponent(state)}` +
      `&code_challenge=${encodeURIComponent(codeChallenge)}` +
      `&code_challenge_method=S256`

    return { authUrl, state }
  }

  /**
   * Exchanges authorization code for access and refresh tokens.
   * Fetches Twitter user profile and updates/creates TwitterAccount.
   */
  async exchangeCodeForToken(code, state) {
    const clientId = process.env.TWITTER_CLIENT_ID
    const clientSecret = process.env.TWITTER_CLIENT_SECRET
    const redirectUri = process.env.TWITTER_REDIRECT_URI

    // 1. Fetch and verify PKCE state
    const stateDoc = await OAuthState.findOne({ state })
    if (!stateDoc) {
      throw new Error('Invalid or expired OAuth state')
    }

    const codeVerifier = stateDoc.codeVerifier
    const workspaceId = stateDoc.workspaceId
    // Clean up state immediately to prevent replay attacks
    await OAuthState.deleteOne({ _id: stateDoc._id })

    // 2. Build token request parameters
    const params = new URLSearchParams()
    params.append('code', code)
    params.append('grant_type', 'authorization_code')
    params.append('redirect_uri', redirectUri)
    params.append('code_verifier', codeVerifier)
    params.append('client_id', clientId)

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
    }

    if (clientSecret) {
      const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
      headers['Authorization'] = `Basic ${auth}`
    }

    // Exchange code for token
    const tokenResponse = await axios.post('https://api.twitter.com/2/oauth2/token', params.toString(), { headers })
    const { access_token, refresh_token, expires_in, scope } = tokenResponse.data

    // 3. Fetch user profile from Twitter API v2
    const userResponse = await axios.get('https://api.twitter.com/2/users/me', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      params: {
        'user.fields': 'profile_image_url,description',
      },
    })

    const userData = userResponse.data.data
    const twitterUserId = userData.id
    const username = userData.username
    const displayName = userData.name || username
    const profileImage = userData.profile_image_url || ''

    // 4. Encrypt tokens and compute expiry
    const encryptedAccessToken = encrypt(access_token)
    const encryptedRefreshToken = refresh_token ? encrypt(refresh_token) : null
    const tokenExpiresAt = expires_in ? new Date(Date.now() + expires_in * 1000) : null
    const scopesArray = scope ? scope.split(' ') : (process.env.TWITTER_SCOPES ? process.env.TWITTER_SCOPES.split(' ') : [])

    // 5. Store / Update account in the database
    let account = await TwitterAccount.findOne({ twitterUserId, workspaceId })
    if (account) {
      account.username = username
      account.displayName = displayName
      account.profileImage = profileImage
      account.accessToken = encryptedAccessToken
      if (encryptedRefreshToken) {
        account.refreshToken = encryptedRefreshToken
      }
      account.tokenExpiresAt = tokenExpiresAt
      account.scopes = scopesArray
      account.connectionStatus = 'connected'
      account.lastTokenRefreshAt = new Date()
      account.isActive = true
      account.workspaceId = workspaceId
      await account.save()
    } else {
      account = await TwitterAccount.create({
        twitterUserId,
        username,
        displayName,
        profileImage,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt,
        scopes: scopesArray,
        connectionStatus: 'connected',
        lastTokenRefreshAt: new Date(),
        isActive: true,
        workspaceId,
      })
    }

    // Strip sensitive fields
    const result = account.toObject()
    delete result.accessToken
    delete result.refreshToken
    return result
  }

  /**
   * Refreshes access token using the stored refresh token.
   */
  async refreshAccessToken(accountId) {
    const clientId = process.env.TWITTER_CLIENT_ID
    const clientSecret = process.env.TWITTER_CLIENT_SECRET

    const account = await TwitterAccount.findById(accountId).select('+accessToken +refreshToken')
    if (!account) {
      throw new Error('Twitter account not found')
    }

    const isMockMode = process.env.PUBLISHING_MODE !== 'live' || clientId?.startsWith('mock_')
    if (isMockMode) {
      console.log(`[TwitterOAuthService] MOCK MODE: Simulating token refresh`)
      account.tokenExpiresAt = new Date(Date.now() + 7200 * 1000) // 2 hours
      account.connectionStatus = 'connected'
      account.lastTokenRefreshAt = new Date()
      await account.save()

      const result = account.toObject()
      delete result.accessToken
      delete result.refreshToken
      return result
    }

    if (!account.refreshToken) {
      account.connectionStatus = 'expired'
      await account.save()
      throw new Error('No refresh token available for this account')
    }

    const decryptedRefreshToken = decrypt(account.refreshToken)
    if (!decryptedRefreshToken) {
      account.connectionStatus = 'expired'
      await account.save()
      throw new Error('Failed to decrypt refresh token')
    }

    const params = new URLSearchParams()
    params.append('grant_type', 'refresh_token')
    params.append('refresh_token', decryptedRefreshToken)
    params.append('client_id', clientId)

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
    }

    if (clientSecret) {
      const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
      headers['Authorization'] = `Basic ${auth}`
    }

    try {
      const tokenResponse = await axios.post('https://api.twitter.com/2/oauth2/token', params.toString(), { headers })
      const { access_token, refresh_token, expires_in, scope } = tokenResponse.data

      account.accessToken = encrypt(access_token)
      if (refresh_token) {
        account.refreshToken = encrypt(refresh_token)
      }
      if (expires_in) {
        account.tokenExpiresAt = new Date(Date.now() + expires_in * 1000)
      }
      if (scope) {
        account.scopes = scope.split(' ')
      }
      account.connectionStatus = 'connected'
      account.lastTokenRefreshAt = new Date()
      await account.save()

      const result = account.toObject()
      delete result.accessToken
      delete result.refreshToken
      return result
    } catch (error) {
      console.error('Failed to refresh Twitter token:', error.response?.data || error.message)
      account.connectionStatus = 'expired'
      await account.save()
      throw new Error(`Token refresh failed: ${error.response?.data?.error_description || error.message}`)
    }
  }

  /**
   * Revokes tokens and disconnects Twitter account.
   */
  async disconnectAccount(accountId) {
    const account = await TwitterAccount.findById(accountId).select('+accessToken')
    if (!account) {
      throw new Error('Twitter account not found')
    }

    // Try revoking token via Twitter API if token exists
    if (account.accessToken && account.accessToken !== 'revoked') {
      const clientId = process.env.TWITTER_CLIENT_ID
      const clientSecret = process.env.TWITTER_CLIENT_SECRET
      const decryptedAccessToken = decrypt(account.accessToken)

      if (decryptedAccessToken) {
        try {
          const params = new URLSearchParams()
          params.append('token', decryptedAccessToken)
          params.append('token_type_hint', 'access_token')
          params.append('client_id', clientId)

          const headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
          }
          if (clientSecret) {
            const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
            headers['Authorization'] = `Basic ${auth}`
          }

          await axios.post('https://api.twitter.com/2/revoke', params.toString(), { headers })
        } catch (err) {
          console.warn('Failed to revoke Twitter token on Twitter servers:', err.response?.data || err.message)
        }
      }
    }

    // Mark as inactive and disconnected, strip tokens
    account.accessToken = 'revoked'
    account.refreshToken = 'revoked'
    account.connectionStatus = 'disconnected'
    account.isActive = false
    await account.save()

    const result = account.toObject()
    delete result.accessToken
    delete result.refreshToken
    return result
  }

  /**
   * Calculates OAuth health metrics.
   */
  async getOAuthHealth(workspaceId) {
    const now = new Date()
    const allAccounts = await TwitterAccount.find({ workspaceId })

    const connectedAccounts = allAccounts.filter(a => a.connectionStatus === 'connected' && a.isActive).length
    const activeAccounts = allAccounts.filter(a => a.isActive && a.connectionStatus === 'connected' && (!a.tokenExpiresAt || a.tokenExpiresAt > now)).length
    const expiredAccounts = allAccounts.filter(a => a.isActive && (a.connectionStatus === 'expired' || (a.tokenExpiresAt && a.tokenExpiresAt <= now))).length

    return {
      connectedAccounts,
      activeAccounts,
      expiredAccounts,
    }
  }
}

export default new TwitterOAuthService()
