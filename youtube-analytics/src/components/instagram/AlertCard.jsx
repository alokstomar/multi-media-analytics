import { motion } from 'framer-motion'
import {
  TrendingUp,
  TrendingDown,
  Heart,
  Flame,
  AlertTriangle,
  Clock,
  Trophy,
  CheckCircle2,
} from 'lucide-react'

/* Map alert type → icon + accent color. Each alert gets a tinted icon chip and
   matching severity pill. Viral / milestone get celebratory colors, drops and
   toxic-sentiment get alarm colors. */
const TYPE_THEME = {
  FOLLOWER_SPIKE: { Icon: TrendingUp, bg: 'bg-emerald-100', fg: 'text-emerald-600' },
  FOLLOWER_DROP: { Icon: TrendingDown, bg: 'bg-red-100', fg: 'text-red-600' },
  ENGAGEMENT_SPIKE: { Icon: Heart, bg: 'bg-pink-100', fg: 'text-pink-600' },
  ENGAGEMENT_DROP: { Icon: TrendingDown, bg: 'bg-amber-100', fg: 'text-amber-600' },
  VIRAL_REEL: { Icon: Flame, bg: 'bg-orange-100', fg: 'text-orange-600' },
  NEGATIVE_SENTIMENT_SURGE: { Icon: AlertTriangle, bg: 'bg-red-100', fg: 'text-red-600' },
  POSTING_INACTIVITY: { Icon: Clock, bg: 'bg-gray-100', fg: 'text-gray-600' },
  MILESTONE_REACHED: { Icon: Trophy, bg: 'bg-violet-100', fg: 'text-violet-600' },
}

const SEVERITY_STYLE = {
  critical: 'bg-red-50 text-red-700 border-red-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
}

function relativeTime(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function AlertCard({ alert, account, onMarkRead, index = 0 }) {
  const theme = TYPE_THEME[alert.type] || TYPE_THEME.POSTING_INACTIVITY
  const { Icon } = theme
  const sevClass = SEVERITY_STYLE[alert.severity] || SEVERITY_STYLE.info

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.4) }}
      className={`grid grid-cols-12 gap-3 items-center px-5 py-4 hover:bg-purple-50/20 transition-colors ${
        !alert.isRead ? 'bg-purple-50/10' : ''
      }`}
    >
      {/* Icon + read dot */}
      <div className="col-span-1 relative flex justify-center">
        {!alert.isRead && (
          <div className="absolute left-0 top-3 h-2 w-2 rounded-full bg-purple-500 ring-2 ring-purple-100" />
        )}
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${theme.bg} ${theme.fg}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>

      {/* Title + message */}
      <div className="col-span-6 min-w-0">
        <p className={`text-[13px] font-bold leading-tight truncate ${alert.isRead ? 'text-gray-700' : 'text-gray-900'}`}>
          {alert.title}
        </p>
        <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1 leading-relaxed">{alert.message}</p>
      </div>

      {/* Account avatar + name */}
      <div className="col-span-2 flex items-center gap-2 min-w-0">
        {account?.avatar ? (
          <img src={account.avatar} alt="" className="h-7 w-7 rounded-lg object-cover shrink-0 ring-1 ring-gray-100" />
        ) : (
          <div className="h-7 w-7 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center shrink-0 text-[11px] font-bold">
            {(account?.name || 'IG').charAt(0)}
          </div>
        )}
        <p className="text-[11px] text-gray-600 truncate">{account?.name || alert.accountId}</p>
      </div>

      {/* Severity */}
      <div className="col-span-1">
        <span className={`inline-flex items-center rounded-full px-2 py-[3px] text-[10px] font-bold capitalize border ${sevClass}`}>
          {alert.severity}
        </span>
      </div>

      {/* Time */}
      <div className="col-span-1 text-[11px] text-gray-400 text-right">
        {relativeTime(alert.createdAt)}
      </div>

      {/* Action */}
      <div className="col-span-1 flex justify-end">
        {!alert.isRead ? (
          <button
            onClick={() => onMarkRead(alert._id)}
            className="rounded-lg px-3 py-1.5 text-[11px] font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 transition-colors cursor-pointer"
            title="Mark as Read"
          >
            Read
          </button>
        ) : (
          <CheckCircle2 className="h-4 w-4 text-gray-300" />
        )}
      </div>
    </motion.div>
  )
}
