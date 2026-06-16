import { createContext, useState, useContext, useCallback, useMemo } from 'react'
import { useAnalytics } from './AnalyticsContext'

const ChannelContext = createContext()

/**
 * Thin wrapper over AnalyticsContext so Dashboard and legacy consumers
 * stay in sync when channels are added, removed, or refreshed.
 */
export function ChannelProvider({ children }) {
  const analytics = useAnalytics()
  const {
    allChannels,
    activeChannelId,
    setActiveChannel,
    channelsLoading,
    refreshChannels,
    addChannel,
    removeChannel,
    updateChannel,
  } = analytics

  const channels = useMemo(
    () => allChannels.filter((c) => c.id !== 'demo').map((c) => c._raw || c),
    [allChannels],
  )

  const selectedChannel = useMemo(() => {
    const match = allChannels.find((c) => c.id === activeChannelId)
    return match?._raw || null
  }, [allChannels, activeChannelId])

  const setSelectedChannel = useCallback(
    (channel) => {
      if (!channel) return
      const id = typeof channel === 'string' ? channel : channel.channelId || channel.id
      if (id) setActiveChannel(id)
    },
    [setActiveChannel],
  )

  const loadChannels = useCallback(async () => {
    await refreshChannels(true)
  }, [refreshChannels])

  return (
    <ChannelContext.Provider
      value={{
        channels,
        selectedChannel,
        setSelectedChannel,
        loading: channelsLoading,
        loadChannels,
        removeChannel,
        addChannel,
        updateChannel,
        refreshChannels,
      }}
    >
      {children}
    </ChannelContext.Provider>
  )
}

export function useChannels() {
  const ctx = useContext(ChannelContext)
  if (!ctx) throw new Error('useChannels must be used within ChannelProvider')
  return ctx
}
