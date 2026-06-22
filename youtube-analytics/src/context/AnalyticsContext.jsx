import { createContext, useState, useContext, useCallback, useRef, useEffect } from 'react'
import {
  getChannels,
  getAnalytics,
  getInsights,
  addChannel as apiAddChannel,
  deleteChannel as apiDeleteChannel,
  refreshChannel as apiRefreshChannel,
} from '../services/api'
import { mapChannelToSelector, transformAnalytics } from '../utils/transformAnalytics'

const AnalyticsContext = createContext()

const TRANSITION_MS = 400

// Default channel used when no channels exist in the DB
const FALLBACK_CHANNELS = [
  {
    id: 'demo',
    name: 'No channels yet',
    handle: '@demo',
    avatar: 'https://ui-avatars.com/api/?name=Add+Channel&background=3B82F6&color=fff&size=120',
    color: '#3B82F6',
    gradient: 'from-blue-500 to-indigo-600',
    subscribers: '0',
    subscriberCount: 'Add a channel to get started',
    growth: '+0%',
    growthUp: true,
    verified: false,
    contentLabel: 'Video',
    category: 'General',
  },
]

export function AnalyticsProvider({ children }) {
  const [allChannels, setAllChannels] = useState([])
  const [activeChannelId, setActiveChannelId] = useState(null)
  const [channelData, setChannelData] = useState(() => getEmptyData())
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [channelsLoading, setChannelsLoading] = useState(true)
  const [lastChannelsRefresh, setLastChannelsRefresh] = useState(0)
  const timerRef = useRef(null)
  const channelsTimerRef = useRef(null)
  const transitionTimerRef = useRef(null)

  // Load channels on mount
  useEffect(() => {
    loadChannelsFromAPI()
  }, [])

  // Safety net: force channelsLoading off after 15s even if loadChannelsFromAPI hangs
  useEffect(() => {
    if (!channelsLoading) {
      if (channelsTimerRef.current) {
        clearTimeout(channelsTimerRef.current)
        channelsTimerRef.current = null
      }
      return
    }
    channelsTimerRef.current = setTimeout(() => {
      setChannelsLoading(false)
      channelsTimerRef.current = null
    }, 15_000)
    return () => {
      if (channelsTimerRef.current) {
        clearTimeout(channelsTimerRef.current)
        channelsTimerRef.current = null
      }
    }
  }, [channelsLoading])

  // Safety net: force isTransitioning off after 8s even if fetchChannelData hangs
  useEffect(() => {
    if (!isTransitioning) {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current)
        transitionTimerRef.current = null
      }
      return
    }
    transitionTimerRef.current = setTimeout(() => {
      setIsTransitioning(false)
      transitionTimerRef.current = null
    }, 8_000)
    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current)
        transitionTimerRef.current = null
      }
    }
  }, [isTransitioning])

  async function loadChannelsFromAPI() {
    setChannelsLoading(true)
    try {
      const res = await getChannels()
      const raw = res.data || []
      // Load analytics overview for each channel (for growth badges in selector)
      const channelsWithMeta = raw.map((ch) => ({
        ...ch,
        _analytics: { viewsGrowth: 0 },
      }))

      // Fetch analytics for all channels in parallel to get growth data
      const anaResults = await Promise.allSettled(
        channelsWithMeta.map((ch) => getAnalytics(ch.channelId))
      )
      anaResults.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value?.data?.overview) {
          channelsWithMeta[i]._analytics = r.value.data.overview
        }
      })

      const mapped = channelsWithMeta.map((ch, i) => mapChannelToSelector(ch, i))
      setAllChannels(mapped.length ? mapped : FALLBACK_CHANNELS)
      setLastChannelsRefresh(Date.now())

      // Auto-select first real channel if none or invalid is selected
      const realChannels = mapped.filter((c) => c.id !== 'demo')
      if (realChannels.length) {
        // If current active is not in new channels, reset it to first channel
        const isCurrentActiveValid = realChannels.some((c) => c.id === activeChannelId)
        if (!activeChannelId || !isCurrentActiveValid) {
          setActiveChannelId(realChannels[0].id)
          fetchChannelData(realChannels[0].id)
        }
      } else {
        setActiveChannelId('demo')
        setChannelData(getEmptyData())
      }
    } catch {
      setAllChannels(FALLBACK_CHANNELS)
      setActiveChannelId('demo')
      setChannelData(getEmptyData())
    } finally {
      setChannelsLoading(false)
    }
  }

  const fetchChannelData = useCallback(async (channelId) => {
    if (!channelId || channelId === 'demo') {
      setChannelData(getEmptyData())
      return
    }
    try {
      const [analyticsRes, insightsRes] = await Promise.allSettled([
        getAnalytics(channelId),
        getInsights(channelId),
      ])
      const a = analyticsRes.status === 'fulfilled' ? analyticsRes.value : null
      const ins = insightsRes.status === 'fulfilled' ? insightsRes.value : []
      setChannelData(transformAnalytics(a, ins))
    } catch {
      setChannelData(getEmptyData())
    }
  }, [])

  const setActiveChannel = useCallback(
    (channelId) => {
      if (channelId === activeChannelId || isTransitioning) return
      if (timerRef.current) clearTimeout(timerRef.current)

      setIsTransitioning(true)
      setActiveChannelId(channelId)

      fetchChannelData(channelId).finally(() => {
        // Small delay for transition animation
        timerRef.current = setTimeout(() => {
          setIsTransitioning(false)
          timerRef.current = null
        }, TRANSITION_MS)
      })
    },
    [activeChannelId, isTransitioning, fetchChannelData],
  )

  const activeChannel = allChannels.find((c) => c.id === activeChannelId) || allChannels[0] || FALLBACK_CHANNELS[0]

  // Public method to refresh channel list after add/delete or on-mount stale check
  const refreshChannels = useCallback(async (force = false) => {
    const isStale = Date.now() - lastChannelsRefresh > 60000
    const isEmpty = allChannels.length === 0 || (allChannels.length === 1 && allChannels[0].id === 'demo')
    
    if (force || isEmpty || isStale) {
      await loadChannelsFromAPI()
      // Re-fetch data for currently active channel
      if (activeChannelId && activeChannelId !== 'demo') {
        await fetchChannelData(activeChannelId)
      }
    }
  }, [activeChannelId, fetchChannelData, lastChannelsRefresh, allChannels])

  // Context-level wrapper for adding a channel
  const addChannel = useCallback(async (input) => {
    setChannelsLoading(true)
    try {
      const result = await apiAddChannel(input)
      await loadChannelsFromAPI()
      const newId = result?.data?.channelId
      if (newId) {
        setActiveChannelId(newId)
        await fetchChannelData(newId)
      }
      return result
    } finally {
      setChannelsLoading(false)
    }
  }, [fetchChannelData])

  // Context-level wrapper for deleting a channel
  const removeChannel = useCallback(async (channelId) => {
    setChannelsLoading(true)
    try {
      const result = await apiDeleteChannel(channelId)
      await loadChannelsFromAPI()
      return result
    } finally {
      setChannelsLoading(false)
    }
  }, [])

  // Context-level wrapper for updating a channel
  const updateChannel = useCallback(async (channelId) => {
    setChannelsLoading(true)
    try {
      const result = await apiRefreshChannel(channelId)
      await loadChannelsFromAPI()
      if (activeChannelId === channelId) {
        await fetchChannelData(channelId)
      }
      return result
    } finally {
      setChannelsLoading(false)
    }
  }, [activeChannelId, fetchChannelData])

  return (
    <AnalyticsContext.Provider
      value={{
        activeChannel,
        activeChannelId,
        setActiveChannel,
        selectedChannel: activeChannel, // alias
        selectedChannelId: activeChannelId, // alias
        setSelectedChannel: setActiveChannel, // alias
        channelData,
        isTransitioning,
        allChannels,
        channelsLoading,
        refreshChannels,
        addChannel,
        removeChannel,
        updateChannel,
        lastChannelsRefresh,
      }}
    >
      {children}
    </AnalyticsContext.Provider>
  )
}

export function useAnalytics() {
  const ctx = useContext(AnalyticsContext)
  if (!ctx) throw new Error('useAnalytics must be used within AnalyticsProvider')
  return ctx
}

function getEmptyData() {
  return transformAnalytics({ data: { overview: {} } }, [])
}

