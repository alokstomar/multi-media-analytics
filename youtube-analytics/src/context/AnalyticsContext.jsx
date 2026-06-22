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
import { debugLog } from '../utils/debugState'

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
  // Refs that hold mutable values used inside useCallback deps so the callback
  // identity stays stable across renders (prevents the prior circular loop).
  const lastRefreshRef = useRef(0)
  const allChannelsRef = useRef([])
  const isInitialLoadRef = useRef(true)
  const activeChannelIdRef = useRef(null)

  // Keep refs in sync with state every render — cheap, idempotent.
  allChannelsRef.current = allChannels
  activeChannelIdRef.current = activeChannelId

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
    debugLog('analytics:bootstrap', 'loadChannelsFromAPI start')
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

      // Only fall back to the "no channels" placeholder when truly empty AND no
      // existing channels to preserve. During a refresh that momentarily returns
      // empty, keep the previous list so the UI doesn't flicker to "No channels".
      const hasExisting = allChannelsRef.current.some((c) => c.id !== 'demo')
      if (mapped.length === 0 && (!hasExisting || isInitialLoadRef.current)) {
        debugLog('analytics:bootstrap', 'no channels — using FALLBACK_CHANNELS')
        setAllChannels(FALLBACK_CHANNELS)
      } else if (mapped.length === 0) {
        debugLog('analytics:bootstrap', 'refresh returned empty — preserving previous channels')
        // keep previous allChannels
      } else {
        setAllChannels(mapped)
      }
      lastRefreshRef.current = Date.now()
      setLastChannelsRefresh(lastRefreshRef.current)
      isInitialLoadRef.current = false

      // Auto-select first real channel if none or invalid is selected
      const realChannels = mapped.filter((c) => c.id !== 'demo')
      if (realChannels.length) {
        // If current active is not in new channels, reset it to first channel
        const isCurrentActiveValid = realChannels.some((c) => c.id === activeChannelIdRef.current)
        if (!activeChannelIdRef.current || !isCurrentActiveValid) {
          debugLog('analytics:bootstrap', 'auto-selecting first channel', realChannels[0].id)
          setActiveChannelId(realChannels[0].id)
          fetchChannelData(realChannels[0].id)
        }
      } else if (isInitialLoadRef.current === false && !hasExisting) {
        // first ever load with no channels at all — show demo placeholder
        setActiveChannelId('demo')
        setChannelData(getEmptyData())
      }
    } catch (err) {
      // DO NOT wipe real channel data on transient error. Previous channels stay
      // visible so the user doesn't see "No channels yet" during a network blip.
      debugLog('analytics:bootstrap', 'loadChannelsFromAPI error (preserving previous state)', err?.message)
      if (isInitialLoadRef.current && allChannelsRef.current.length === 0) {
        setAllChannels(FALLBACK_CHANNELS)
        setActiveChannelId('demo')
        setChannelData(getEmptyData())
      }
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

  // Public method to refresh channel list after add/delete or on-mount stale check.
  // IMPORTANT: deps are intentionally only [fetchChannelData]. All other inputs
  // (allChannels, lastChannelsRefresh, activeChannelId) are read from refs so this
  // callback keeps a stable identity — preventing the recursive re-render loop
  // where consumers' useEffect deps would otherwise fire on every channel update.
  const refreshChannels = useCallback(async (force = false) => {
    const last = lastRefreshRef.current
    const current = allChannelsRef.current
    const activeId = activeChannelIdRef.current
    const isStale = last === 0 || Date.now() - last > 60_000
    const isEmpty = current.length === 0 || (current.length === 1 && current[0].id === 'demo')

    if (force || isEmpty || isStale) {
      debugLog('analytics:refresh', 'triggered', { force, isEmpty, isStale })
      await loadChannelsFromAPI()
      // Re-fetch data for currently active channel
      if (activeId && activeId !== 'demo') {
        await fetchChannelData(activeId)
      }
    } else {
      debugLog('analytics:refresh', 'skipped (not stale, not empty, not forced)')
    }
  }, [fetchChannelData])

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

