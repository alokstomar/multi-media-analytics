import twitterOAuthService from '../services/twitterOAuthService.js'
import TwitterAccount from '../models/TwitterAccount.js'
import { AppError } from '../utils/errorHandler.js'
import { decrypt } from '../utils/encryption.js'
import axios from 'axios'

/**
 * GET /api/twitter/auth/url
 * Returns the Twitter OAuth 2.0 authorization URL.
 */
export async function getAuthUrl(req, res, next) {
  try {
    const { authUrl } = await twitterOAuthService.generateAuthUrl(req.workspaceId)
    res.json({ success: true, data: { authUrl } })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/twitter/auth/callback
 * Callback endpoint where Twitter redirects the user.
 * Exchanges authorization code for tokens and redirects back to frontend.
 */
export async function handleCallback(req, res, next) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
  try {
    const { code, state, error } = req.query

    if (error) {
      console.error('Twitter OAuth callback received error:', error)
      return res.redirect(`${frontendUrl}/twitter-accounts?error=${encodeURIComponent(error)}`)
    }

    if (!code || !state) {
      return res.redirect(`${frontendUrl}/twitter-accounts?error=missing_parameters`)
    }

    await twitterOAuthService.exchangeCodeForToken(code, state)
    res.redirect(`${frontendUrl}/twitter-accounts?connected=true`)
  } catch (err) {
    console.error('Twitter OAuth callback processing failed:', err)
    res.redirect(`${frontendUrl}/twitter-accounts?error=${encodeURIComponent(err.message)}`)
  }
}

/**
 * GET /api/twitter/accounts
 * Lists all active connected Twitter accounts (tokens excluded by schema design).
 */
export async function getAccounts(req, res, next) {
  try {
    const accounts = await TwitterAccount.find({ isActive: true, workspaceId: req.workspaceId }).sort({ createdAt: -1 })
    res.json({ success: true, data: accounts })
  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /api/twitter/accounts/:id
 * Disconnects and revokes a Twitter account.
 */
export async function disconnectAccount(req, res, next) {
  try {
    const { id } = req.params
    // Verify ownership
    const account = await TwitterAccount.findOne({ _id: id, workspaceId: req.workspaceId })
    if (!account) throw new AppError('Account not found', 404)

    const result = await twitterOAuthService.disconnectAccount(id)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/twitter/auth/refresh
 * Triggers a manual token refresh for a Twitter account.
 */
export async function refreshAccount(req, res, next) {
  try {
    const { accountId } = req.body
    if (!accountId) {
      throw new AppError('accountId is required in request body', 400)
    }
    // Verify ownership
    const account = await TwitterAccount.findOne({ _id: accountId, workspaceId: req.workspaceId })
    if (!account) throw new AppError('Account not found', 404)

    const result = await twitterOAuthService.refreshAccessToken(accountId)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/twitter/oauth/health
 * Returns OAuth health metrics.
 */
export async function getHealth(req, res, next) {
  try {
    const health = await twitterOAuthService.getOAuthHealth(req.workspaceId)
    res.json({ success: true, data: health })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/twitter/accounts/verify
 * Validates connection state of the active Twitter account in workspace.
 */
export async function verifyAccount(req, res, next) {
  try {
    const account = await TwitterAccount.findOne({
      workspaceId: req.workspaceId,
      connectionStatus: 'connected',
      isActive: true
    }).select('+accessToken')

    if (!account) {
      return res.status(400).json({ connected: false, message: 'No active connected Twitter account found' })
    }

    const decryptedToken = decrypt(account.accessToken)
    if (!decryptedToken) {
      return res.status(400).json({ connected: false, message: 'Failed to decrypt access token' })
    }

    // Expiry check
    const now = new Date()
    if (account.tokenExpiresAt && account.tokenExpiresAt <= now) {
      console.log(`[verifyAccount] Token expired for @${account.username}. Attempting refresh...`)
      try {
        await twitterOAuthService.refreshAccessToken(account._id)
        // Re-fetch account
        const refreshedAccount = await TwitterAccount.findById(account._id).select('+accessToken')
        const refreshedToken = decrypt(refreshedAccount.accessToken)
        return await checkTokenValidity(refreshedAccount, refreshedToken, res)
      } catch (refreshErr) {
        account.connectionStatus = 'expired'
        await account.save()
        return res.status(400).json({ connected: false, message: `Token expired and refresh failed: ${refreshErr.message}` })
      }
    }

    return await checkTokenValidity(account, decryptedToken, res)
  } catch (err) {
    next(err)
  }
}

async function checkTokenValidity(account, token, res) {
  const isLiveMode = process.env.PUBLISHING_MODE === 'live'
  
  if (!isLiveMode) {
    // Mock verify pass
    return res.json({
      connected: true,
      username: account.username,
      twitterUserId: account.twitterUserId,
      scopes: account.scopes
    })
  }

  try {
    const response = await axios.get('https://api.twitter.com/2/users/me', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    
    // Token is valid
    return res.json({
      connected: true,
      username: account.username,
      twitterUserId: account.twitterUserId,
      scopes: account.scopes
    })
  } catch (err) {
    console.error('[verifyAccount] Twitter API users/me call failed:', err.response?.data || err.message)
    account.connectionStatus = 'expired'
    await account.save()
    
    const errorMsg = err.response?.data?.detail || err.response?.data?.title || err.message
    return res.status(401).json({
      connected: false,
      message: `Twitter API verification failed: ${errorMsg}`
    })
  }
}
