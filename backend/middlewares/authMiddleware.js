import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import Workspace from '../models/Workspace.js'

const JWT_SECRET = process.env.JWT_SECRET || 'creator-analytics-secret-jwt-key-2026'

const roleLevels = {
  viewer: 1,
  editor: 2,
  admin: 3,
  owner: 4
}

/**
 * requireAuth middleware
 * Authenticates user via HTTP-only cookie 'token' or 'Authorization' Bearer header.
 */
export async function requireAuth(req, res, next) {
  let token = null

  // 1. Check cookies first
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token
  }
  // 2. Check Authorization header
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1]
  }

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required. Please log in.' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    const user = await User.findById(decoded.userId)
    if (!user) {
      // Clear cookie if invalid user
      res.clearCookie('token')
      return res.status(401).json({ success: false, error: 'User account not found.' })
    }

    // Update user's lastActiveAt asynchronously
    user.lastActiveAt = new Date()
    await user.save().catch(err => console.warn('Failed to update lastActiveAt:', err.message))

    req.user = user
    next()
  } catch (err) {
    console.error('[authMiddleware] JWT verify error:', err.message)
    res.clearCookie('token')
    return res.status(401).json({ success: false, error: 'Session expired or invalid. Please log in again.' })
  }
}

/**
 * requireWorkspace middleware
 * Ensures the request is bound to a valid workspace where the user is a member.
 */
export async function requireWorkspace(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' })
  }

  // Resolve workspace ID from header, query, body, or fallback to user's active workspace
  let workspaceId = req.headers['x-workspace-id'] || req.query.workspaceId || req.body?.workspaceId

  if (!workspaceId) {
    workspaceId = req.user.activeWorkspaceId
  }

  if (!workspaceId) {
    return res.status(403).json({ success: false, error: 'Workspace context required. Create or join a workspace.' })
  }

  try {
    const workspace = await Workspace.findOne({ _id: workspaceId, isDeleted: false })
    if (!workspace) {
      return res.status(404).json({ success: false, error: 'Workspace not found or has been deleted.' })
    }

    // Check membership
    const member = workspace.members.find(m => m.userId.toString() === req.user._id.toString())
    if (!member) {
      return res.status(403).json({ success: false, error: 'Access denied: You are not a member of this workspace.' })
    }

    // Synchronize user's active workspace if different
    if (!req.user.activeWorkspaceId || req.user.activeWorkspaceId.toString() !== workspace._id.toString()) {
      req.user.activeWorkspaceId = workspace._id
      await req.user.save().catch(err => console.warn('Failed to update activeWorkspaceId:', err.message))
    }

    req.workspaceId = workspace._id
    req.workspace = workspace
    req.userRole = member.role
    next()
  } catch (err) {
    console.error('[authMiddleware] Workspace error:', err.message)
    return res.status(500).json({ success: false, error: 'Internal workspace authorization error.' })
  }
}

/**
 * requireRole middleware factory
 * Ensures user has at least the minimum role hierarchy level.
 */
export function requireRole(minRole) {
  return (req, res, next) => {
    if (!req.userRole) {
      return res.status(403).json({ success: false, error: 'Access denied: No role assigned in current workspace.' })
    }

    const userLevel = roleLevels[req.userRole] || 0
    const requiredLevel = roleLevels[minRole] || 0

    if (userLevel < requiredLevel) {
      return res.status(403).json({ success: false, error: `Forbidden: Insufficient privileges. Required role: ${minRole}` })
    }

    next()
  }
}
