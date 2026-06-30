import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, DollarSign, Layers, Calendar, Download, Rocket } from 'lucide-react'
import { usePlatform } from '../hooks/usePlatform'
import { usePlatformAdapter } from '../platformAdapters'
import { exportToCSV } from '../utils/csvExport'
import { exportToJSON } from '../utils/csvExport'

// Reuse all existing portfolio components
import ChannelStrip from '../components/portfolio/ChannelStrip'
import PortfolioKPICards from '../components/portfolio/PortfolioKPICards'
import PortfolioChart from '../components/portfolio/PortfolioChart'
import PortfolioAIInsightsPanel from '../components/portfolio/AIInsightsPanel'
import ChannelLeaderboard from '../components/portfolio/ChannelLeaderboard'
import AudienceOverlap from '../components/portfolio/AudienceOverlap'
import ContentGapAnalysis from '../components/portfolio/ContentGapAnalysis'
import UploadTimeAnalysis from '../components/portfolio/UploadTimeAnalysis'
import InstagramPortfolioIntelligence from '../components/instagram/InstagramPortfolioIntelligence'

const RANGES = ['7D', '30D', '90D', '1Y']
const cs = '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)'

/* ── Future module placeholder cards ──────────────────────── */
const FUTURE_MODULES = [
  { name: 'Portfolio Forecasting', desc: 'Predict subscriber milestones, revenue projections, and growth trajectories', icon: TrendingUp, color: '#10B981', gradient: 'from-emerald-500/10 to-green-500/10', borderColor: 'border-emerald-100' },
  { name: 'Revenue Intelligence', desc: 'CPM optimization, sponsorship valuation, and monetization analysis', icon: DollarSign, color: '#F59E0B', gradient: 'from-amber-500/10 to-orange-500/10', borderColor: 'border-amber-100' },
]

export default function PortfolioIntelligence() {
  const [range, setRange] = useState('30D')
  const { selectedPlatform } = usePlatform()

  // Instagram renders a dedicated, IG-isolated portfolio component. The YouTube
  // flow below is untouched.
  if (selectedPlatform === 'instagram') {
    return <InstagramPortfolioIntelligence />
  }

  const { accounts: allChannels } = usePlatformAdapter()
  const [selectedChannelIds, setSelectedChannelIds] = useState([])

  // Auto-select all channels on mount (dedicated portfolio mode).
  // Deps are primitives only — `allChannels` is unstable (new array identity every
  // context tick), so we use `.length` to re-fire only when the count changes.
  const channelCount = allChannels?.length || 0
  useEffect(() => {
    if (allChannels && allChannels.length && !selectedChannelIds.length) {
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

  const selectedCount = selectedChannelIds.length
  const totalCount = allChannels.filter(c => c.id !== 'demo' && c.id !== 'demo_ig' && c.id !== 'demo_tt' && c.id !== 'demo_li').length

  return (
    <div className="min-h-screen space-y-6">
      {/* ── Channel Strip (always visible) ──────────────── */}
      <ChannelStrip selectedIds={selectedChannelIds} onToggle={handleToggleChannel} />

      {/* ── Page Header ─────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm">
                <Layers className="h-4 w-4 text-white" />
              </div>
              <h1 className="text-[22px] font-bold text-gray-900 tracking-[-0.02em]">Portfolio Intelligence</h1>
            </div>
            <span className="h-5 w-px bg-gray-200" />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-violet-600">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
              {selectedCount} / {totalCount} {selectedPlatform === 'youtube' ? 'Channels' : 'Accounts'} Active
            </span>
          </div>
          <p className="mt-1 text-[13px] text-gray-400">
            Multi-channel strategic analytics &amp; AI-powered portfolio intelligence
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
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200 cursor-pointer ${range === r
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                  }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Export */}
          <button onClick={() => {
            const channels = allChannels.filter(c => c.id !== 'demo' && c.id !== 'demo_ig' && c.id !== 'demo_tt' && c.id !== 'demo_li')
            exportToCSV('portfolio-kpis', [
              { key: 'name', label: 'Channel' },
              { key: 'subscribers', label: 'Subscribers' },
              { key: 'totalViews', label: 'Views' },
              { key: 'totalVideos', label: 'Videos' },
            ], channels.map(c => ({
              name: c.name,
              subscribers: c._raw?.subscribers || 0,
              totalViews: c._raw?.totalViews || 0,
              totalVideos: c._raw?.totalVideos || 0,
            })))
            exportToJSON('portfolio-report', {
              generatedAt: new Date().toISOString(),
              channels: channels.map(c => ({ id: c.id, name: c.name, subscribers: c._raw?.subscribers || 0, views: c._raw?.totalViews || 0 })),
              selectedIds: selectedChannelIds,
            })
          }} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-[12px] font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-700 shadow-sm transition-all duration-200 cursor-pointer">
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </motion.div>

      {/* ── Portfolio Analytics Content ──────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
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

        {/* ── Future Modules — Coming Soon ──────────────── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100">
              <Rocket className="h-3.5 w-3.5 text-gray-400" />
            </div>
            <div>
              <h3 className="text-[14px] font-bold text-gray-900 tracking-tight">Coming Soon</h3>
              <p className="text-[11px] text-gray-400">Advanced modules currently in development</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {FUTURE_MODULES.map((mod) => {
              const Icon = mod.icon
              return (
                <motion.div
                  key={mod.name}
                  whileHover={{ y: -2, scale: 1.01 }}
                  transition={{ duration: 0.2 }}
                  className={`relative rounded-[20px] border ${mod.borderColor} bg-gradient-to-br ${mod.gradient} p-5 overflow-hidden group cursor-default`}
                  style={{ boxShadow: cs }}
                >
                  {/* Locked overlay */}
                  <div className="absolute top-3 right-3">
                    <span className="text-[9px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full uppercase tracking-wider">Soon</span>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0" style={{ backgroundColor: `${mod.color}15` }}>
                      <Icon className="h-5 w-5" style={{ color: mod.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-gray-800 mb-1">{mod.name}</p>
                      <p className="text-[11px] text-gray-400 leading-relaxed">{mod.desc}</p>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
