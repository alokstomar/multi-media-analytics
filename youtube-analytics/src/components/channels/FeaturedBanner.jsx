import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Play, RefreshCw, ArrowUpRight, Users, Eye, BarChart3 } from 'lucide-react'
import { useAnalytics } from '../../context/AnalyticsContext'
import { fmt } from './data'

export default function FeaturedBanner({ channel, onRefresh }) {
  const navigate = useNavigate()
  const { setActiveChannel } = useAnalytics()

  if (!channel) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-8 text-white"
    >
      <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
      <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-purple-400/10 rounded-full blur-2xl" />

      <div className="relative z-10 flex items-center gap-8">
        <div className="shrink-0">
          <div className="relative">
            <img
              src={channel.profileImage}
              alt={channel.title}
              className="h-24 w-24 rounded-2xl object-cover ring-4 ring-white/20"
            />
            <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 ring-2 ring-white">
              <Play className="h-3 w-3 text-white fill-white" />
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl font-bold">Featured Channel</h2>
            <span className="rounded-full bg-white/15 px-3 py-0.5 text-xs font-medium backdrop-blur-sm">
              Top Performer
            </span>
          </div>
          <p className="text-white/70 text-sm mb-4">
            {channel.title} · {channel.handle || channel.channelId}
          </p>

          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-white/60" />
              <span className="text-lg font-semibold">{fmt(channel.subscribers)}</span>
              <span className="text-xs text-white/50">subscribers</span>
            </div>
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-white/60" />
              <span className="text-lg font-semibold">{fmt(channel.totalViews)}</span>
              <span className="text-xs text-white/50">total views</span>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-white/60" />
              <span className="text-lg font-semibold">{channel.totalVideos}</span>
              <span className="text-xs text-white/50">videos</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 shrink-0">
          <button
            onClick={() => {
              setActiveChannel(channel.channelId || channel.id)
              navigate('/analytics')
            }}
            className="flex items-center gap-2 rounded-xl bg-white text-blue-700 px-5 py-2.5 text-sm font-semibold hover:bg-white/90 transition shadow-lg shadow-black/10 cursor-pointer"
          >
            Open Analytics
            <ArrowUpRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => onRefresh?.(channel.channelId)}
            className="flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-sm text-white px-5 py-2.5 text-sm font-medium hover:bg-white/20 transition cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Data
          </button>
        </div>
      </div>
    </motion.div>
  )
}

