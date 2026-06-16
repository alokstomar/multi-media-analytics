import { useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import { usePlatform } from '../hooks/usePlatform'
import { usePlatformAdapter } from '../platformAdapters'
import AddChannelSection from '../components/dashboard/AddChannelSection'
import KPISection from '../components/dashboard/KPISection'
import AnalyticsOverview from '../components/dashboard/analytics/AnalyticsOverview'
import AlertsSection from '../components/dashboard/AlertsSection'
import TwitterDashboard from './TwitterDashboard'
import LinkedInDashboard from './LinkedInDashboard'
import InstagramDashboard from './InstagramDashboard'

function formatValue(v) {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}

export default function Dashboard() {
  const { selectedPlatform } = usePlatform()
  const { selectedAccount, removeAccount, analyticsData, error: providerError } = usePlatformAdapter()
  
  if (selectedPlatform === 'twitter') {
    return <TwitterDashboard />
  }

  if (selectedPlatform === 'linkedin') {
    return <LinkedInDashboard />
  }

  const platformName = selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1)
  const isYoutube = selectedPlatform === 'youtube'

  // Clean fallback checks
  const isDemo = !selectedAccount || selectedAccount.id === 'demo' || selectedAccount.id === 'demo_ig' || selectedAccount.id === 'demo_tt' || selectedAccount.id === 'demo_li'
  const activeAccount = isDemo ? null : selectedAccount

  // Custom Instagram KPI cards
  const ov = analyticsData?._raw?.overview || {}
  const overrideCards = selectedPlatform === 'instagram' && analyticsData ? [
    {
      title: 'Followers',
      rawValue: ov.followers || 0,
      display: (v) => formatValue(v),
      growth: ov.followersGrowth || 0,
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      color: 'bg-purple-100 text-purple-600',
    },
    {
      title: 'Reach',
      rawValue: ov.reach || 0,
      display: (v) => formatValue(v),
      growth: ov.reachGrowth || 0,
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
      color: 'bg-blue-100 text-blue-600',
    },
    {
      title: 'Impressions',
      rawValue: ov.impressions || 0,
      display: (v) => formatValue(v),
      growth: parseFloat((ov.reachGrowth * 1.15).toFixed(1)) || 0,
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      color: 'bg-purple-100 text-purple-600',
    },
    {
      title: 'Engagement Rate',
      rawValue: Math.round((ov.engagementRate || 0) * 10),
      display: (v) => `${(v / 10).toFixed(1)}%`,
      growth: ov.engGrowth || 0,
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      ),
      color: 'bg-green-100 text-green-600',
    },
    {
      title: 'Reel Views',
      rawValue: ov.reelViews || 0,
      display: (v) => formatValue(v),
      growth: ov.reelGrowth || 0,
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
      color: 'bg-yellow-100 text-yellow-600',
    },
  ] : null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">
              {platformName} Dashboard
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {activeAccount
                ? `Overview of ${activeAccount.name}'s performance.`
                : `Overview of your ${platformName} performance.`}
            </p>
          </div>

          {activeAccount && (
            <button
              onClick={async () => {
                if (window.confirm(`Are you sure you want to disconnect ${activeAccount.name}?`)) {
                  try {
                    await removeAccount(activeAccount.id)
                  } catch (err) {
                    alert('Failed to disconnect account')
                  }
                }
              }}
              className="self-start sm:self-center flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-xl text-xs font-semibold hover:bg-red-50 cursor-pointer transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {isYoutube ? 'Remove Channel' : 'Disconnect Account'}
            </button>
          )}
        </div>

        <AddChannelSection />

        <div className="border-t border-gray-100" />

        {activeAccount ? (
          <>
            {selectedPlatform === 'instagram' && !analyticsData?._raw?.overview ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-2">
                <p className="text-lg font-medium text-gray-700">No Instagram analytics available</p>
                {providerError ? (
                  <p className="text-sm text-red-600 max-w-xl mx-auto">
                    {providerError}
                  </p>
                ) : (
                  <p className="text-sm text-gray-500 max-w-xl mx-auto">
                    This account has no Meta OAuth token. Disconnect it and reconnect via the Connect button — Instagram analytics require an OAuth-bound Business or Creator account.
                  </p>
                )}
              </div>
            ) : (
              <>
                <KPISection channelId={activeAccount.id} overrideCards={overrideCards} />
                <div className="border-t border-gray-100" />
                <AnalyticsOverview channelId={activeAccount.id} />
              </>
            )}
          </>
        ) : (
          <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-lg font-medium">
              {isYoutube ? 'No channel selected' : `No connected ${platformName} account`}
            </p>
            <p className="text-sm mt-1">
              {isYoutube 
                ? 'Add a YouTube channel above to get started' 
                : `Connect a ${platformName} account above to start analyzing metrics`}
            </p>
          </div>
        )}

        <div className="border-t border-gray-100" />

        <AlertsSection channelId={activeAccount?.id} />
      </div>
    </div>
  )
}
