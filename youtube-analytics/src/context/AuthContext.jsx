import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../services/api'

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
      await api.post('/api/auth/logout')
    } catch {
      // Ignore logout errors
    }
    setUser(null)
    setActiveWorkspace(null)
    setWorkspaces([])
    localStorage.removeItem('activeWorkspaceId')
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
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthContext
