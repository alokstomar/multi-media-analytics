import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { ResponsiveContainer, AreaChart, Area } from 'recharts'
import { Sparkles, Users, Eye, Clock, Video, TrendingUp } from 'lucide-react'
import { usePlatform } from '../../hooks/usePlatform'
import { usePlatformAdapter } from '../../platformAdapters'

const cs = '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)'

export default function PortfolioKPICards({ selectedIds, range }) {
  const { selectedPlatform } = usePlatform()
  const { accounts: allChannels } = usePlatformAdapter()

  const totals = useMemo(() => {
    let subs = 0
    let views = 0
    let videos = 0
    let totalEng = 0
    let countWithEng = 0

    // Filter to selected channels
    const active = allChannels.filter(c => selectedIds.includes(c.id))
    if (!active.length) {
      return { subs: 0, views: 0, watchTime: 0, videos: 0, engagement: '0%' }
    }

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

    const avgEng = countWithEng > 0 ? (totalEng / countWithEng).toFixed(1) : '3.5'
    const watch = Math.round(views * 0.08) // Estimated watch hours based on views

    // Dynamic scaling based on range
    let scale = 1
    if (range === '7D') scale = 1 / 26
    else if (range === '30D') scale = 1 / 6
    else if (range === '90D') scale = 1 / 2
    else if (range === '1Y') scale = 2

    return {
      subs,
      views: Math.round(views * scale),
      watchTime: Math.round(watch * scale),
      videos: Math.round(videos * scale),
      engagement: `${avgEng}%`
    }
  }, [allChannels, selectedIds, range])

  function fmt(n) {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
    return String(n)
  }

  const kpis = [
    { label: selectedPlatform === 'youtube' ? 'Total Subscribers' : 'Total Followers', value: fmt(totals.subs), icon: Users, color: '#3B82F6', spark: [8, 12, 10, 16, 14, 20, 24] },
    { label: 'Total Views', value: fmt(totals.views), icon: Eye, color: '#EF4444', spark: [14, 20, 18, 25, 22, 28, 32] },
    { label: 'Avg Engagement', value: totals.engagement, icon: Sparkles, color: '#8B5CF6', spark: [3, 4, 3.5, 4.2, 3.8, 4.5, 4.7] },
    { label: selectedPlatform === 'youtube' ? 'Total Watch Time' : 'Total Impressions', value: selectedPlatform === 'youtube' ? `${fmt(totals.watchTime)} hrs` : fmt(totals.views * 3), icon: Clock, color: '#F59E0B', spark: [6, 8, 10, 12, 14, 16, 18] },
    { label: selectedPlatform === 'youtube' ? 'Videos Published' : 'Posts Published', value: fmt(totals.videos), icon: Video, color: '#10B981', spark: [2, 4, 3, 5, 6, 5, 7] }
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {kpis.map((kpi, i) => {
        const Icon = kpi.icon
        const sparkData = kpi.spark.map((v) => ({ v }))
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
              <p className="text-[22px] font-bold text-gray-900 tracking-tight leading-none mb-1">
                {kpi.value}
              </p>
            </div>

            <div className="h-[28px] -mx-1 my-1 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparkData} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`portfolio-spark-${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={kpi.color} stopOpacity={0.2} />
                      <stop offset="100%" stopColor={kpi.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke={kpi.color}
                    strokeWidth={2}
                    fill={`url(#portfolio-spark-${i})`}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center gap-1 mt-1 text-[10px]">
              <span className="inline-flex items-center gap-0.5 text-emerald-600 font-bold">
                <TrendingUp className="h-3 w-3" />
                +8.2%
              </span>
              <span className="text-gray-300">vs last 30d</span>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
