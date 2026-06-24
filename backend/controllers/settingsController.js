import User from '../models/User.js'
import { AppError } from '../utils/errorHandler.js'
import { signToken, sendCookieToken } from './authController.js'
import { generateApiKey, computeFingerprint } from '../utils/generateApiKey.js'
import bcrypt from 'bcryptjs'
import AIResponseCache from '../models/AIResponseCache.js'
import AIUsageLog from '../models/AIUsageLog.js'
import { lazyResetUserUsage } from '../utils/aiUsage.js'
import { getActiveProviderName, getAIProvider } from '../services/ai/index.js'
import mongoose from 'mongoose'

// ── Fields that can be read from profile ─────────────────────────────────
function buildProfileResponse(user) {
  return {
    id: user._id,
    name: user.name,
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    email: user.email,           // read-only: returned but not updatable via this endpoint
    phone: user.phone || '',
    location: user.location || '',
    organization: user.organization || '',
    bio: user.bio || '',
    avatar: user.avatar || '',
    isVerified: user.isVerified,
    createdAt: user.createdAt,
  }
}

/**
 * GET /api/settings/profile
 * Returns the authenticated user's full profile.
 */
export async function getProfile(req, res, next) {
  try {
    const user = await User.findById(req.user._id).lean()
    if (!user) throw new AppError('User not found', 404)

    res.json({
      success: true,
      data: buildProfileResponse(user),
    })
  } catch (err) { next(err) }
}

/**
 * PATCH /api/settings/profile
 * Updates mutable profile fields. Email is read-only and intentionally excluded.
 * Updating firstName/lastName also updates the legacy name field for backward compatibility.
 */
export async function updateProfile(req, res, next) {
  try {
    const ALLOWED = ['firstName', 'lastName', 'phone', 'location', 'organization', 'bio']

    const updates = {}
    for (const key of ALLOWED) {
      if (req.body[key] !== undefined) {
        updates[key] = typeof req.body[key] === 'string'
          ? req.body[key].trim()
          : req.body[key]
      }
    }

    if (Object.keys(updates).length === 0) {
      throw new AppError('No valid fields provided for update', 400)
    }

    // Load live document so pre-save hooks run properly
    const user = await User.findById(req.user._id)
    if (!user) throw new AppError('User not found', 404)

    Object.assign(user, updates)
    // Pre-save hook will keep user.name in sync with firstName/lastName
    await user.save()

    res.json({
      success: true,
      message: 'Profile updated successfully.',
      data: buildProfileResponse(user),
    })
  } catch (err) { next(err) }
}

/**
 * POST /api/settings/avatar
 * Stores avatar as a base64 data URL in User.avatar.
 *
 * MVP: Base64 stored directly in MongoDB (max ~2.7 MB for a 2 MB image file).
 * Future: Replace this controller with Cloudinary/S3 upload — frontend API stays the same.
 *
 * Body: { base64: "data:image/jpeg;base64,..." }
 */
export async function uploadAvatar(req, res, next) {
  try {
    const { base64 } = req.body

    if (!base64 || typeof base64 !== 'string') {
      throw new AppError('base64 image data is required', 400)
    }

    // Validate it's a data URL of an accepted image type
    const validPrefixes = ['data:image/jpeg;base64,', 'data:image/png;base64,', 'data:image/gif;base64,', 'data:image/webp;base64,']
    const isValid = validPrefixes.some(p => base64.startsWith(p))
    if (!isValid) {
      throw new AppError('Only JPEG, PNG, GIF, or WebP images are accepted', 400)
    }

    // Rough byte size check (~3/4 of base64 string length = actual bytes)
    const approxBytes = (base64.length * 3) / 4
    const MAX_BYTES = 3 * 1024 * 1024 // 3MB base64 ≈ 2MB file
    if (approxBytes > MAX_BYTES) {
      throw new AppError('Image is too large. Maximum file size is 2MB.', 400)
    }

    const user = await User.findById(req.user._id)
    if (!user) throw new AppError('User not found', 404)

    user.avatar = base64
    await user.save()

    res.json({
      success: true,
      message: 'Avatar uploaded successfully.',
      data: { avatar: user.avatar },
    })
  } catch (err) { next(err) }
}

/**
 * DELETE /api/settings/avatar
 * Removes the user's avatar (resets to empty string; UI falls back to initials).
 */
export async function removeAvatar(req, res, next) {
  try {
    const user = await User.findById(req.user._id)
    if (!user) throw new AppError('User not found', 404)

    user.avatar = ''
    await user.save()

    res.json({
      success: true,
      message: 'Avatar removed.',
      data: { avatar: '' },
    })
  } catch (err) { next(err) }
}

