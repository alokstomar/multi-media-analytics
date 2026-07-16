import { createContext, useState, useContext, useCallback, useEffect } from 'react'
import {
  getInstagramAccounts,
  addInstagramAccount,
  deleteInstagramAccount,
  getInstagramProfileAnalytics,
  getInstagramReels,
} from '../services/api'
import { useInstagramSyncPoll } from '../hooks/useInstagramSyncPoll'
import { usePlatform } from './PlatformContext'

const AccountContext = createContext()

const FALLBACK_ACCOUNTS = {
  instagram: [
    {
      id: 'demo_ig',
      username: 'demo_ig',
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

function normalizeUsername(raw) {
  if (typeof raw !== 'string') return ''
  return raw.trim().replace(/^@+/, '').toLowerCase()
}

export function AccountProvider({ children }) {
  const { selectedPlatform } = usePlatform()

  const [accounts, setAccounts] = useState({
    instagram: [],
    twitter: FALLBACK_ACCOUNTS.twitter,
    linkedin: FALLBACK_ACCOUNTS.linkedin,
  })

  const [selectedAccountIds, setSelectedAccountIds] = useState({
    instagram: null,
    twitter: 'demo_tw',
    linkedin: 'demo_li',
  })

  const [analyticsData, setAnalyticsData] = useState({
    instagram: null,
    twitter: null,
    linkedin: null,
  })

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

  const loadInstagramAccounts = useCallback(async () => {
    setLoading(prev => ({ ...prev, instagram: true }))
    try {
      const res = await getInstagramAccounts()
      const raw = res?.data || []

      const formatted = raw.map(acc => ({
        id: acc.username,
        username: acc.username,
        displayName: acc.fullName || acc.username,
        profileImage: acc.profilePic || '',
        followers: acc.followers || 0,
        following: acc.following || 0,
        postsCount: acc.postsCount || 0,
        category: 'Creator',
        isVerified: !!acc.verified,
        syncStatus: acc.syncStatus || 'ready',
        syncError: acc.syncError || '',
        syncedAt: acc.syncedAt || null,
      }))

      setAccounts(prev => ({
        ...prev,
        instagram: formatted.length ? formatted : FALLBACK_ACCOUNTS.instagram
      }))

      if (formatted.length) {
        setSelectedAccountIds(prev => {
          const current = prev.instagram
          const exists = formatted.some(a => a.username === current)
          return {
            ...prev,
            instagram: exists ? current : formatted[0].username
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

  useEffect(() => {
    loadInstagramAccounts()
  }, [loadInstagramAccounts])

  const setSelectedAccount = useCallback((platform, accountId) => {
    setSelectedAccountIds(prev => ({ ...prev, [platform]: accountId }))
  }, [])

  const fetchInstagramAnalytics = useCallback(async (username) => {
    if (!username || username === 'demo_ig') {
      setAnalyticsData(prev => ({ ...prev, instagram: null }))
      setPostsData(prev => ({ ...prev, instagram: [] }))
      return
    }

    setLoading(prev => ({ ...prev, instagram: true }))
    setError(null)
    try {
      const [analyticsRes, reelsRes] = await Promise.all([
        getInstagramProfileAnalytics(username).catch(() => null),
        getInstagramReels(username).catch(() => null),
      ])

      const analytics = analyticsRes?.data
      const rawReels = reelsRes?.data || []
      const reels = rawReels.map(p => {
        const reach = p.reach !== undefined ? p.reach : (p.views || 0)
        const likes = p.likes || 0
        const comments = p.comments || 0
        const code = p.rawPayload?.media?.code || p.code || p.reelId || ''
        return {
          ...p,
          id: p._id || p.reelId,
          thumbnail: p.thumbnail || 
            p.rawPayload?.media?.image_versions2?.candidates?.[0]?.url || 
            p.rawPayload?.image_versions2?.candidates?.[0]?.url || 
            p.rawPayload?.media?.image_versions2?.candidates?.[0]?.url_wrapped || 
            p.rawPayload?.image_versions2?.candidates?.[0]?.url_wrapped,
          caption: p.caption || (code ? `Instagram Post (${code})` : 'Instagram Post'),
          type: p.type || (p.mediaType === 'Video' ? 'Reel' : (p.mediaType === 'Image' ? 'Story' : (p.mediaType || 'Post'))),
          reach,
          publishedAt: p.publishedAt ? p.publishedAt : p.publishDate,
          saves: p.saves || p.rawPayload?.media?.save_count || p.rawPayload?.save_count || 0,
          shares: p.shares || p.rawPayload?.media?.reshare_count || p.rawPayload?.reshare_count || 0,
          engagementRate: p.engagementRate !== undefined 
            ? p.engagementRate 
            : (reach > 0 ? ((likes + comments) / reach) * 100 : 0)
        }
      })

      if (analytics) {
        setAnalyticsData(prev => ({ ...prev, instagram: analytics }))
      } else {
        setAnalyticsData(prev => ({ ...prev, instagram: null }))
      }
      setPostsData(prev => ({ ...prev, instagram: reels }))
    } catch (err) {
      console.error('Failed to fetch Instagram data:', err)
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to fetch Instagram account data'
      setError(msg)
      setAnalyticsData(prev => ({ ...prev, instagram: null }))
    } finally {
      setLoading(prev => ({ ...prev, instagram: false }))
    }
  }, [])

  useEffect(() => {
    const activeId = selectedAccountIds.instagram
    if (activeId) {
      fetchInstagramAnalytics(activeId)
    }
  }, [selectedAccountIds.instagram, fetchInstagramAnalytics])

  const handleSyncStatusChange = useCallback((username, status) => {
    if (status.syncStatus === 'ready' || status.syncStatus === 'error') {
      loadInstagramAccounts()
    }
  }, [loadInstagramAccounts])

  const instagramAccountsForPoll = accounts.instagram
    .filter(a => a.id !== 'demo_ig')
    .map(a => ({ username: a.username, syncStatus: a.syncStatus }))

  useInstagramSyncPoll(instagramAccountsForPoll, handleSyncStatusChange)

  const connectNewAccount = useCallback(async (platform, payload) => {
    if (platform !== 'instagram') {
      // Twitter and LinkedIn are connected via their own OAuth flows
      // (services/twitterOAuthService, services/linkedInOAuthService), not via
      // username entry. This branch previously fabricated a placeholder account
      // with hardcoded follower metrics — never acceptable in production.
      const err = new Error(
        `${platform} accounts must be connected via OAuth. Direct username connect is not supported.`
      )
      err.code = 'OAUTH_REQUIRED'
      throw err
    }

    const username = normalizeUsername(payload?.username || '')
    if (!username) {
      const err = new Error('Username is required')
      throw err
    }

    setLoading(prev => ({ ...prev, instagram: true }))
    try {
      const res = await addInstagramAccount(username)
      await loadInstagramAccounts()
      setSelectedAccountIds(prev => ({ ...prev, instagram: username }))
      return res || { success: true, data: { username } }
    } catch (err) {
      console.error('Failed to add Instagram account:', err)
      throw err
    } finally {
      setLoading(prev => ({ ...prev, instagram: false }))
    }
  }, [loadInstagramAccounts])

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
      await loadInstagramAccounts()
      return res
    } catch (err) {
      console.error('Failed to disconnect Instagram account:', err)
      throw err;
    } finally {
      setLoading(prev => ({ ...prev, instagram: false }))
    }
  }, [loadInstagramAccounts])

  const getActiveAccount = (platform) => {
    const list = accounts[platform] || []
    const activeId = selectedAccountIds[platform]
    return list.find(a => (a.accountId === activeId) || (a.username === activeId)) || list[0] || (FALLBACK_ACCOUNTS[platform] ? FALLBACK_ACCOUNTS[platform][0] : null)
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
