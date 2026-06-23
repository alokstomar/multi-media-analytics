import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Users, Eye, Video } from 'lucide-react'
import { usePlatform } from '../../hooks/usePlatform'
import { usePlatformAdapter } from '../../platformAdapters'

const cs = '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)'

export default function PortfolioKPICards({ selectedIds }) {
  const { selectedPlatform } = usePlatform()
  const { accounts: allChannels } = usePlatformAdapter()

  const totals = useMemo(() => {
    const active = (allChannels || []).filter(c => selectedIds.includes(c.id))
    if (!active.length) {
      return { subs: 0, views: 0, videos: 0, engagement: null, hasEngagement: false }
    }

    let subs = 0
    let views = 0
    let videos = 0
    let totalEng = 0
    let countWithEng = 0

    active.forEach(channel => {
      const raw = channel._raw || {}
      const analytics = channel._analytics || {}

      subs += Number(raw.subscribers || 0)
      views += Number(raw.totalViews || 0)
      videos += Number(raw.totalVideos || 0)

      const eng = Number(analytics.engagementRate || raw.engagementRate || 0)
      if (eng > 0) {
        totalEng += eng
        countWithEng++
      }
    })

    return {
      subs,
      views,
      videos,
      engagement: countWithEng > 0 ? `${(totalEng / countWithEng).toFixed(1)}%` : null,
      hasEngagement: countWithEng > 0
    }
  }, [allChannels, selectedIds])

  function fmt(n) {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
    return String(n)
  }

  const kpis = [
    { label: selectedPlatform === 'youtube' ? 'Total Subscribers' : 'Total Followers', value: fmt(totals.subs), icon: Users, color: '#3B82F6' },
    { label: 'Total Views', value: fmt(totals.views), icon: Eye, color: '#EF4444' },
    { label: 'Avg Engagement', value: totals.engagement || '—', icon: Sparkles, color: '#8B5CF6' },
    { label: selectedPlatform === 'youtube' ? 'Videos Published' : 'Posts Published', value: fmt(totals.videos), icon: Video, color: '#10B981' }
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {kpis.map((kpi, i) => {
        const Icon = kpi.icon
        return (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.05 }}
            className="rounded-[20px] border border-gray-100 bg-white p-5 hover:shadow-md transition-all duration-300 flex flex-col justify-between"
            style={{ boxShadow: cs }}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${kpi.color}10` }}
                >
                  <Icon className="h-4 w-4" style={{ color: kpi.color }} />
                </div>
              </div>
              <p className="text-[12px] font-medium text-gray-400 tracking-wide mb-0.5">
                {kpi.label}
              </p>
              <p className="text-[22px] font-bold text-gray-900 tracking-tight leading-none">
                {kpi.value}
              </p>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
