import { motion } from 'framer-motion'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import { RefreshCw, Trash2, ArrowUpRight, Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAnalytics } from '../../context/AnalyticsContext'
import { fmt, sparkline } from './data'

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function ChannelCard({ channel, index, analytics, onRefresh, onRemove }) {
  const { setActiveChannel } = useAnalytics()
  const navigate = useNavigate()
  const chartData = sparkline().map((v) => ({ v }))
  const growth = analytics?.viewsGrowth || 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
    >
      {/* Banner */}
      <div className="relative h-28 overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
        {channel.banner ? (
          <img
            src={channel.banner}
            alt=""
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <div className="h-12 w-12 rounded-2xl bg-white/60 flex items-center justify-center">
              <span className="text-2xl font-bold text-gray-300">{channel.title?.[0]}</span>
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        <span className={`absolute top-3 right-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold backdrop-blur-sm ${
          growth >= 0
            ? 'bg-green-500/20 text-green-300'
            : 'bg-red-500/20 text-red-300'
        }`}>
          {growth >= 0 ? '+' : ''}{growth.toFixed(1)}%
        </span>
      </div>

      {/* Avatar */}
      <div className="relative px-5 -mt-8 z-10">
        <img
          src={channel.profileImage}
          alt={channel.title}
          className="h-14 w-14 rounded-xl object-cover ring-4 ring-white shadow-md"
        />
      </div>

      {/* Body */}
      <div className="flex-1 px-5 pt-3 pb-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-base font-bold text-gray-900 leading-tight">{channel.title}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{channel.handle || channel.channelId}</p>
          </div>
          <span className="flex items-center gap-1 text-[11px] text-gray-400">
            <Clock className="h-3 w-3" />
            {timeAgo(channel.updatedAt)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <p className="text-[11px] text-gray-400">Subscribers</p>
            <p className="text-sm font-bold text-gray-900">{fmt(channel.subscribers)}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-400">Total Views</p>
            <p className="text-sm font-bold text-gray-900">{fmt(channel.totalViews)}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-400">Videos</p>
            <p className="text-sm font-bold text-gray-900">{(channel.totalVideos || 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-400">Engagement</p>
            <p className="text-sm font-bold text-gray-900">{analytics?.engagementRate?.toFixed(1) || '—'}%</p>
          </div>
        </div>

        {/* Mini chart */}
        <div className="h-12 mb-4 rounded-lg bg-gray-50 overflow-hidden">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
              <defs>
                <linearGradient id={`grad-${channel.channelId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={growth >= 0 ? '#3B82F6' : '#EF4444'} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={growth >= 0 ? '#3B82F6' : '#EF4444'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={growth >= 0 ? '#3B82F6' : '#EF4444'}
                strokeWidth={2}
                fill={`url(#grad-${channel.channelId})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setActiveChannel(channel.channelId)
              navigate('/analytics')
            }}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 text-white py-2 text-xs font-semibold hover:bg-blue-700 transition"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            View Analytics
          </button>
          <button
            onClick={() => onRefresh?.(channel.channelId)}
            className="flex items-center justify-center h-8 w-8 rounded-xl border border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onRemove?.(channel.channelId)}
            className="flex items-center justify-center h-8 w-8 rounded-xl border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}
