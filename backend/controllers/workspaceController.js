import crypto from 'crypto'
import Workspace from '../models/Workspace.js'
import User from '../models/User.js'
import WorkspaceInvite from '../models/WorkspaceInvite.js'
import AuditLog from '../models/AuditLog.js'
import { AppError } from '../utils/errorHandler.js'

/**
 * GET /api/workspaces
 * List all workspaces the logged-in user is a member of (isDeleted: false)
 */
export async function getWorkspaces(req, res, next) {
  try {
    const workspaces = await Workspace.find({
      'members.userId': req.user._id,
      isDeleted: false,
    }).populate('members.userId', 'name email lastActiveAt')

    res.json({ success: true, data: workspaces })
  } catch (err) { next(err) }
}

/**
 * POST /api/workspaces
 * Creates a new workspace and sets the user's role to 'owner'
 */
export async function createWorkspace(req, res, next) {
  try {
    const { name, logo, timezone, branding } = req.body
    if (!name) {
      throw new AppError('Workspace name is required', 400)
    }

    const workspace = await Workspace.create({
      name,
      logo: logo || '',
      timezone: timezone || 'UTC',
      branding: branding || { primaryColor: '#4f46e5', secondaryColor: '#06b6d4' },
      members: [{ userId: req.user._id, role: 'owner' }],
    })

    // Update user's active workspace to the newly created one
    req.user.activeWorkspaceId = workspace._id
    await req.user.save()

    // Write AuditLog
    await AuditLog.create({
      workspaceId: workspace._id,
      userId: req.user._id,
      action: 'workspace.create',
      details: { name: workspace.name },
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    }).catch(err => console.warn('Failed to create audit log:', err.message))

    res.status(201).json({ success: true, data: workspace })
  } catch (err) { next(err) }
}

/**
 * PUT /api/workspaces/:id
 * Updates workspace metadata (logo, timezone, branding, name)
 * Middleware requireWorkspace ensures membership and populates req.userRole
 */
export async function updateWorkspace(req, res, next) {
  try {
    const { id } = req.params
    const { name, logo, timezone, branding } = req.body

    // Ensure user has role 'admin' or 'owner' in this workspace
    // req.userRole was set by requireWorkspace middleware
    if (req.userRole !== 'owner' && req.userRole !== 'admin') {
      throw new AppError('Forbidden: Only owners and admins can update workspace settings', 403)
    }

    const workspace = await Workspace.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { name, logo, timezone, branding } },
      { new: true, runValidators: true }
    )

    if (!workspace) {
      throw new AppError('Workspace not found or deleted', 404)
    }

    // Write AuditLog
    await AuditLog.create({
      workspaceId: workspace._id,
      userId: req.user._id,
      action: 'workspace.update',
      details: { name, timezone, branding },
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    }).catch(err => console.warn('Failed to create audit log:', err.message))

    res.json({ success: true, data: workspace })
  } catch (err) { next(err) }
}

/**
 * DELETE /api/workspaces/:id
 * Soft deletes a workspace (sets isDeleted: true, deletedAt: now)
 * Requires role 'owner'
 */
export async function deleteWorkspace(req, res, next) {
  try {
    const { id } = req.params

    if (req.userRole !== 'owner') {
      throw new AppError('Forbidden: Only the workspace owner can delete the workspace', 403)
    }

    const workspace = await Workspace.findOne({ _id: id, isDeleted: false })
    if (!workspace) {
      throw new AppError('Workspace not found or already deleted', 404)
    }

    workspace.isDeleted = true
    workspace.deletedAt = new Date()
    await workspace.save()

    // If the deleted workspace was the user's active workspace, select another one or nullify it
    if (req.user.activeWorkspaceId && req.user.activeWorkspaceId.toString() === id) {
      const anotherWorkspace = await Workspace.findOne({
        'members.userId': req.user._id,
        _id: { $ne: id },
        isDeleted: false,
      })
      req.user.activeWorkspaceId = anotherWorkspace ? anotherWorkspace._id : null
      await req.user.save()
    }

    // Write AuditLog
    await AuditLog.create({
      workspaceId: workspace._id,
      userId: req.user._id,
      action: 'workspace.delete',
      details: { name: workspace.name },
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    }).catch(err => console.warn('Failed to create audit log:', err.message))

    res.json({ success: true, message: 'Workspace deleted successfully.' })
  } catch (err) { next(err) }
}

/**
 * POST /api/workspaces/switch
 * Switch the activeWorkspaceId for the logged-in user
 */
export async function switchWorkspace(req, res, next) {
  try {
    const { workspaceId } = req.body
    if (!workspaceId) {
      throw new AppError('Workspace ID is required', 400)
    }

    // Check if workspace exists and is active, and if the user is a member
    const workspace = await Workspace.findOne({ _id: workspaceId, isDeleted: false })
    if (!workspace) {
      throw new AppError('Workspace not found or has been deleted', 404)
    }

    const isMember = workspace.members.some(m => m.userId.toString() === req.user._id.toString())
    if (!isMember) {
      throw new AppError('Forbidden: You are not a member of this workspace', 403)
    }

    req.user.activeWorkspaceId = workspace._id
    await req.user.save()

    res.json({
      success: true,
      message: `Switched to workspace: ${workspace.name}`,
      data: {
        activeWorkspaceId: workspace._id,
        workspace,
      }
    })
  } catch (err) { next(err) }
}

/**
 * GET /api/workspaces/active/team
 * List all members and pending invitations of the active workspace
 */
export async function getTeam(req, res, next) {
  try {
    const workspace = await Workspace.findById(req.workspaceId)
      .populate('members.userId', 'name email lastActiveAt lastLoginAt')

    const pendingInvites = await WorkspaceInvite.find({
      workspaceId: req.workspaceId,
      status: 'pending',
    }).populate('invitedBy', 'name email')

    res.json({
      success: true,
      data: {
        members: workspace.members,
        pendingInvites,
      }
    })
  } catch (err) { next(err) }
}

/**
 * POST /api/workspaces/active/team/invite
 * Sends/creates a team invitation. Stores the HASHED invitation token in the database.
 * Returns the raw token to the frontend so they can construct the accept link.
 */
export async function inviteMember(req, res, next) {
  try {
    const { email, role } = req.body
    if (!email || !role) {
      throw new AppError('Email and role are required', 400)
    }

    // Role permissions validation
    if (req.userRole !== 'owner' && req.userRole !== 'admin') {
      throw new AppError('Forbidden: Only owners and admins can invite members', 403)
    }

    // Cannot invite someone to be Owner
    if (role === 'owner') {
      throw new AppError('Forbidden: Cannot invite a member as Owner', 400)
    }

    const workspace = req.workspace

    // Check if the user is already a member
    const normalizedEmail = email.toLowerCase().trim()
    const existingMember = await User.findOne({ email: normalizedEmail })
    if (existingMember) {
      const isAlreadyInTeam = workspace.members.some(
        m => m.userId.toString() === existingMember._id.toString()
      )
      if (isAlreadyInTeam) {
        throw new AppError('User is already a member of this workspace', 400)
      }
    }

    // Generate token
    const rawToken = crypto.randomBytes(32).toString('hex')
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex')

    // Invitation expires in 7 days
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    // Remove any existing pending invite for the same email & workspace
    await WorkspaceInvite.deleteMany({
      workspaceId: workspace._id,
      email: normalizedEmail,
      status: 'pending',
    })

    const invite = await WorkspaceInvite.create({
      workspaceId: workspace._id,
      email: normalizedEmail,
      invitedBy: req.user._id,
      role,
      token: hashedToken,
      expiresAt,
    })

    // Write AuditLog
    await AuditLog.create({
      workspaceId: workspace._id,
      userId: req.user._id,
      action: 'workspace.invite.send',
      details: { inviteEmail: normalizedEmail, role },
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    }).catch(err => console.warn('Failed to create audit log:', err.message))

    // Log verification simulator details
    console.log(`[Invite Simulator] Invite link for ${normalizedEmail} (Role: ${role}): http://localhost:5173/accept-invite?token=${rawToken}`)

    res.status(201).json({
      success: true,
      message: 'Invitation generated successfully.',
      data: {
        inviteId: invite._id,
        email: normalizedEmail,
        role,
        token: rawToken, // Send unhashed token so client can accept it
      }
    })
  } catch (err) { next(err) }
}

/**
 * DELETE /api/workspaces/active/team/members/:userId
 * Removes a member from the workspace.
 */
