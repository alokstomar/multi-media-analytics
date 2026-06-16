import { motion } from 'framer-motion'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Clock, AlertTriangle, Lightbulb, BarChart3, ArrowRight } from 'lucide-react'
import { tooltipStyleCompact } from '../../data/chartConfigs'
import EstimatedBadge from '../ui/EstimatedBadge'

const iconPicker = { blue: Clock, orange: AlertTriangle, purple: Lightbulb, green: BarChart3 }

const insightStyles = {
  blue:   { bg: 'bg-blue-50/80',  border: 'border-blue-100', iconBg: 'bg-blue-100', iconText: 'text-blue-600', title: 'text-blue-800', dot: 'bg-blue-400' },
  orange: { bg: 'bg-amber-50/80', border: 'border-amber-100', iconBg: 'bg-amber-100', iconText: 'text-amber-600', title: 'text-amber-800', dot: 'bg-amber-400' },
  purple: { bg: 'bg-violet-50/80', border: 'border-violet-100', iconBg: 'bg-violet-100', iconText: 'text-violet-600', title: 'text-violet-800', dot: 'bg-violet-400' },
  green:  { bg: 'bg-emerald-50/80', border: 'border-emerald-100', iconBg: 'bg-emerald-100', iconText: 'text-emerald-600', title: 'text-emerald-800', dot: 'bg-emerald-400' },
}

export default function RetentionSection({ data, insights, estimated }) {
  const retentionData = data || []

  const defaultInsights = [
    { color: 'blue', title: 'Best hook timing', desc: 'Front-load value in first 5 seconds for max retention' },
    { color: 'orange', title: 'Drop-off at 0:28', desc: '28% of viewers leave before the 30-second mark' },
    { color: 'purple', title: 'Suggested intro: <5s', desc: 'Channels with short intros see +18% retention' },
    { color: 'green', title: 'Viewer behavior', desc: 'Mobile viewers drop 12% faster than desktop users' },
  ]
  const insightCards = insights || defaultInsights

  const avgRetention = retentionData.length
    ? Math.round(retentionData.reduce((s, d) => s + d.retention, 0) / retentionData.length)
    : 0

  // Find biggest drop-off
  let maxDrop = 0
  let dropIdx = 1
  retentionData.forEach((d, i) => {
    if (i > 0) {
      const drop = retentionData[i - 1].retention - d.retention
      if (drop > maxDrop) { maxDrop = drop; dropIdx = i }
    }
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className="grid grid-cols-1 xl:grid-cols-5 gap-5"
    >
      {/* ── Retention Chart ───────────────────────────────── */}
      <div className="xl:col-span-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[16px] font-bold text-gray-900 tracking-[-0.01em]">Audience Retention</h3>
              {estimated && <EstimatedBadge />}
            </div>
            <p className="text-[12px] text-gray-400 mt-0.5">Viewer retention curve across videos</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-violet-600 bg-violet-50 px-2.5 py-1 rounded-lg">
              Avg {avgRetention}%
            </span>
          </div>
        </div>

        <div className="mt-4">
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={retentionData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="retGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="second" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} domain={[0, 100]} tickCount={5} unit="%" />
              <Tooltip contentStyle={tooltipStyleCompact} formatter={(v) => [`${v}%`, 'Retention']} />
              {/* Milestone lines */}
              <ReferenceLine y={50} stroke="#F59E0B" strokeDasharray="4 4" strokeOpacity={0.5} />
              <ReferenceLine y={25} stroke="#EF4444" strokeDasharray="4 4" strokeOpacity={0.4} />
              <Area
                type="monotone"
                dataKey="retention"
                stroke="#8B5CF6"
                strokeWidth={2.5}
                fill="url(#retGrad)"
                dot={{ r: 2.5, fill: '#8B5CF6', stroke: '#fff', strokeWidth: 1.5 }}
                activeDot={{ r: 5, stroke: '#8B5CF6', strokeWidth: 2, fill: '#fff' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Legend + milestones */}
        <div className="mt-3 flex items-center gap-5 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="h-[6px] w-[6px] rounded-full bg-emerald-400" /> Strong hook
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-[6px] w-[6px] rounded-full bg-amber-400" /> 50% milestone
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-[6px] w-[6px] rounded-full bg-red-400" /> Critical drop-off
          </span>
          <span className="ml-auto text-[11px] text-gray-400">
            Biggest drop: <span className="font-semibold text-amber-600">{maxDrop}%</span> at {retentionData[dropIdx]?.second}
          </span>
        </div>
      </div>

      {/* ── AI Insight Cards ──────────────────────────────── */}
      <div className="xl:col-span-2 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-[16px] font-bold text-gray-900 tracking-[-0.01em]">AI Insights</h3>
            <p className="text-[12px] text-gray-400">Automated retention analysis</p>
          </div>
        </div>

        <div className="flex-1 space-y-2.5">
          {insightCards.map((card, i) => {
            const Icon = iconPicker[card.color] || BarChart3
            const style = insightStyles[card.color] || insightStyles.blue
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.25 + i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                className={`rounded-xl border p-3.5 ${style.bg} ${style.border} transition-all duration-200 hover:shadow-sm cursor-pointer group`}
              >
                <div className="flex items-start gap-3">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${style.iconBg} transition-transform duration-200 group-hover:scale-110`}>
                    <Icon className={`h-4 w-4 ${style.iconText}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`h-[5px] w-[5px] rounded-full ${style.dot}`} />
                      <p className={`text-[13px] font-semibold ${style.title}`}>{card.title}</p>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{card.desc}</p>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}
