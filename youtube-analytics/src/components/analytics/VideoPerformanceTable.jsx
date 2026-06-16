import { motion } from 'framer-motion'
import { ArrowUpDown, TrendingUp, Flame, Rocket, Minus, Play } from 'lucide-react'
import { usePlatform } from '../../hooks/usePlatform'

const badgeMap = {
  Viral: { bg: 'bg-red-50 text-red-600', icon: Flame, dot: 'bg-red-400' },
  Hot: { bg: 'bg-orange-50 text-orange-600', icon: Rocket, dot: 'bg-orange-400' },
  Rising: { bg: 'bg-blue-50 text-blue-600', icon: TrendingUp, dot: 'bg-blue-400' },
  Stable: { bg: 'bg-gray-100 text-gray-500', icon: Minus, dot: 'bg-gray-400' },
}

const viralColor = (s) => {
  if (s >= 90) return { bg: '#EF4444', text: '#EF4444' }
  if (s >= 80) return { bg: '#F59E0B', text: '#F59E0B' }
  if (s >= 70) return { bg: '#3B82F6', text: '#3B82F6' }
  return { bg: '#9CA3AF', text: '#9CA3AF' }
}

export default function VideoPerformanceTable({ data, contentLabel }) {
  const { selectedPlatform } = usePlatform()
  const isYoutube = selectedPlatform === 'youtube'
  const videos = data || []
  const label = contentLabel || 'Video'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 4px 12px -2px rgba(0,0,0,0.04)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div>
          <h3 className="text-[16px] font-bold text-gray-900 tracking-[-0.01em]">{label} Performance</h3>
          <p className="text-[12px] text-gray-400">Ranked by viral score</p>
        </div>
        <button className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] font-semibold text-gray-500 hover:bg-gray-50 transition-colors">
          <ArrowUpDown className="h-3 w-3" />
          Sort
        </button>
      </div>

      {/* Sticky table header */}
      <div className="sticky top-0 z-10 grid grid-cols-12 gap-3 px-5 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-gray-50/80 backdrop-blur-sm">
        <div className="col-span-1">#</div>
        <div className="col-span-4">{label}</div>
        <div className="col-span-1 text-right">{isYoutube ? 'Views' : 'Reach'}</div>
        <div className="col-span-2 text-right">{isYoutube ? 'Watch Time' : 'Likes'}</div>
        <div className="col-span-1 text-right">Eng</div>
        <div className="col-span-1 text-right">{isYoutube ? 'CTR' : 'Saves'}</div>
        <div className="col-span-2 text-right">Viral Score</div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-gray-50">
        {videos.map((v, i) => {
          const badge = badgeMap[v.badge] || badgeMap.Stable
          const BadgeIcon = badge.icon
          const vc = viralColor(v.viral)

          return (
            <motion.div
              key={v.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.4 + i * 0.04, ease: [0.22, 1, 0.36, 1] }}
              className="group grid grid-cols-12 gap-3 items-center px-5 py-3 hover:bg-blue-50/30 transition-colors duration-150 cursor-pointer"
            >
              {/* Rank */}
              <div className="col-span-1">
                <span className={`text-[13px] font-bold ${i < 3 ? 'text-gray-700' : 'text-gray-300'}`}>
                  {i + 1}
                </span>
              </div>

              {/* Video info */}
              <div className="col-span-4 flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <img
                    src={v.thumb}
                    alt=""
                    className="h-10 w-10 rounded-lg object-cover ring-1 ring-gray-100 group-hover:ring-gray-200 transition-all"
                  />
                  <div className="absolute inset-0 rounded-lg bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-all">
                    <Play className="h-3.5 w-3.5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-gray-800 truncate leading-tight group-hover:text-gray-900">
                    {v.title}
                  </p>
                  <span className={`inline-flex items-center gap-1 mt-0.5 rounded-full px-1.5 py-[2px] text-[10px] font-bold ${badge.bg}`}>
                    <BadgeIcon className="h-2.5 w-2.5" />
                    {v.badge}
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div className="col-span-1 text-right text-[13px] font-semibold text-gray-800">{v.views}</div>
              <div className="col-span-2 text-right text-[13px] text-gray-500">{v.watch}</div>
              <div className="col-span-1 text-right text-[13px] font-medium text-gray-700">{v.eng}</div>
              <div className="col-span-1 text-right text-[13px] text-gray-500">{v.ctr}</div>

              {/* Viral score */}
              <div className="col-span-2 flex items-center justify-end gap-2">
                <div className="w-[52px] bg-gray-100 h-[5px] rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${v.viral}%` }}
                    transition={{ duration: 0.8, delay: 0.5 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: vc.bg }}
                  />
                </div>
                <span className="text-[13px] font-bold w-7 text-right" style={{ color: vc.text }}>
                  {v.viral}
                </span>
              </div>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}
