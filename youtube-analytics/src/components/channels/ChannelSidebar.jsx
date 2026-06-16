import { motion } from 'framer-motion'
import { Sparkles, Clock, Zap, Crown } from 'lucide-react'
import { fmt } from './data'

export default function ChannelSidebar({ channels = [], insights = [] }) {
  const recent = [...channels].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 4)

  return (
    <motion.aside
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="space-y-5 sticky top-0"
    >
      {/* Recently Added */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-800">Recently Added</h3>
        </div>
        <div className="space-y-3">
          {recent.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">No channels added yet</p>
          )}
          {recent.map((ch) => (
            <div key={ch.channelId} className="flex items-center gap-3 rounded-xl p-2 hover:bg-gray-50 transition cursor-pointer">
              <img src={ch.profileImage} alt={ch.title} className="h-9 w-9 rounded-lg object-cover" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{ch.title}</p>
                <p className="text-[11px] text-gray-400">{fmt(ch.subscribers)} subs</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Recommendations */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-4 w-4 text-purple-500" />
          <h3 className="text-sm font-semibold text-gray-800">AI Recommendations</h3>
        </div>
        <div className="space-y-3">
          {insights.length === 0 && (
            <>
              <div className="flex items-start gap-3 rounded-xl bg-gray-50 p-3">
                <span className="text-sm shrink-0">🕐</span>
                <p className="text-xs text-gray-600 leading-relaxed">Post between 6-9 PM IST for higher engagement</p>
              </div>
              <div className="flex items-start gap-3 rounded-xl bg-gray-50 p-3">
                <span className="text-sm shrink-0">🔥</span>
                <p className="text-xs text-gray-600 leading-relaxed">Challenge videos perform 2.4x better</p>
              </div>
              <div className="flex items-start gap-3 rounded-xl bg-gray-50 p-3">
                <span className="text-sm shrink-0">🤝</span>
                <p className="text-xs text-gray-600 leading-relaxed">Consider collabs with similar creators</p>
              </div>
            </>
          )}
          {insights.slice(0, 3).map((ins, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl bg-gray-50 p-3">
              <span className="text-sm shrink-0">
                {ins.type === 'positive' ? '📈' : ins.type === 'warning' ? '⚠️' : '💡'}
              </span>
              <p className="text-xs text-gray-600 leading-relaxed">{ins.title}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Usage */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-gray-800">Usage</h3>
        </div>
        <p className="text-xs text-gray-500 mb-2">{channels.length} / 50 channels</p>
        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
            style={{ width: `${(channels.length / 50) * 100}%` }}
          />
        </div>
        <p className="text-[11px] text-gray-400 mt-2">{50 - channels.length} slots remaining</p>
      </div>

      {/* Upgrade card */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 p-5 text-white shadow-lg shadow-indigo-500/20">
        <div className="flex items-center gap-2 mb-2">
          <Crown className="h-5 w-5 text-amber-300" />
          <h3 className="text-sm font-bold">Upgrade to Pro</h3>
        </div>
        <p className="text-xs text-white/70 mb-4 leading-relaxed">
          Unlock unlimited channels, advanced analytics, and priority support.
        </p>
        <button className="w-full flex items-center justify-center gap-2 rounded-xl bg-white text-indigo-700 py-2.5 text-sm font-semibold hover:bg-white/90 transition">
          <Zap className="h-4 w-4" />
          Upgrade Now
        </button>
      </div>
    </motion.aside>
  )
}
