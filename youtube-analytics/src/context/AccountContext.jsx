import { createContext, useState, useContext, useCallback, useEffect } from 'react'
import {
  getInstagramAccounts,
  addInstagramAccount,
  deleteInstagramAccount,
  getInstagramAnalytics,
  getInstagramPosts,
  getInstagramAuthUrl
} from '../services/api'
import { usePlatform } from './PlatformContext'

const AccountContext = createContext()

const FALLBACK_ACCOUNTS = {
  instagram: [
    {
      id: 'demo_ig',
      accountId: 'demo_ig',
      username: '@demo_instagram',
      displayName: 'No Instagram account connected',
      profileImage: 'https://ui-avatars.com/api/?name=Add+Account&background=E1306C&color=fff&size=120',
      followers: 0,
      following: 0,
      postsCount: 0,
      category: 'General',
      isVerified: false,
    }
  ],
  twitter: [
    {
      id: 'demo_tw',
      accountId: 'demo_tw',
      username: '@demo_twitter',
      displayName: 'No Twitter/X account connected',
      profileImage: 'https://ui-avatars.com/api/?name=Twitter+Demo&background=000000&color=fff&size=120',
      followers: 0,
      following: 0,
      postsCount: 0,
      category: 'General',
      isVerified: false,
    }
  ],
  linkedin: [
    {
      id: 'demo_li',
      accountId: 'demo_li',
      username: '@demo_linkedin',
      displayName: 'No LinkedIn page connected',
      profileImage: 'https://ui-avatars.com/api/?name=LinkedIn+Demo&background=0077B5&color=fff&size=120',
      followers: 0,
      following: 0,
      postsCount: 0,
      category: 'General',
      isVerified: false,
    }
  ]
}