export async function removeMember(req, res, next) {
  try {
    const { userId } = req.params

    if (req.userRole !== 'owner' && req.userRole !== 'admin') {
      throw new AppError('Forbidden: Only owners and admins can remove members', 403)
    }

    const workspace = req.workspace

    // Find the target member in the workspace
    const targetMemberIndex = workspace.members.findIndex(
      m => m.userId.toString() === userId.toString()
    )

    if (targetMemberIndex === -1) {
      throw new AppError('User is not a member of this workspace', 404)
    }

    const targetMember = workspace.members[targetMemberIndex]

    // Owners cannot be removed via this endpoint
    if (targetMember.role === 'owner') {
      throw new AppError('Forbidden: Workspace owner cannot be removed', 400)
    }

    // Admins cannot remove other admins
    if (req.userRole === 'admin' && targetMember.role === 'admin') {
      throw new AppError('Forbidden: Admins cannot remove other admins', 403)
    }

    // Remove member
    workspace.members.splice(targetMemberIndex, 1)
    await workspace.save()

    // Update the removed user's activeWorkspaceId if they are currently active in it
    const targetUser = await User.findById(userId)
    if (targetUser && targetUser.activeWorkspaceId && targetUser.activeWorkspaceId.toString() === workspace._id.toString()) {
      const otherWorkspace = await Workspace.findOne({
        'members.userId': userId,
        isDeleted: false,
      })
      targetUser.activeWorkspaceId = otherWorkspace ? otherWorkspace._id : null
      await targetUser.save()
    }

    // Write AuditLog
    await AuditLog.create({
      workspaceId: workspace._id,
      userId: req.user._id,
      action: 'workspace.member.remove',
      details: { removedUserId: userId },
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    }).catch(err => console.warn('Failed to create audit log:', err.message))

    res.json({ success: true, message: 'Member removed successfully.' })
  } catch (err) { next(err) }
}

/**
 * PUT /api/workspaces/active/team/members/:userId/role
 * Updates a member's role in the workspace.
 */
export async function updateMemberRole(req, res, next) {
  try {
    const { userId } = req.params
    const { role } = req.body

    if (!role) {
      throw new AppError('Role is required', 400)
    }

    if (req.userRole !== 'owner' && req.userRole !== 'admin') {
      throw new AppError('Forbidden: Only owners and admins can edit member roles', 403)
    }

    // Check if updating to 'owner' or other roles
    if (role === 'owner') {
      throw new AppError('Forbidden: Cannot assign Owner role. Ownership transfer is not supported.', 400)
    }

    const workspace = req.workspace

    // Find member
    const targetMember = workspace.members.find(m => m.userId.toString() === userId.toString())
    if (!targetMember) {
      throw new AppError('Member not found in workspace', 404)
    }

    if (targetMember.role === 'owner') {
      throw new AppError('Forbidden: Cannot modify the role of the workspace owner', 400)
    }

    // Admins cannot change roles of other admins, and cannot promote/demote to/from admin
    if (req.userRole === 'admin') {
      if (targetMember.role === 'admin' || role === 'admin') {
        throw new AppError('Forbidden: Admins cannot modify admin roles', 403)
      }
    }

    const oldRole = targetMember.role
    targetMember.role = role
    await workspace.save()

    // Write AuditLog
    await AuditLog.create({
      workspaceId: workspace._id,
      userId: req.user._id,
      action: 'workspace.member.role_update',
      details: { targetUserId: userId, oldRole, newRole: role },
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    }).catch(err => console.warn('Failed to create audit log:', err.message))

    res.json({ success: true, message: 'Member role updated successfully.' })
  } catch (err) { next(err) }
}

/**
 * POST /api/workspaces/invites/accept
 * Accepts team invitation. The user accepts it by providing the UNHASHED token.
 */
export async function acceptInvite(req, res, next) {
  try {
    const { token } = req.body
    if (!token) {
      throw new AppError('Invitation token is required', 400)
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

    const invite = await WorkspaceInvite.findOne({
      token: hashedToken,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    })

    if (!invite) {
      throw new AppError('Invalid or expired invitation token', 400)
    }

    // Ensure the logged in user's email matches the invite email
    if (req.user.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new AppError('Forbidden: This invitation belongs to a different email address.', 403)
    }

    // Fetch the workspace
    const workspace = await Workspace.findOne({ _id: invite.workspaceId, isDeleted: false })
    if (!workspace) {
      throw new AppError('Workspace not found or has been deleted.', 404)
    }

    // Check if the user is already a member (just in case)
    const isMember = workspace.members.some(m => m.userId.toString() === req.user._id.toString())
    if (isMember) {
      invite.status = 'accepted'
      await invite.save()
      return res.json({ success: true, message: 'You are already a member of this workspace.', data: workspace })
    }

    // Add member
    workspace.members.push({
      userId: req.user._id,
      role: invite.role,
    })
    await workspace.save()

    // Mark invitation as accepted
    invite.status = 'accepted'
    await invite.save()

    // Set user's active workspace
    req.user.activeWorkspaceId = workspace._id
    await req.user.save()

    // Write AuditLog
    await AuditLog.create({
      workspaceId: workspace._id,
      userId: req.user._id,
      action: 'workspace.invite.accept',
      details: { inviteId: invite._id, role: invite.role },
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    }).catch(err => console.warn('Failed to create audit log:', err.message))

    res.json({
      success: true,
      message: `Successfully joined workspace: ${workspace.name}`,
      data: workspace,
    })
  } catch (err) { next(err) }
}
