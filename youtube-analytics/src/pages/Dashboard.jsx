import { Trash2 } from 'lucide-react'
import { usePlatform } from '../hooks/usePlatform'
import { usePlatformAdapter } from '../platformAdapters'
import AddChannelSection from '../components/dashboard/AddChannelSection'
import KPISection from '../components/dashboard/KPISection'
import AnalyticsOverview from '../components/dashboard/analytics/AnalyticsOverview'
import AlertsSection from '../components/dashboard/AlertsSection'
import TwitterDashboard from './TwitterDashboard'
import LinkedInDashboard from './LinkedInDashboard'
import InstagramDashboardOverview from '../components/instagram/InstagramDashboardOverview'

export default function Dashboard() {
  const { selectedPlatform } = usePlatform()
  const { selectedAccount, removeAccount } = usePlatformAdapter()

  if (selectedPlatform === 'twitter') {
    return <TwitterDashboard />
  }

  if (selectedPlatform === 'linkedin') {
    return <LinkedInDashboard />
  }

  // Instagram renders a dedicated, adapter-driven overview. The YouTube flow
  // below is untouched — IG no longer flows through the shared KPISection /
  // AnalyticsOverview path with override cards.
  if (selectedPlatform === 'instagram') {
    return <InstagramDashboardOverview />
  }

  const platformName = selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1)
  const isYoutube = selectedPlatform === 'youtube'

  // Clean fallback checks
  const isDemo = !selectedAccount || selectedAccount.id === 'demo' || selectedAccount.id === 'demo_ig' || selectedAccount.id === 'demo_tt' || selectedAccount.id === 'demo_li'
  const activeAccount = isDemo ? null : selectedAccount

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
            <KPISection channelId={activeAccount.id} />
            <div className="border-t border-gray-100" />
            <AnalyticsOverview channelId={activeAccount.id} />
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
