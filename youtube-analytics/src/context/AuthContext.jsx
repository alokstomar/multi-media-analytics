import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import api, { logoutUser } from '../services/api'

const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [activeWorkspace, setActiveWorkspace] = useState(null)
  const [workspaces, setWorkspaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Fetch current user profile on mount (relies on HttpOnly cookie)
  const fetchMe = useCallback(async () => {
    try {
      const res = await api.get('/api/auth/me')
      if (res.data.success) {
        setUser(res.data.data.user)
        setActiveWorkspace(res.data.data.activeWorkspace)
        if (res.data.data.activeWorkspace) {
          localStorage.setItem('activeWorkspaceId', res.data.data.activeWorkspace._id)
        } else {
          localStorage.removeItem('activeWorkspaceId')
        }
        setError(null)
      }
    } catch {
      setUser(null)
      setActiveWorkspace(null)
      localStorage.removeItem('activeWorkspaceId')
    }
  }, [])

  const fetchWorkspaces = useCallback(async () => {
    try {
      const res = await api.get('/api/workspaces')
      if (res.data.success) {
        setWorkspaces(res.data.data)
      }
    } catch {
      setWorkspaces([])
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await fetchMe()
      setLoading(false)
    }
    init()
  }, [fetchMe])

  // After login, load workspaces too
  useEffect(() => {
    if (user) {
      fetchWorkspaces()
    } else {
      setWorkspaces([])
    }
  }, [user, fetchWorkspaces])

  const signup = async (name, email, password) => {
    setError(null)
    const res = await api.post('/api/auth/signup', { name, email, password })
    if (res.data.success) {
      setUser(res.data.data.user)
      setActiveWorkspace(res.data.data.workspace)
      if (res.data.data.workspace) {
        localStorage.setItem('activeWorkspaceId', res.data.data.workspace._id)
      }
    }
    return res.data
  }

  const login = async (email, password) => {
    setError(null)
    const res = await api.post('/api/auth/login', { email, password })
    if (res.data?.success) {
      setUser(res.data.data.user)
      if (res.data.data.activeWorkspace) {
        setActiveWorkspace(res.data.data.activeWorkspace)
        localStorage.setItem('activeWorkspaceId', res.data.data.activeWorkspace._id)
      } else {
        localStorage.removeItem('activeWorkspaceId')
      }
    }
    return res.data
  }

  const logout = async () => {
    try {
      await logoutUser()
    } catch (e) {
      console.error(e)
    } finally {
      setUser(null)
      setActiveWorkspace(null)
      setWorkspaces([])
      localStorage.clear()
      sessionStorage.clear()
      try {
        queryClient?.clear?.()
      } catch (err) {
        console.error('Failed to clear query client:', err)
      }
      navigate('/login', { replace: true })
    }
  }

  const switchWorkspace = async (workspaceId) => {
    const res = await api.post('/api/workspaces/switch', { workspaceId })
    if (res.data.success) {
      setActiveWorkspace(res.data.data.workspace)
      if (res.data.data.workspace) {
        localStorage.setItem('activeWorkspaceId', res.data.data.workspace._id)
      }
      // Update user's activeWorkspaceId locally
      setUser(prev => prev ? { ...prev, activeWorkspaceId: res.data.data.activeWorkspaceId } : prev)
    }
    return res.data
  }

  const createWorkspace = async (data) => {
    const res = await api.post('/api/workspaces', data)
    if (res.data.success) {
      setActiveWorkspace(res.data.data)
      if (res.data.data) {
        localStorage.setItem('activeWorkspaceId', res.data.data._id)
      }
      await fetchWorkspaces()
    }
    return res.data
  }

  const isAuthenticated = !!user

  // Partially update the in-memory user object (e.g. after profile save).
  // This avoids a full GET /api/auth/me round-trip while keeping the UI in sync.
  const updateUser = (partial) => {
    setUser(prev => prev ? { ...prev, ...partial } : prev)
  }

  return (
    <AuthContext.Provider value={{
      user,
      activeWorkspace,
      workspaces,
      loading,
      error,
      isAuthenticated,
      signup,
      login,
      logout,
      switchWorkspace,
      createWorkspace,
      fetchMe,
      fetchWorkspaces,
      setActiveWorkspace,
      updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthContext
