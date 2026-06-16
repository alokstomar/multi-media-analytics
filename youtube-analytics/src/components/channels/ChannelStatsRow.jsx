import { motion } from 'framer-motion'
import { Users, Eye, BarChart3, TrendingUp } from 'lucide-react'
import { fmt } from './data'

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}

export default function ChannelStatsRow({ channels = [] }) {
  const totalSubs = channels.reduce((s, c) => s + (c.subscribers || 0), 0)
  const totalViews = channels.reduce((s, c) => s + (c.totalViews || 0), 0)
  const avgEng = channels.length
    ? (channels.reduce((s, c) => s + (c.engagement || 0), 0) / channels.length).toFixed(1)
    : 0

  const cards = [
    { label: 'Total Channels', value: channels.length, icon: Users, color: 'from-blue-500 to-blue-600', iconBg: 'bg-blue-100 text-blue-600', trend: `${channels.length} connected` },
    { label: 'Total Subscribers', value: fmt(totalSubs), icon: Users, color: 'from-purple-500 to-purple-600', iconBg: 'bg-purple-100 text-purple-600', trend: 'Across all channels' },
    { label: 'Total Views', value: fmt(totalViews), icon: Eye, color: 'from-emerald-500 to-emerald-600', iconBg: 'bg-emerald-100 text-emerald-600', trend: 'Lifetime views' },
    { label: 'Avg Engagement', value: `${avgEng}%`, icon: TrendingUp, color: 'from-amber-500 to-amber-600', iconBg: 'bg-amber-100 text-amber-600', trend: 'Combined average' },
  ]

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
    >
      {cards.map((c) => {
        const Icon = c.icon
        return (
          <motion.div
            key={c.label}
            variants={item}
            className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white/80 backdrop-blur-sm p-5 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
          >
            <div className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${c.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">{c.label}</p>
                <p className="text-2xl font-bold text-gray-900">{c.value}</p>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  <span className="text-xs font-medium text-green-600">{c.trend}</span>
                </div>
              </div>
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${c.iconBg} group-hover:scale-110 transition-transform duration-300`}>
                <Icon className="h-6 w-6" />
              </div>
            </div>
          </motion.div>
        )
      })}
    </motion.div>
  )
}
