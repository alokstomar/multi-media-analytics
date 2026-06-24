import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import PlatformSwitcher from './PlatformSwitcher'
import { usePlatform } from '../../hooks/usePlatform'
import { useAuth } from '../../context/AuthContext'
import { ChevronDown, Building2, LogOut, Settings, Check, Plus, User } from 'lucide-react'

const titles = {
  '/dashboard': 'Dashboard',
  '/channels': 'Channels',
  '/analytics': 'Analytics',
  '/portfolio-intelligence': 'Portfolio Intelligence',
  '/content-intelligence': 'Content Intelligence',
  '/videos': 'Videos',
  '/comments': 'Comments',
  '/alerts': 'Alerts',
  '/settings': 'Settings',
  '/workspace-settings': 'Workspace Settings',
}

export default function Header() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { selectedPlatform } = usePlatform()
  const { user, activeWorkspace, workspaces, switchWorkspace, logout } = useAuth()

  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const wsMenuRef = useRef(null)
  const userMenuRef = useRef(null)

  let pageTitle = titles[pathname] ?? 'Dashboard'
  if (pathname === '/channels') {
    pageTitle = selectedPlatform === 'instagram' ? 'Accounts' : selectedPlatform === 'linkedin' ? 'Pages' : 'Channels'
  } else if (pathname === '/videos') {
    pageTitle = selectedPlatform === 'instagram' ? 'Posts' : selectedPlatform === 'linkedin' ? 'Articles' : 'Videos'
  }

  const platformPrefix = selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1)

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wsMenuRef.current && !wsMenuRef.current.contains(e.target)) setShowWorkspaceMenu(false)
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setShowUserMenu(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSwitchWorkspace = async (wsId) => {
    try {
      await switchWorkspace(wsId)
      setShowWorkspaceMenu(false)
    } catch (err) {
      console.error('Failed to switch workspace:', err)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-gray-800">
          {platformPrefix} {pageTitle}
        </h1>
        <PlatformSwitcher />
      </div>

      <div className="flex items-center gap-3">
        {/* Workspace Selector */}
        {activeWorkspace && (
          <div className="relative" ref={wsMenuRef}>
            <button
              onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:bg-gray-50/50 hover:border-gray-300 hover:shadow-sm transition-all duration-200 text-sm cursor-pointer"
            >
              <div className="w-6.5 h-6.5 rounded bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-800 text-xs font-semibold flex-shrink-0">
                {activeWorkspace.name?.charAt(0)?.toUpperCase() || 'W'}
              </div>
              <span className="font-semibold text-gray-800 max-w-[130px] truncate">{activeWorkspace.name}</span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>

            {showWorkspaceMenu && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.06)] border border-gray-200/80 py-1.5 z-50" style={{ animation: 'fadeIn 0.15s ease-out' }}>
                <div className="px-3 py-1.5 border-b border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Workspaces</p>
                </div>
                <div className="max-h-48 overflow-y-auto py-1">
                  {workspaces.map(ws => (
                    <button
                      key={ws._id}
                      onClick={() => handleSwitchWorkspace(ws._id)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50/80 transition-colors cursor-pointer"
                    >
                      <div className="w-6 h-6 rounded bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-800 text-xs font-semibold flex-shrink-0">
                        {ws.name?.charAt(0)?.toUpperCase() || 'W'}
                      </div>
                      <span className="text-gray-700 truncate font-medium flex-1">{ws.name}</span>
                      {ws._id === activeWorkspace._id && <Check className="w-4 h-4 text-gray-900 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
                <div className="border-t border-gray-100 pt-1 mt-1">
                  <button
                    onClick={() => { setShowWorkspaceMenu(false); navigate('/workspace-settings') }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <Settings className="w-4 h-4 text-gray-400" />
                    Workspace Settings
                  </button>
                  <button
                    onClick={() => { setShowWorkspaceMenu(false); navigate('/workspace-settings') }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm text-gray-900 font-semibold hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-gray-500" />
                    Create Workspace
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* User Menu */}
        {user && (() => {
          const initials = (() => {
            const fn = user.firstName || ''
            const ln = user.lastName || ''
            if (fn || ln) return `${fn.charAt(0)}${ln.charAt(0)}`.toUpperCase()
            return (user.name || 'U').charAt(0).toUpperCase()
          })()
          const displayName = user.firstName
            ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
            : user.name || ''

          return (
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center rounded-full border border-gray-200 bg-white p-0.5 hover:border-gray-300 hover:shadow-sm transition-all duration-200 cursor-pointer"
            >
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={displayName}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold select-none">
                  {initials}
                </div>
              )}
            </button>

            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.06)] border border-gray-200/80 py-1.5 z-50" style={{ animation: 'fadeIn 0.15s ease-out' }}>
                <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                  {user.avatar ? (
                    <img src={user.avatar} alt={displayName} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 select-none">
                      {initials}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{displayName}</p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{user.email}</p>
                  </div>
                </div>
                <div className="py-1">
                  <button
                    onClick={() => { setShowUserMenu(false); navigate('/settings') }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <User className="w-4 h-4 text-gray-400" />
                    Account
                  </button>
                  <button
                    onClick={() => { setShowUserMenu(false); navigate('/workspace-settings') }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <Building2 className="w-4 h-4 text-gray-400" />
                    Workspace
                  </button>
                </div>
                <div className="border-t border-gray-100 pt-1 mt-1">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50/50 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-red-400" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
          )
        })()}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </header>
  )
}
