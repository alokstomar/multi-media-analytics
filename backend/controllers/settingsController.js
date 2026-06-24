import User from '../models/User.js'
import { AppError } from '../utils/errorHandler.js'

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
