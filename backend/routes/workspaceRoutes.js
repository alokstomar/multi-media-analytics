import express from 'express'
import {
  getWorkspaces,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  switchWorkspace,
  getTeam,
  inviteMember,
  removeMember,
  updateMemberRole,
  acceptInvite,
} from '../controllers/workspaceController.js'
import { requireAuth, requireWorkspace } from '../middlewares/authMiddleware.js'

const router = express.Router()

// Workspace CRUD & Switch
router.get('/', requireAuth, getWorkspaces)
router.post('/', requireAuth, createWorkspace)
router.put('/:id', requireAuth, requireWorkspace, updateWorkspace)
router.delete('/:id', requireAuth, requireWorkspace, deleteWorkspace)
router.post('/switch', requireAuth, switchWorkspace)

// Workspace Invites - Accept doesn't require a workspace ID because it resolves it from the token
router.post('/invites/accept', requireAuth, acceptInvite)

// Team management (runs in the context of the active workspace)
router.get('/active/team', requireAuth, requireWorkspace, getTeam)
router.post('/active/team/invite', requireAuth, requireWorkspace, inviteMember)
router.delete('/active/team/members/:userId', requireAuth, requireWorkspace, removeMember)
router.put('/active/team/members/:userId/role', requireAuth, requireWorkspace, updateMemberRole)

export default router
