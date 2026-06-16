import { useAnalytics } from '../context/AnalyticsContext'

export function useYoutubeAdapter() {
  const analytics = useAnalytics()
  
  // Transform allChannels to unified selector items
  const accounts = analytics.allChannels || []

  return {
    platform: 'youtube',
    accounts,
    selectedAccount: analytics.selectedChannel,
    loading: analytics.channelsLoading,
    activeAccount: analytics.activeChannel,
    activeAccountId: analytics.activeChannelId,
    setActiveAccount: analytics.setActiveChannel,
    
    // CRUD
    addAccount: (input) => {
      // Map unified input to YouTube api expectations
      const payload = typeof input === 'string' ? input : (input.username || input.title)
      return analytics.addChannel(payload)
    },
    removeAccount: analytics.removeChannel,
    updateAccount: analytics.updateChannel,
    
    // Data
    analyticsData: analytics.channelData,
    refreshAccounts: () => analytics.refreshChannels(true),
  }
}
