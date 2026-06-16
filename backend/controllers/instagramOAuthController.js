import mongoose from 'mongoose'
import instagramOAuthService from '../services/instagramOAuthService.js'
import InstagramAccount from '../models/InstagramAccount.js'
import { AppError } from '../utils/errorHandler.js'

/**
 * GET /api/instagram/auth/url
 * Returns the Instagram OAuth authorization URL.
 */
export async function getAuthUrl(req, res, next) {
  try {
    const { authUrl } = await instagramOAuthService.generateAuthUrl(req.workspaceId)
    res.json({ success: true, data: { authUrl } })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/instagram/auth/callback
 * Meta redirects the user here. Exchanges code for token and redirects back to frontend.
 */
export async function handleCallback(req, res, next) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
  try {
    const { code, state, error } = req.query

    if (error) {
      console.error('Instagram OAuth callback received error:', error)
      return res.redirect(`${frontendUrl}/instagram/accounts?error=${encodeURIComponent(error)}`)
    }

    if (!code || !state) {
      return res.redirect(`${frontendUrl}/instagram/accounts?error=missing_parameters`)
    }

    await instagramOAuthService.exchangeCodeForToken(code, state)
    res.redirect(`${frontendUrl}/instagram/accounts?connected=true`)
  } catch (err) {
    console.error('Instagram OAuth callback processing failed:', err)
    res.redirect(`${frontendUrl}/instagram/accounts?error=${encodeURIComponent(err.message)}`)
  }
}

/**
 * GET /api/instagram/accounts
 * Lists all connected/active Instagram accounts (tokens excluded).
 */
export async function getAccounts(req, res, next) {
  try {
    // Return accounts that are active, expired, or error, but exclude revoked (disconnected)
    const accounts = await InstagramAccount.find({
      connectionStatus: { $ne: 'revoked' },
      workspaceId: req.workspaceId,
    }).sort({ createdAt: -1 })
    res.json({ success: true, data: accounts })
  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /api/instagram/accounts/:id
 * Disconnects and revokes an Instagram integration.
 */
export async function disconnectAccount(req, res, next) {
  try {
    const { id } = req.params
    console.log('[INSTAGRAM_DISCONNECT]', {
      id,
      workspaceId: req.workspaceId
    })

    // Verify ownership
    const query = InstagramAccount.buildIdentifierQuery(id, req.workspaceId)
    const account = await InstagramAccount.findOne(query)
    if (!account) throw new AppError('Account not found', 404)

    console.log('[INSTAGRAM_DISCONNECT_RESOLVED]', {
      id,
      accountId: account.accountId,
      mongoId: account._id,
      workspaceId: req.workspaceId
    })

    const result = await instagramOAuthService.disconnectAccount(account._id)

    console.log('[INSTAGRAM_DISCONNECT_SUCCESS]', {
      accountId: account.accountId
    })

    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/instagram/auth/refresh
 * Triggers a manual token refresh for an account.
 */
export async function refreshAccount(req, res, next) {
  try {
    const { accountId } = req.body
    if (!accountId) {
      throw new AppError('accountId is required in request body', 400)
    }
    // Verify ownership
    const query = InstagramAccount.buildIdentifierQuery(accountId, req.workspaceId)
    const account = await InstagramAccount.findOne(query)
    if (!account) throw new AppError('Account not found', 404)

    const result = await instagramOAuthService.refreshAccessToken(account._id)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}


/**
 * GET /api/instagram/oauth/health
 * Returns dynamic Instagram health metrics.
 */
export async function getHealth(req, res, next) {
  try {
    const health = await instagramOAuthService.getOAuthHealth(req.workspaceId)
    res.json({ success: true, data: health })
  } catch (err) {
    next(err)
  }
}
