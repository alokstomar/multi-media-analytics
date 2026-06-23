import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, Download } from 'lucide-react'
import { usePlatform } from '../hooks/usePlatform'
import { usePlatformAdapter } from '../platformAdapters'
import { exportToCSV } from '../utils/csvExport'
import ChannelSelector from '../components/analytics/ChannelSelector'
import AnalyticsSkeleton from '../components/analytics/AnalyticsSkeleton'
import AnalyticsStats from '../components/analytics/AnalyticsStats'
import PerformanceChart from '../components/analytics/PerformanceChart'
import RetentionSection from '../components/analytics/RetentionSection'
import TrafficAnalytics from '../components/analytics/TrafficAnalytics'
import EngagementAnalytics from '../components/analytics/EngagementAnalytics'
import VideoPerformanceTable from '../components/analytics/VideoPerformanceTable'
import AIInsightsPanel from '../components/analytics/AIInsightsPanel'

// Portfolio components
import ChannelStrip from '../components/portfolio/ChannelStrip'
import PortfolioKPICards from '../components/portfolio/PortfolioKPICards'
import PortfolioChart from '../components/portfolio/PortfolioChart'
import PortfolioAIInsightsPanel from '../components/portfolio/AIInsightsPanel'
import ChannelLeaderboard from '../components/portfolio/ChannelLeaderboard'
import AudienceOverlap from '../components/portfolio/AudienceOverlap'
import ContentGapAnalysis from '../components/portfolio/ContentGapAnalysis'
import UploadTimeAnalysis from '../components/portfolio/UploadTimeAnalysis'

const RANGES = ['7D', '30D', '90D', '1Y']

