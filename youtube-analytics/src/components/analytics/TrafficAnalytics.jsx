import { motion } from 'framer-motion'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { Globe, Monitor, MapPin } from 'lucide-react'
import { fmt } from '../../utils/format'
import { useAnalytics } from '../../context/AnalyticsContext'
import EstimatedBadge from '../ui/EstimatedBadge'

const cardShadow = '0 1px 3px rgba(0,0,0,0.02), 0 4px 12px -2px rgba(0,0,0,0.04)'

function UnavailablePanel({ icon: Icon, tint, message }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${tint} mb-2`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-[12px] font-bold text-gray-500">{message}</p>
      <p className="text-[10px] text-gray-400 mt-1 max-w-[200px]">Connect YouTube Analytics API to enable this breakdown.</p>
    </div>
  )
}

export default function TrafficAnalytics({ trafficSources, devices, geoData, trafficEstimated, devicesEstimated, geoEstimated }) {
  const { activeChannel } = useAnalytics()
  const srcData = trafficSources || []
  const devData = devices || []
  const geo = geoData || []

  const totalViews = activeChannel?._raw?.totalViews || 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="grid grid-cols-1 lg:grid-cols-3 gap-5"
    >
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm" style={{ boxShadow: cardShadow }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
            <Globe className="h-3.5 w-3.5 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-[14px] font-bold text-gray-900">Traffic Sources</h3>
              {trafficEstimated !== false && srcData.length > 0 && <EstimatedBadge />}
            </div>
            <p className="text-[11px] text-gray-400">Where viewers find you</p>
          </div>
        </div>

        {srcData.length > 0 ? (
          <div className="flex items-center gap-4">
            <div className="relative w-[120px] h-[120px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={srcData} dataKey="value" innerRadius={38} outerRadius={56} paddingAngle={3} strokeWidth={0}>
                    {srcData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[15px] font-bold text-gray-900">{fmt(totalViews)}</span>
                <span className="text-[9px] text-gray-400 font-medium">Views</span>
              </div>
            </div>
            <div className="flex-1 space-y-2.5">
              {srcData.map((s) => (
                <div key={s.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-[7px] w-[7px] rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-[12px] text-gray-600">{s.name}</span>
                  </div>
                  <span className="text-[12px] font-bold text-gray-800">{s.value}%</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <UnavailablePanel icon={Globe} tint="bg-blue-50 text-blue-600" message="YouTube traffic source data unavailable" />
        )}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm" style={{ boxShadow: cardShadow }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50">
            <Monitor className="h-3.5 w-3.5 text-violet-600" />
          </div>
          <div>
            <h3 className="text-[14px] font-bold text-gray-900">Device Breakdown</h3>
            {devicesEstimated !== false && devData.length > 0 && <EstimatedBadge />}
            <p className="text-[11px] text-gray-400">Viewer device distribution</p>
          </div>
        </div>

        {devData.length > 0 ? (
          <div className="space-y-3.5">
            {devData.map((d) => (
              <div key={d.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] text-medium text-gray-600">{d.name}</span>
                  <span className="text-[12px] font-bold text-gray-800">{d.value}%</span>
                </div>
                <div className="w-full bg-gray-100 h-[6px] rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${d.value}%` }}
                    transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: d.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <UnavailablePanel icon={Monitor} tint="bg-violet-50 text-violet-600" message="YouTube device breakdown unavailable" />
        )}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm" style={{ boxShadow: cardShadow }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50">
            <MapPin className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-[14px] font-bold text-gray-900">Audience Geography</h3>
            {geoEstimated !== false && geo.length > 0 && <EstimatedBadge />}
            <p className="text-[11px] text-gray-400">Top viewing countries</p>
          </div>
        </div>

        {geo.length > 0 ? (
          <div className="space-y-2.5">
            {geo.map((g) => (
              <div key={g.country} className="flex items-center gap-2.5">
                <span className="text-[14px] leading-none">{g.flag}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-medium text-gray-700">{g.country}</span>
                    <span className="text-[11px] font-bold text-gray-800">{g.pct}%</span>
                  </div>
                  <div className="w-full bg-gray-100 h-[4px] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${g.pct}%` }}
                      transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="h-full rounded-full bg-blue-500"
                    />
                  </div>
                </div>
                <span className="text-[10px] text-gray-400 w-12 text-right font-medium">{fmt(g.views)}</span>
              </div>
            ))}
          </div>
        ) : (
          <UnavailablePanel icon={MapPin} tint="bg-emerald-50 text-emerald-600" message="YouTube geography data unavailable" />
        )}
      </div>
    </motion.div>
  )
}
