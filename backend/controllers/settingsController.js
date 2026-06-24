import User from '../models/User.js'
import { AppError } from '../utils/errorHandler.js'
import { signToken, sendCookieToken } from './authController.js'

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