export default function Analytics() {
  const [range, setRange] = useState('30D')
  const { selectedPlatform } = usePlatform()
  const { 
    analyticsData, 
    loading: isTransitioning, 
    activeAccount: activeChannel, 
    accounts: allChannels
  } = usePlatformAdapter()

  const [isPortfolioMode, setIsPortfolioMode] = useState(() => {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
    return params.get('mode') === 'portfolio'
  })
  const [selectedChannelIds, setSelectedChannelIds] = useState([])

  const isDemo = !activeChannel || activeChannel.id === 'demo' || activeChannel.id === 'demo_ig' || activeChannel.id === 'demo_tt' || activeChannel.id === 'demo_li'

  // Auto-initialize with all connected channels.
  // Deps are primitives only — `allChannels` is unstable (new array identity every
  // context tick), so we use `.length` to re-fire only when the count changes.
  const channelCount = allChannels?.length || 0
  useEffect(() => {
    if (allChannels && allChannels.length && !selectedChannelIds.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedChannelIds(allChannels.map(c => c.id).filter(id => id !== 'demo' && id !== 'demo_ig' && id !== 'demo_tt' && id !== 'demo_li'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelCount, selectedChannelIds.length])

  const handleToggleChannel = (id) => {
    setSelectedChannelIds(prev => 
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id]
    )
  }

  return (
    <div className="min-h-screen space-y-6">
      {/* ── Channel Selector / Portfolio Strip ──────────────── */}
      {isPortfolioMode ? (
        <ChannelStrip selectedIds={selectedChannelIds} onToggle={handleToggleChannel} />
      ) : (
        <ChannelSelector />
      )}

      {/* ── Page Header ─────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-[22px] font-bold text-gray-900 tracking-[-0.02em]">
              {selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1)} Analytics
            </h1>
            <span className="h-5 w-px bg-gray-200" />
            
            {/* Sliding Toggle control */}
            <div className="flex rounded-xl bg-gray-100 p-0.5 border border-gray-200/50">
              <button
                onClick={() => setIsPortfolioMode(false)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  !isPortfolioMode
                    ? 'bg-white text-gray-900 shadow-sm border border-gray-100/50'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {selectedPlatform === 'youtube' ? 'Single Channel' : 'Single Account'}
              </button>
              <button
                onClick={() => setIsPortfolioMode(true)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  isPortfolioMode
                    ? 'bg-white text-gray-900 shadow-sm border border-gray-100/50'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                Portfolio Mode
              </button>
            </div>

            {!isPortfolioMode && activeChannel && (
              <>
                <span className="h-5 w-px bg-gray-200" />
                <span className="text-[14px] font-medium text-gray-400">{activeChannel.name}</span>
              </>
            )}
          </div>
          <p className="mt-1 text-[13px] text-gray-400">
            {isPortfolioMode 
              ? 'Multi-channel compiled analytics & strategic portfolio performance' 
              : 'Performance metrics & audience intelligence'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Time range */}
          <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
            <Calendar className="h-3.5 w-3.5 text-gray-300 ml-1.5" />
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200 ${
                  range === r
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Export */}
          <button onClick={() => exportToCSV(`analytics-${activeChannel?.name || 'export'}`, [
            { key: 'date', label: 'Date' },
            { key: 'views', label: 'Views/Reach' },
            { key: 'watchTime', label: 'WatchTime/Impressions' },
          ], analyticsData?.performanceData || [])} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-[12px] font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-700 shadow-sm transition-all duration-200 cursor-pointer">
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </motion.div>

      {/* ── Content ────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {isTransitioning ? (
          <motion.div
            key="skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <AnalyticsSkeleton />
          </motion.div>
        ) : isPortfolioMode ? (
          <motion.div
            key="portfolio"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            className="space-y-6"
          >
            {/* Portfolio Metric Cards */}
            <PortfolioKPICards selectedIds={selectedChannelIds} range={range} />

            {/* Portfolio Multi-Channel Line Chart */}
            <PortfolioChart selectedIds={selectedChannelIds} range={range} />

            {/* Dynamic Grid: Leaderboard (70%) and AI Insights (30%) */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2">
                <ChannelLeaderboard selectedIds={selectedChannelIds} />
              </div>
              <div className="xl:col-span-1">
                <PortfolioAIInsightsPanel selectedIds={selectedChannelIds} />
              </div>
            </div>

            {/* Audience & Demographic Overlap Section */}
            <div className="w-full">
              <AudienceOverlap selectedIds={selectedChannelIds} />
            </div>

            {/* Strategic Intelligence Grid: Content Gaps (65%) & Upload Spacing (35%) */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2">
                <ContentGapAnalysis selectedIds={selectedChannelIds} />
              </div>
              <div className="xl:col-span-1">
                <UploadTimeAnalysis selectedIds={selectedChannelIds} />
              </div>
            </div>
          </motion.div>
        ) : isDemo ? (
          <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-lg font-medium">No connected account</p>
            <p className="text-sm mt-1">Connect an account above to start tracking analytics</p>
          </div>
        ) : selectedPlatform === 'instagram' && !analyticsData?._raw?.overview ? (
          <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-lg font-medium">No analytics available</p>
            <p className="text-sm mt-1">Real Instagram provider data is not available. Please verify your API configuration.</p>
          </div>
        ) : (
          <motion.div
            key={activeChannel.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            className="space-y-6"
          >
            {/* ── Top Stats ───────────────────────────────────── */}
            <AnalyticsStats data={analyticsData?.analyticsStats} range={range} />

            {/* ── Performance Chart ────────────────────────────── */}
            <PerformanceChart
              data={analyticsData?.performanceData}
              channelColor={activeChannel.color}
              range={range}
              hasEstimates={analyticsData?.performanceHasEstimates}
            />

            {selectedPlatform === 'youtube' && (
              <RetentionSection
                data={analyticsData?.retentionData}
                insights={analyticsData?.retentionInsights}
                estimated={analyticsData?.retentionEstimated}
              />
            )}

            <TrafficAnalytics
              trafficSources={analyticsData?.trafficSources}
              devices={analyticsData?.devices}
              geoData={analyticsData?.geoData}
              trafficEstimated={analyticsData?.trafficEstimated}
              devicesEstimated={analyticsData?.devicesEstimated}
              geoEstimated={analyticsData?.geoEstimated}
            />

            {/* ── Engagement Analytics ─────────────────────────── */}
            <EngagementAnalytics
              data={analyticsData?.engagementData}
              range={range}
              estimated={analyticsData?.engagementEstimated}
            />

            {/* ── Video Table + AI Panel ───────────────────────── */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2">
                <VideoPerformanceTable
                  data={analyticsData?.videoTable}
                  contentLabel={activeChannel.contentLabel}
                />
              </div>
              <div>
                <AIInsightsPanel insights={analyticsData?.aiInsights} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
