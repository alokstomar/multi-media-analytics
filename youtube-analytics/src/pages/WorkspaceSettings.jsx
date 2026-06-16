import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import {
  Settings as SettingsIcon, Users, Palette, Globe, Save, UserPlus, Trash2,
  Shield, Crown, Edit3, Eye, Copy, Check, Clock, Mail, RefreshCw, Plus
} from 'lucide-react'

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai',
  'Asia/Kolkata', 'Asia/Dubai', 'Australia/Sydney', 'Pacific/Auckland',
]

const ROLE_ICONS = {
  owner: Crown,
  admin: Shield,
  editor: Edit3,
  viewer: Eye,
}

const ROLE_COLORS = {
  owner: '#f59e0b',
  admin: '#7c3aed',
  editor: '#06b6d4',
  viewer: '#6b7280',
}

export default function WorkspaceSettings() {
  const { activeWorkspace, user, fetchMe, fetchWorkspaces } = useAuth()
  const [activeTab, setActiveTab] = useState('general')

  // General settings state
  const [wsName, setWsName] = useState('')
  const [timezone, setTimezone] = useState('UTC')
  const [primaryColor, setPrimaryColor] = useState('#4f46e5')
  const [secondaryColor, setSecondaryColor] = useState('#06b6d4')
  const [savingGeneral, setSavingGeneral] = useState(false)
  const [generalMsg, setGeneralMsg] = useState('')

  // Team state
  const [members, setMembers] = useState([])
  const [pendingInvites, setPendingInvites] = useState([])
  const [loadingTeam, setLoadingTeam] = useState(false)

  // Invite state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('editor')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')
  const [copiedToken, setCopiedToken] = useState('')

  // Create workspace modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newWsName, setNewWsName] = useState('')
  const [creating, setCreating] = useState(false)

  const currentRole = activeWorkspace?.members?.find(
    m => (m.userId?._id || m.userId)?.toString() === user?._id?.toString()
  )?.role || 'viewer'

  const canManageTeam = currentRole === 'owner' || currentRole === 'admin'

  useEffect(() => {
    if (activeWorkspace) {
      setWsName(activeWorkspace.name || '')
      setTimezone(activeWorkspace.timezone || 'UTC')
      setPrimaryColor(activeWorkspace.branding?.primaryColor || '#4f46e5')
      setSecondaryColor(activeWorkspace.branding?.secondaryColor || '#06b6d4')
    }
  }, [activeWorkspace])

  const fetchTeam = useCallback(async () => {
    if (!activeWorkspace) return
    setLoadingTeam(true)
    try {
      const res = await api.get('/api/workspaces/active/team')
      if (res.data.success) {
        setMembers(res.data.data.members || [])
        setPendingInvites(res.data.data.pendingInvites || [])
      }
    } catch (err) {
      console.error('Failed to fetch team:', err)
    } finally {
      setLoadingTeam(false)
    }
  }, [activeWorkspace])

  useEffect(() => {
    if (activeTab === 'team') fetchTeam()
  }, [activeTab, fetchTeam])

  const handleSaveGeneral = async () => {
    setSavingGeneral(true)
    setGeneralMsg('')
    try {
      await api.put(`/api/workspaces/${activeWorkspace._id}`, {
        name: wsName,
        timezone,
        branding: { primaryColor, secondaryColor },
      })
      setGeneralMsg('Settings saved successfully!')
      await fetchMe()
      await fetchWorkspaces()
    } catch (err) {
      setGeneralMsg(err.response?.data?.error || 'Failed to save.')
    } finally {
      setSavingGeneral(false)
    }
  }

  const handleInvite = async (e) => {
    e.preventDefault()
    setInviting(true)
    setInviteMsg('')
    try {
      const res = await api.post('/api/workspaces/active/team/invite', { email: inviteEmail, role: inviteRole })
      if (res.data.success) {
        setInviteMsg(`Invitation sent! Token: ${res.data.data.token}`)
        setCopiedToken(res.data.data.token)
        setInviteEmail('')
        fetchTeam()
      }
    } catch (err) {
      setInviteMsg(err.response?.data?.error || 'Failed to send invitation.')
    } finally {
      setInviting(false)
    }
  }

  const handleRemoveMember = async (userId) => {
    if (!confirm('Remove this member from the workspace?')) return
    try {
      await api.delete(`/api/workspaces/active/team/members/${userId}`)
      fetchTeam()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to remove member.')
    }
  }

  const handleUpdateRole = async (userId, newRole) => {
    try {
      await api.put(`/api/workspaces/active/team/members/${userId}/role`, { role: newRole })
      fetchTeam()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update role.')
    }
  }

  const handleCreateWorkspace = async (e) => {
    e.preventDefault()
    setCreating(true)
    try {
      await api.post('/api/workspaces', { name: newWsName })
      setShowCreateModal(false)
      setNewWsName('')
      await fetchMe()
      await fetchWorkspaces()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create workspace.')
    } finally {
      setCreating(false)
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    setCopiedToken(text)
    setTimeout(() => setCopiedToken(''), 3000)
  }

  const tabs = [
    { id: 'general', label: 'General', icon: SettingsIcon },
    { id: 'branding', label: 'Branding', icon: Palette },
    { id: 'team', label: 'Team', icon: Users },
  ]

  if (!activeWorkspace) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">No active workspace. Please create one.</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workspace Settings</h1>
          <p className="text-gray-500 mt-1">Manage your workspace configuration and team</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white font-medium transition-all duration-200 hover:scale-[1.02] cursor-pointer text-sm"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}
        >
          <Plus className="w-4 h-4" /> New Workspace
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-gray-100 rounded-xl w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* General Settings */}
      {activeTab === 'general' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-gray-400" /> General Settings
          </h2>

          <div className="space-y-5 max-w-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Workspace Name</label>
              <input
                id="ws-name"
                type="text"
                value={wsName}
                onChange={(e) => setWsName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                <Globe className="w-4 h-4 text-gray-400" /> Timezone
              </label>
              <select
                id="ws-timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all bg-white"
              >
                {TIMEZONES.map(tz => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>

            {generalMsg && (
              <div className={`p-3 rounded-lg text-sm ${generalMsg.includes('success') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {generalMsg}
              </div>
            )}

            <button
              onClick={handleSaveGeneral}
              disabled={savingGeneral || !canManageTeam}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {savingGeneral ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* Branding */}
      {activeTab === 'branding' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <Palette className="w-5 h-5 text-gray-400" /> Branding
          </h2>

          <div className="space-y-6 max-w-lg">
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-gray-300 text-sm w-28 font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-gray-300 text-sm w-28 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Preview */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Preview</label>
              <div className="flex gap-4">
                <div className="w-32 h-20 rounded-xl flex items-center justify-center text-white text-sm font-semibold" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}>
                  Gradient
                </div>
                <div className="w-20 h-20 rounded-xl flex items-center justify-center text-white text-sm font-semibold" style={{ background: primaryColor }}>
                  Primary
                </div>
                <div className="w-20 h-20 rounded-xl flex items-center justify-center text-white text-sm font-semibold" style={{ background: secondaryColor }}>
                  Secondary
                </div>
              </div>
            </div>

            <button
              onClick={handleSaveGeneral}
              disabled={savingGeneral || !canManageTeam}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {savingGeneral ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Branding
            </button>
          </div>
        </div>
      )}

      {/* Team Management */}
      {activeTab === 'team' && (
        <div className="space-y-6">
          {/* Invite Section */}
          {canManageTeam && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-gray-400" /> Invite Team Member
              </h3>
              <form onSubmit={handleInvite} className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      id="invite-email"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      required
                      placeholder="colleague@example.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500/30 text-sm"
                    />
                  </div>
                </div>
                <div className="w-36">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                  >
                    <option value="admin">Admin</option>
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={inviting}
                  className="px-5 py-2.5 rounded-lg bg-violet-600 text-white font-medium text-sm hover:bg-violet-700 disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-2"
                >
                  {inviting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Invite
                </button>
              </form>

              {inviteMsg && (
                <div className="mt-4 p-3 rounded-lg text-sm bg-blue-50 text-blue-700 border border-blue-200">
                  <p>{inviteMsg}</p>
                  {copiedToken && (
                    <div className="mt-2 flex items-center gap-2">
                      <code className="text-xs bg-blue-100 px-2 py-1 rounded font-mono break-all">{`http://localhost:5173/accept-invite?token=${copiedToken}`}</code>
                      <button
                        onClick={() => copyToClipboard(`http://localhost:5173/accept-invite?token=${copiedToken}`)}
                        className="p-1.5 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Members Table */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-400" /> Team Members
              <span className="text-sm font-normal text-gray-500">({members.length})</span>
            </h3>

            {loadingTeam ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {members.map((member) => {
                  const memberId = member.userId?._id || member.userId
                  const memberName = member.userId?.name || 'Unknown'
                  const memberEmail = member.userId?.email || ''
                  const RoleIcon = ROLE_ICONS[member.role] || Eye
                  const roleColor = ROLE_COLORS[member.role] || '#6b7280'
                  const isCurrentUser = memberId?.toString() === user?._id?.toString()

                  return (
                    <div key={memberId} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}>
                          {memberName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">
                            {memberName} {isCurrentUser && <span className="text-xs text-gray-400">(you)</span>}
                          </p>
                          <p className="text-xs text-gray-500">{memberEmail}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium" style={{ background: `${roleColor}15`, color: roleColor }}>
                          <RoleIcon className="w-3.5 h-3.5" />
                          {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                        </span>

                        {canManageTeam && member.role !== 'owner' && !isCurrentUser && (
                          <div className="flex items-center gap-1">
                            <select
                              value={member.role}
                              onChange={(e) => handleUpdateRole(memberId, e.target.value)}
                              className="text-xs px-2 py-1 rounded border border-gray-200 bg-white cursor-pointer"
                            >
                              <option value="admin">Admin</option>
                              <option value="editor">Editor</option>
                              <option value="viewer">Viewer</option>
                            </select>
                            <button
                              onClick={() => handleRemoveMember(memberId)}
                              className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Pending Invites */}
          {pendingInvites.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-400" /> Pending Invitations
                <span className="text-sm font-normal text-gray-500">({pendingInvites.length})</span>
              </h3>
              <div className="divide-y divide-gray-100">
                {pendingInvites.map((invite) => (
                  <div key={invite._id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{invite.email}</p>
                      <p className="text-xs text-gray-500">
                        Invited by {invite.invitedBy?.name || 'Unknown'} · Expires {new Date(invite.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200">
                      {invite.role} · Pending
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Workspace Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Workspace</h3>
            <form onSubmit={handleCreateWorkspace}>
              <input
                type="text"
                value={newWsName}
                onChange={(e) => setNewWsName(e.target.value)}
                required
                placeholder="Workspace name..."
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500/30 mb-4"
              />
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer">Cancel</button>
                <button type="submit" disabled={creating} className="px-5 py-2 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors cursor-pointer">
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