export function AccountProvider({ children }) {
  const { selectedPlatform } = usePlatform()
  
  // Accounts lists per platform
  const [accounts, setAccounts] = useState({
    instagram: [],
    twitter: FALLBACK_ACCOUNTS.twitter,
    linkedin: FALLBACK_ACCOUNTS.linkedin,
  })

  // Selected account ID per platform
  const [selectedAccountIds, setSelectedAccountIds] = useState({
    instagram: null,
    twitter: 'demo_tw',
    linkedin: 'demo_li',
  })

  // Analytics data per platform
  const [analyticsData, setAnalyticsData] = useState({
    instagram: null,
    twitter: null,
    linkedin: null,
  })

  // Posts data per platform
  const [postsData, setPostsData] = useState({
    instagram: [],
    twitter: [],
    linkedin: [],
  })

  const [loading, setLoading] = useState({
    instagram: false,
    twitter: false,
    linkedin: false,
  })

  const [error, setError] = useState(null)

  // Load Instagram accounts from backend
  const loadInstagramAccounts = useCallback(async () => {
    setLoading(prev => ({ ...prev, instagram: true }))
    try {
      const res = await getInstagramAccounts()
      const raw = res.data || []
      
      const formatted = raw.map(acc => ({
        id: acc.accountId,
        accountId: acc.accountId,
        username: acc.username,
        displayName: acc.displayName,
        profileImage: acc.profileImage,
        followers: acc.followers,
        following: acc.following,
        postsCount: acc.postsCount,
        category: acc.category,
        isVerified: acc.isVerified,
      }))

      setAccounts(prev => ({
        ...prev,
        instagram: formatted.length ? formatted : FALLBACK_ACCOUNTS.instagram
      }))

      // Auto-select first account if none selected
      if (formatted.length) {
        setSelectedAccountIds(prev => {
          const current = prev.instagram
          const exists = formatted.some(a => a.accountId === current)
          return {
            ...prev,
            instagram: exists ? current : formatted[0].accountId
          }
        })
      } else {
        setSelectedAccountIds(prev => ({ ...prev, instagram: 'demo_ig' }))
      }
    } catch (err) {
      console.error('Failed to load Instagram accounts:', err)
      setAccounts(prev => ({ ...prev, instagram: FALLBACK_ACCOUNTS.instagram }))
      setSelectedAccountIds(prev => ({ ...prev, instagram: 'demo_ig' }))
    } finally {
      setLoading(prev => ({ ...prev, instagram: false }))
    }
  }, [])

  // On mount, load Instagram accounts. Also re-load after returning from the
  // Instagram OAuth callback, which lands at /instagram/accounts?connected=true.
  useEffect(() => {
    loadInstagramAccounts()
  }, [loadInstagramAccounts])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('connected') === 'true' || params.get('error')) {
      loadInstagramAccounts()
    }
  }, [loadInstagramAccounts])

  // Select account helper
  const setSelectedAccount = useCallback((platform, accountId) => {
    setSelectedAccountIds(prev => ({ ...prev, [platform]: accountId }))
  }, [])

  // Fetch analytics for selected account
  const fetchInstagramAnalytics = useCallback(async (accountId) => {
    if (!accountId || accountId === 'demo_ig') {
      setAnalyticsData(prev => ({ ...prev, instagram: null }))
      setPostsData(prev => ({ ...prev, instagram: [] }))
      return
    }

    setLoading(prev => ({ ...prev, instagram: true }))
    setError(null)
    try {
      const [analyticsRes, postsRes] = await Promise.all([
        getInstagramAnalytics(accountId),
        getInstagramPosts(accountId)
      ])

      if (analyticsRes?.success) {
        setAnalyticsData(prev => ({ ...prev, instagram: analyticsRes.data }))
      } else {
        setAnalyticsData(prev => ({ ...prev, instagram: null }))
      }
      if (postsRes?.success) {
        setPostsData(prev => ({ ...prev, instagram: postsRes.data }))
      } else {
        setPostsData(prev => ({ ...prev, instagram: [] }))
      }
    } catch (err) {
      console.error('Failed to fetch Instagram data:', err)
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to fetch Instagram account data'
      setError(msg)
      setAnalyticsData(prev => ({ ...prev, instagram: null }))
    } finally {
      setLoading(prev => ({ ...prev, instagram: false }))
    }
  }, [])

  // Trigger data fetch when selected account changes
  useEffect(() => {
    const activeId = selectedAccountIds.instagram
    if (activeId) {
      fetchInstagramAnalytics(activeId)
    }
  }, [selectedAccountIds.instagram, fetchInstagramAnalytics])

  // CRUD Connect Account
  const connectNewAccount = useCallback(async (platform, payload) => {
    if (platform !== 'instagram') {
      // Mock other platforms
      const mockId = `${platform}_${Math.random().toString(36).substring(2, 8)}`
      const newAcc = {
        id: mockId,
        accountId: mockId,
        username: `@${payload.username.replace('@', '')}`,
        displayName: payload.displayName || payload.username,
        profileImage: `https://ui-avatars.com/api/?name=${encodeURIComponent(payload.displayName || payload.username)}&background=000&color=fff`,
        followers: 12000,
        following: 500,
        postsCount: 45,
        category: payload.category || 'Creator',
        isVerified: false,
      }
      setAccounts(prev => ({
        ...prev,
        [platform]: prev[platform].filter(a => a.id.startsWith('demo_')) ? [newAcc] : [...prev[platform], newAcc]
      }))
      setSelectedAccountIds(prev => ({ ...prev, [platform]: mockId }))
      return { success: true, data: newAcc }
    }

    // Instagram: prefer the OAuth flow, which stores a real encrypted Meta
    // access token. The username-only path creates a fake token that the
    // analytics controller cannot use against Meta Graph API.
    setLoading(prev => ({ ...prev, instagram: true }))
    try {
      const urlRes = await getInstagramAuthUrl()
      const authUrl = urlRes?.data?.authUrl
      if (!authUrl) {
        throw new Error('Backend did not return an Instagram OAuth URL. Check that INSTAGRAM_CLIENT_ID, INSTAGRAM_CLIENT_SECRET, and INSTAGRAM_REDIRECT_URI are set on the backend.')
      }
      // Redirect the user to Meta's OAuth consent screen. After consent,
      // Meta redirects back to /instagram/accounts?connected=true, which
      // triggers a reload of accounts on that page.
      window.location.href = authUrl
      return { success: true, data: { redirecting: true } }
    } catch (err) {
      console.error('Failed to start Instagram OAuth:', err)
      throw err
    } finally {
      setLoading(prev => ({ ...prev, instagram: false }))
    }
  }, [loadInstagramAccounts])

  // CRUD Disconnect Account
  const disconnectAccount = useCallback(async (platform, accountId) => {
    if (platform !== 'instagram') {
      setAccounts(prev => {
        const filtered = prev[platform].filter(a => a.accountId !== accountId)
        return {
          ...prev,
          [platform]: filtered.length ? filtered : FALLBACK_ACCOUNTS[platform]
        }
      })
      setSelectedAccountIds(prev => ({
        ...prev,
        [platform]: FALLBACK_ACCOUNTS[platform][0].accountId
      }))
      return { success: true }
    }

    setLoading(prev => ({ ...prev, instagram: true }))
    try {
      const res = await deleteInstagramAccount(accountId)
      if (res?.success) {
        await loadInstagramAccounts()
      }
      return res
    } catch (err) {
      console.error('Failed to disconnect Instagram account:', err)
      throw err;
    } finally {
      setLoading(prev => ({ ...prev, instagram: false }))
    }
  }, [loadInstagramAccounts])

  // Helper to get active account object
  const getActiveAccount = (platform) => {
    const list = accounts[platform] || []
    const activeId = selectedAccountIds[platform]
    return list.find(a => a.accountId === activeId) || list[0] || (FALLBACK_ACCOUNTS[platform] ? FALLBACK_ACCOUNTS[platform][0] : null)
  }

  const activeAccount = getActiveAccount(selectedPlatform)

  return (
    <AccountContext.Provider
      value={{
        accounts,
        selectedAccountIds,
        setSelectedAccount,
        activeAccount,
        analyticsData: analyticsData[selectedPlatform],
        postsData: postsData[selectedPlatform],
        loading: loading[selectedPlatform],
        isGlobalLoading: loading.instagram || loading.twitter || loading.linkedin,
        error,
        connectAccount: connectNewAccount,
        disconnectAccount,
        refreshAccounts: loadInstagramAccounts,
      }}
    >
      {children}
    </AccountContext.Provider>
  )
}

export function useAccount() {
  const ctx = useContext(AccountContext)
  if (!ctx) throw new Error('useAccount must be used within AccountProvider')
  return ctx
}