/**
 * GET /api/settings/sessions
 * Returns user's active login sessions.
 */
export async function getSessions(req, res, next) {
  try {
    const user = await User.findById(req.user._id).lean()
    if (!user) throw new AppError('User not found', 404)

    const sessions = (user.activeSessions || []).map(s => ({
      sessionId: s.sessionId,
      browser: s.browser || 'Unknown Browser',
      os: s.os || 'Unknown OS',
      device: s.device || 'Unknown Device',
      location: s.location || 'Unknown location',
      createdAt: s.createdAt,
      lastActiveAt: s.lastActiveAt,
      current: s.sessionId === req.sessionId
    }))

    res.json({
      success: true,
      data: sessions
    })
  } catch (err) { next(err) }
}

/**
 * DELETE /api/settings/sessions/:sessionId
 * Revokes a specific session.
 */
export async function revokeSession(req, res, next) {
  try {
    const { sessionId } = req.params
    if (!sessionId) {
      throw new AppError('Session ID is required', 400)
    }

    if (sessionId === req.sessionId) {
      throw new AppError('You cannot revoke your current active session', 400)
    }

    const user = await User.findById(req.user._id)
    if (!user) throw new AppError('User not found', 404)

    const initialLength = user.activeSessions.length
    user.activeSessions = user.activeSessions.filter(s => s.sessionId !== sessionId)

    if (user.activeSessions.length === initialLength) {
      throw new AppError('Session not found', 404)
    }

    await user.save()

    res.json({
      success: true,
      message: 'Session revoked successfully.'
    })
  } catch (err) { next(err) }
}

/**
 * DELETE /api/settings/sessions
 * Revokes all sessions except the current active one.
 */
export async function revokeAllOtherSessions(req, res, next) {
  try {
    const user = await User.findById(req.user._id)
    if (!user) throw new AppError('User not found', 404)

    // Keep only the current session
    user.activeSessions = user.activeSessions.filter(s => s.sessionId === req.sessionId)

    await user.save()

    res.json({
      success: true,
      message: 'All other sessions have been successfully revoked.'
    })
  } catch (err) { next(err) }
}

/**
 * POST /api/settings/password
 * Verifies current password and updates password. Optionally revokes other sessions.
 */
export async function updatePassword(req, res, next) {
  try {
    const { currentPassword, newPassword, revokeOthers } = req.body
    if (!currentPassword || !newPassword) {
      throw new AppError('Current password and new password are required', 400)
    }

    const user = await User.findById(req.user._id)
    if (!user) throw new AppError('User not found', 404)

    const isMatch = await user.comparePassword(currentPassword)
    if (!isMatch) {
      throw new AppError('Incorrect current password', 400)
    }

    user.password = newPassword // hashed by User pre-save hook

    if (revokeOthers) {
      user.activeSessions = user.activeSessions.filter(s => s.sessionId === req.sessionId)
    }

    await user.save()

    // Reissue JWT token with updated iat for the current active device so it stays logged in
    if (req.sessionId) {
      const newToken = signToken(user._id, req.sessionId)
      sendCookieToken(res, newToken)
    }

    res.json({
      success: true,
      message: 'Password updated successfully.'
    })
  } catch (err) { next(err) }
}

/**
 * GET /api/settings/integrations
 * Returns integration states.
 */
export async function getIntegrations(req, res, next) {
  try {
    const user = await User.findById(req.user._id).lean()
    if (!user) throw new AppError('User not found', 404)

    const integrations = user.integrations || {}
    const keys = ['youtube', 'googleAnalytics', 'instagram', 'twitter', 'discord', 'slack']
    const data = {}

    for (const k of keys) {
      const item = integrations[k] || {}
      data[k] = {
        connected: !!item.connected,
        connectedAt: item.connectedAt || null,
        lastSyncAt: item.lastSyncAt || null,
        lastError: item.lastError || null,
        updatedAt: item.updatedAt || null,
        status: item.status || 'disconnected'
      }
      if (k === 'youtube') {
        data[k].channelCount = item.channelCount || 0
      }
    }

    res.json({
      success: true,
      data
    })
  } catch (err) { next(err) }
}

/**
 * PATCH /api/settings/integrations/:platform
 * Updates platform connection state.
 */
export async function updateIntegration(req, res, next) {
  try {
    const { platform } = req.params
    const { connected } = req.body

    const ALLOWED = ['googleAnalytics', 'instagram', 'twitter', 'discord', 'slack']
    if (!ALLOWED.includes(platform)) {
      throw new AppError('Invalid or restricted platform connection update', 400)
    }

    if (connected === undefined) {
      throw new AppError('connected field is required', 400)
    }

    const user = await User.findById(req.user._id)
    if (!user) throw new AppError('User not found', 404)

    user.integrations = user.integrations || {}
    user.integrations[platform] = user.integrations[platform] || {}

    user.integrations[platform].connected = !!connected
    user.integrations[platform].connectedAt = connected ? new Date() : null
    user.integrations[platform].updatedAt = new Date()
    user.integrations[platform].status = connected ? 'connected' : 'disconnected'
    user.integrations[platform].lastError = null

    user.markModified('integrations')
    await user.save()

    res.json({
      success: true,
      message: `Integration state updated for ${platform}.`,
      data: {
        connected: user.integrations[platform].connected,
        status: user.integrations[platform].status
      }
    })
  } catch (err) { next(err) }
}

/**
 * GET /api/settings/api-key
 * Returns active API key metadata (preview, dates, existence).
 */
export async function getApiKey(req, res, next) {
  try {
    const user = await User.findById(req.user._id)
    if (!user) throw new AppError('User not found', 404)

    let activeKeyObj = (user.apiKeys || []).find(k => k.active)

    if (!activeKeyObj) {
      // Auto-generate key if none exists
      let rawKey
      let fingerprint
      let exists = true
      while (exists) {
        rawKey = generateApiKey()
        fingerprint = computeFingerprint(rawKey)
        exists = await User.exists({ 'apiKeys.fingerprint': fingerprint })
      }

      const keyHash = await bcrypt.hash(rawKey, 10)
      const keyPreview = rawKey.slice(0, 12) + '••••••••••••'

      activeKeyObj = {
        keyHash,
        keyPreview,
        fingerprint,
        active: true,
        createdAt: new Date(),
        rateLimit: 1000,
        requestsToday: 0
      }

      user.apiKeys = user.apiKeys || []
      user.apiKeys.push(activeKeyObj)

      // Keep only latest 10 keys
      user.apiKeys.sort((a, b) => b.createdAt - a.createdAt)
      user.apiKeys = user.apiKeys.slice(0, 10)

      await user.save()
    }

    res.json({
      success: true,
      preview: activeKeyObj.keyPreview,
      createdAt: activeKeyObj.createdAt,
      lastUsedAt: activeKeyObj.lastUsedAt || null,
      exists: true
    })
  } catch (err) { next(err) }
}

/**
 * POST /api/settings/api-key/regenerate
 * Regenerates the user's API key.
 */
export async function regenerateApiKey(req, res, next) {
  try {
    // Atomically deactivate all existing keys for transaction safety
    await User.findByIdAndUpdate(req.user._id, {
      $set: { 'apiKeys.$[].active': false }
    })

    // Generate unique key loop
    let rawKey
    let fingerprint
    let exists = true
    while (exists) {
      rawKey = generateApiKey()
      fingerprint = computeFingerprint(rawKey)
      exists = await User.exists({ 'apiKeys.fingerprint': fingerprint })
    }

    const keyHash = await bcrypt.hash(rawKey, 10)
    const keyPreview = rawKey.slice(0, 12) + '••••••••••••'

    const newKeyObj = {
      keyHash,
      keyPreview,
      fingerprint,
      active: true,
      createdAt: new Date(),
      rateLimit: 1000,
      requestsToday: 0
    }

    const user = await User.findById(req.user._id)
    if (!user) throw new AppError('User not found', 404)

    user.apiKeys = user.apiKeys || []
    user.apiKeys.push(newKeyObj)

    // Keep only latest 10 keys to avoid unbounded doc growth
    user.apiKeys.sort((a, b) => b.createdAt - a.createdAt)
    user.apiKeys = user.apiKeys.slice(0, 10)

    await user.save()

    res.json({
      success: true,
      rawKey,
      keyPreview: newKeyObj.keyPreview,
      createdAt: newKeyObj.createdAt
    })
  } catch (err) { next(err) }
}

/**
 * GET /api/settings/ai-usage
 * Returns the standardized AI usage stats, budgets, configuration, warnings, method breakdown and recent logs.
 */
export async function getAIUsage(req, res, next) {
  try {
    const userId = req.user._id
    
    // Ensure lazy resets run first so stats are accurate for today/this month
    const aiUsage = await lazyResetUserUsage(userId)
    if (!aiUsage) {
      throw new AppError('AI usage metrics not found', 404)
    }

    const todaySpend = aiUsage.todaySpend || 0
    const dailyLimit = aiUsage.dailyBudget || 5
    const dailyRemaining = Math.max(0, dailyLimit - todaySpend) // clamped to 0
    const dailyPercentage = dailyLimit > 0 ? Number(((todaySpend / dailyLimit) * 100).toFixed(1)) : 0

    const monthSpend = aiUsage.monthSpend || 0
    const monthlyLimit = aiUsage.monthlyBudget || 50
    const monthlyRemaining = Math.max(0, monthlyLimit - monthSpend) // clamped to 0
    const monthlyPercentage = monthlyLimit > 0 ? Number(((monthSpend / monthlyLimit) * 100).toFixed(1)) : 0

    // Warnings: approaching (>=80%), critical (>=95%)
    let dailyWarning = null
    if (todaySpend >= dailyLimit * 0.95) {
      dailyWarning = 'critical'
    } else if (todaySpend >= dailyLimit * 0.80) {
      dailyWarning = 'approaching'
    }

    let monthlyWarning = null
    if (monthSpend >= monthlyLimit * 0.95) {
      monthlyWarning = 'critical'
    } else if (monthSpend >= monthlyLimit * 0.80) {
      monthlyWarning = 'approaching'
    }

    // Active provider config
    const activeProvider = getActiveProviderName()
    const providerInstance = getAIProvider()
    const fastModel = providerInstance?.fastModel || 'fast-model'
    const premiumModel = providerInstance?.premiumModel || 'premium-model'

    // Cache count for this user
    const cacheCount = await AIResponseCache.countDocuments({ userId })

    // Method breakdown (this month) for this user
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    
    const breakdown = await AIUsageLog.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId), createdAt: { $gte: startOfMonth }, cacheHit: false } },
      { $group: {
        _id: '$method',
        calls: { $sum: 1 },
        totalTokens: { $sum: '$totalTokens' },
        totalCost: { $sum: '$estimatedCost' },
        avgResponseMs: { $avg: '$responseTimeMs' }
      }},
      { $sort: { totalCost: -1 } }
    ])

    // Recent logs (last 20 logs for this user)
    const recentLogs = await AIUsageLog.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()

    res.json({
      success: true,
      usage: {
        daily: {
          spend: Number(todaySpend.toFixed(4)),
          budget: dailyLimit,
          remaining: Number(dailyRemaining.toFixed(4)),
          percentage: dailyPercentage
        },
        monthly: {
          spend: Number(monthSpend.toFixed(4)),
          budget: monthlyLimit,
          remaining: Number(monthlyRemaining.toFixed(4)),
          percentage: monthlyPercentage
        },
        todayCalls: aiUsage.todayCalls || 0,
        todayTokens: aiUsage.todayTokens || 0,
        cacheHits: aiUsage.cacheHits || 0
      },
      provider: {
        active: activeProvider,
        fastModel,
        premiumModel
      },
      cache: {
        entries: cacheCount
      },
      warnings: {
        daily: dailyWarning,
        monthly: monthlyWarning
      },
      breakdown,
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
    })
  } catch (err) { next(err) }
}

/**
 * PATCH /api/settings/ai-usage/budgets
 * Updates the user's daily and monthly AI budget limits.
 */
export async function updateAIBudgets(req, res, next) {
  try {
    const { dailyBudget, monthlyBudget } = req.body
    
    const updates = {}
    if (dailyBudget !== undefined) {
      if (typeof dailyBudget !== 'number' || dailyBudget < 0) {
        throw new AppError('Daily budget must be a positive number', 400)
      }
      updates['aiUsage.dailyBudget'] = dailyBudget
    }

    if (monthlyBudget !== undefined) {
      if (typeof monthlyBudget !== 'number' || monthlyBudget < 0) {
        throw new AppError('Monthly budget must be a positive number', 400)
      }
      updates['aiUsage.monthlyBudget'] = monthlyBudget
    }

    if (Object.keys(updates).length === 0) {
      throw new AppError('No budget updates provided', 400)
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true }
    )

    if (!user) throw new AppError('User not found', 404)

    // Ensure resets are run
    const aiUsage = await lazyResetUserUsage(req.user._id)

    res.json({
      success: true,
      message: 'AI budget limits updated successfully',
      data: aiUsage
    })
  } catch (err) { next(err) }
}

/**
 * GET /api/settings/ai-usage/history
 * Returns the user's aggregated daily AI spend for the last 30 days.
 */
export async function getAIUsageHistory(req, res, next) {
  try {
    const userId = req.user._id
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    thirtyDaysAgo.setHours(0, 0, 0, 0)

    const history = await AIUsageLog.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId), createdAt: { $gte: thirtyDaysAgo } } },
      { $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        spend: { $sum: '$estimatedCost' },
        calls: { $sum: 1 },
        tokens: { $sum: '$totalTokens' }
      }},
      { $sort: { _id: 1 } }
    ])

    res.json({
      success: true,
      data: history
    })
  } catch (err) { next(err) }
}
