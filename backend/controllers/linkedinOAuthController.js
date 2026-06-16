import linkedinOAuthService from '../services/linkedinOAuthService.js'
import LinkedInAccount from '../models/LinkedInAccount.js'
import { AppError } from '../utils/errorHandler.js'

/**
 * GET /api/linkedin/auth/url
 * Returns the LinkedIn OAuth 2.0 authorization URL.
 */
export async function getAuthUrl(req, res, next) {
  try {
    const { authUrl } = await linkedinOAuthService.generateAuthUrl(req.workspaceId)
    res.json({ success: true, data: { authUrl } })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/linkedin/auth/callback
 * Redirect callback endpoint where LinkedIn redirects the user.
 * Exchanges auth code for tokens and redirects back to frontend.
 */
export async function handleCallback(req, res, next) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
  try {
    const { code, state, error } = req.query

    if (error) {
      console.error('LinkedIn OAuth callback received error:', error)
      return res.redirect(`${frontendUrl}/linkedin-accounts?error=${encodeURIComponent(error)}`)
    }

    if (!code || !state) {
      return res.redirect(`${frontendUrl}/linkedin-accounts?error=missing_parameters`)
    }

    await linkedinOAuthService.exchangeCodeForToken(code, state)
    res.redirect(`${frontendUrl}/linkedin-accounts?connected=true`)
  } catch (err) {
    console.error('LinkedIn OAuth callback processing failed:', err)
    res.redirect(`${frontendUrl}/linkedin-accounts?error=${encodeURIComponent(err.message)}`)
  }
}

/**
 * GET /api/linkedin/accounts
 * Lists all connected/active LinkedIn profiles and company pages (tokens hidden).
 */
export async function getAccounts(req, res, next) {
  try {
    // Return accounts that are active, expired, or error, but exclude revoked (disconnected)
    const accounts = await LinkedInAccount.find({
      connectionStatus: { $ne: 'revoked' },
      workspaceId: req.workspaceId,
    }).sort({ createdAt: -1 })
    res.json({ success: true, data: accounts })
  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /api/linkedin/accounts/:id
 * Disconnects and revokes a LinkedIn integration.
 */
export async function disconnectAccount(req, res, next) {
  try {
    const { id } = req.params
    // Verify ownership
    const account = await LinkedInAccount.findOne({ _id: id, workspaceId: req.workspaceId })
    if (!account) throw new AppError('Account not found', 404)

    const result = await linkedinOAuthService.disconnectAccount(id)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/linkedin/auth/refresh
 * Triggers a manual token refresh for an account.
 */
export async function refreshAccount(req, res, next) {
  try {
    const { accountId } = req.body
    if (!accountId) {
      throw new AppError('accountId is required in request body', 400)
    }
    // Verify ownership
    const account = await LinkedInAccount.findOne({ _id: accountId, workspaceId: req.workspaceId })
    if (!account) throw new AppError('Account not found', 404)

    const result = await linkedinOAuthService.refreshAccessToken(accountId)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/linkedin/oauth/health
 * Returns dynamic LinkedIn health metrics.
 */
export async function getHealth(req, res, next) {
  try {
    const health = await linkedinOAuthService.getOAuthHealth(req.workspaceId)
    res.json({ success: true, data: health })
  } catch (err) {
    next(err)
  }
}
