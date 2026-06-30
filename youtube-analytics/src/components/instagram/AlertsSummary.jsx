import { motion } from 'framer-motion'
import { Bell, AlertTriangle, Inbox, Flame } from 'lucide-react'

/* Four-card KPI strip: Total / Critical / Unread / Viral. Each tile carries
   an accent color and icon. Counts come straight from the backend counts
   payload to avoid drift between the strip and the timeline. */
function Tile({ label, value, icon: Icon, accent, sub, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.3) }}
      className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
    >
      <div className="flex items-start justify-between">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${accent.bg} ${accent.fg}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-[11px] text-gray-400">{sub}</p>}
    </motion.div>
  )
}

export default function AlertsSummary({ counts }) {
  const c = counts || { total: 0, critical: 0, unread: 0, viral: 0 }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <Tile
        label="Total Alerts"
        value={c.total}
        icon={Bell}
        accent={{ bg: 'bg-blue-50', fg: 'text-blue-600' }}
        sub="All time"
        index={0}
      />
      <Tile
        label="Critical"
        value={c.critical}
        icon={AlertTriangle}
        accent={{ bg: 'bg-red-50', fg: 'text-red-600' }}
        sub={c.critical ? 'Needs attention' : 'All clear'}
        index={1}
      />
      <Tile
        label="Unread"
        value={c.unread}
        icon={Inbox}
        accent={{ bg: 'bg-amber-50', fg: 'text-amber-600' }}
        sub={c.unread ? 'Pending review' : 'Caught up'}
        index={2}
      />
      <Tile
        label="Viral Events"
        value={c.viral}
        icon={Flame}
        accent={{ bg: 'bg-orange-50', fg: 'text-orange-600' }}
        sub="2× avg reach"
        index={3}
      />
    </div>
  )
}
