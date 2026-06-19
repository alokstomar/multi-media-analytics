import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import Workspace from '../models/Workspace.js'
import AuditLog from '../models/AuditLog.js'
import { AppError } from '../utils/errorHandler.js'

const JWT_SECRET = process.env.JWT_SECRET || 'creator-analytics-secret-jwt-key-2026'
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000 // 30 days

// Helper to sign JWT
function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' })
}

// Helper to set cookie
function sendCookieToken(res, token) {
  const secure = process.env.NODE_ENV === 'production' || !!process.env.VERCEL
  res.cookie('token', token, {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
}

/**
 * POST /api/auth/signup
 */
export async function signup(req, res, next) {
  try {
    const { name, email, password } = req.body
    if (!name || !email || !password) {
      throw new AppError('Name, email, and password are required', 400)
    }

    const existingUser = await User.findOne({ email })
    if (existingUser) {
      throw new AppError('Email is already registered', 400)
    }

    // 1. Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // 2. Create User
    const user = new User({
      name,
      email,
      password, // hashed by User pre-save hook
      verificationToken,
      verificationExpiresAt,
      isVerified: false,
    })

    await user.save()

    // 3. Auto-provision personal workspace
    const workspace = await Workspace.create({
      name: `${name}'s Workspace`,
      members: [{ userId: user._id, role: 'owner' }],
    })

    // 4. Update user's active workspace and log in
    user.activeWorkspaceId = workspace._id
    user.lastLoginAt = new Date()
    user.lastActiveAt = new Date()
    await user.save()

    // 5. Sign & set JWT cookie
    const token = signToken(user._id)
    sendCookieToken(res, token)

    // 6. Write AuditLog
    await AuditLog.create({
      workspaceId: workspace._id,
      userId: user._id,
      action: 'user.signup',
      details: { email: user.email, workspaceName: workspace.name },
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    }).catch(err => console.warn('Failed to create signup AuditLog:', err.message))

    // Log the verification token for simulator testing
    console.log(`[Verification Simulator] Email verification link for ${email}: http://localhost:5173/verify-email?token=${verificationToken}`)

    const userObj = user.toObject()
    delete userObj.password

    res.status(201).json({
      success: true,
      data: {
        user: userObj,
        workspace,
      }
    })
  } catch (err) { next(err) }
}

/**
 * POST /api/auth/login
 */
export async function login(req, res, next) {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      throw new AppError('Email and password are required', 400)
    }

    const user = await User.findOne({ email })
    if (!user) {
      throw new AppError('Invalid email or password', 401)
    }

    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      throw new AppError('Invalid email or password', 401)
    }

    // Update login telemetry
    user.lastLoginAt = new Date()
    user.lastActiveAt = new Date()
    
    // If user belongs to a workspace but has no activeWorkspaceId, resolve it
    if (!user.activeWorkspaceId) {
      const workspace = await Workspace.findOne({ 'members.userId': user._id, isDeleted: false })
      if (workspace) user.activeWorkspaceId = workspace._id
    }
    await user.save()

    // Sign & set cookie
    const token = signToken(user._id)
    sendCookieToken(res, token)

    // Write AuditLog
    if (user.activeWorkspaceId) {
      await AuditLog.create({
        workspaceId: user.activeWorkspaceId,
        userId: user._id,
        action: 'user.login',
        details: { email: user.email },
        ipAddress: req.ip || '',
        userAgent: req.headers['user-agent'] || '',
      }).catch(err => console.warn('Failed to create login AuditLog:', err.message))
    }

    const userObj = user.toObject()
    delete userObj.password

    let workspace = null
    if (user.activeWorkspaceId) {
      workspace = await Workspace.findOne({ _id: user.activeWorkspaceId, isDeleted: false })
    }

    res.json({
      success: true,
      data: {
        user: userObj,
        activeWorkspace: workspace,
      }
    })
  } catch (err) { next(err) }
}

/**
 * POST /api/auth/logout
 */
export async function logout(req, res, next) {
  try {
    const secure = process.env.NODE_ENV === 'production' || !!process.env.VERCEL
    res.clearCookie('token', {
      httpOnly: true,
      secure,
      sameSite: secure ? 'none' : 'lax',
      path: '/'
    })
    res.json({ success: true, message: 'Logged out successfully.' })
  } catch (err) { next(err) }
}

/**
 * GET /api/auth/me
 */
export async function me(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' })
    }

    const userObj = req.user.toObject()
    delete userObj.password

    let workspace = null
    if (req.user.activeWorkspaceId) {
      workspace = await Workspace.findOne({ _id: req.user.activeWorkspaceId, isDeleted: false })
    }

    res.json({
      success: true,
      data: {
        user: userObj,
        activeWorkspace: workspace,
      }
    })
  } catch (err) { next(err) }
}

/**
 * POST /api/auth/verify-email
 */
export async function verifyEmail(req, res, next) {
  try {
    const { token } = req.body
    if (!token) {
      throw new AppError('Verification token is required', 400)
    }

    const user = await User.findOne({
      verificationToken: token,
      verificationExpiresAt: { $gt: new Date() }
    })

    if (!user) {
      throw new AppError('Invalid or expired verification token', 400)
    }

    user.isVerified = true
    user.verificationToken = null
    user.verificationExpiresAt = null
    await user.save()

    res.json({ success: true, message: 'Email verified successfully.' })
  } catch (err) { next(err) }
}

/**
 * POST /api/auth/forgot-password
 */
export async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body
    if (!email) {
      throw new AppError('Email is required', 400)
    }

    const user = await User.findOne({ email })
    if (!user) {
      // Return success even if email not found to avoid user enumeration attacks
      return res.json({ success: true, message: 'If that email exists, a password reset link has been generated.' })
    }

    const resetToken = crypto.randomBytes(32).toString('hex')
    const hashedResetToken = crypto.createHash('sha256').update(resetToken).digest('hex')

    user.resetPasswordToken = hashedResetToken
    user.resetPasswordExpires = new Date(Date.now() + 1 * 60 * 60 * 1000) // 1 hour
    await user.save()

    // Log the link for simulator testing
    console.log(`[Reset Simulator] Reset link for ${email}: http://localhost:5173/reset-password?token=${resetToken}`)

    res.json({
      success: true,
      message: 'Password reset link generated successfully.',
      // For verification and easy testing, we can expose the token in the API response in development
      token: process.env.NODE_ENV !== 'production' ? resetToken : undefined
    })
  } catch (err) { next(err) }
}

/**
 * POST /api/auth/reset-password
 */
export async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body
    if (!token || !password) {
      throw new AppError('Token and password are required', 400)
    }

    const hashedResetToken = crypto.createHash('sha256').update(token).digest('hex')

    const user = await User.findOne({
      resetPasswordToken: hashedResetToken,
      resetPasswordExpires: { $gt: new Date() }
    })

    if (!user) {
      throw new AppError('Invalid or expired password reset token', 400)
    }

    user.password = password // Will be hashed by pre-save save hook
    user.resetPasswordToken = null
    user.resetPasswordExpires = null
    await user.save()

    res.json({ success: true, message: 'Password has been reset successfully.' })
  } catch (err) { next(err) }
}
