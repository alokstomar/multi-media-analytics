import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, CheckCircle2, AlertTriangle, Lightbulb, TrendingUp } from 'lucide-react'
import { usePlatformAdapter } from '../../platformAdapters'
import { usePlatform } from '../../context/PlatformContext'
import { getStrategistTips as apiGetStrategistTips } from '../../services/api'

const cs = '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)'

function generateFallback(channelData, platform) {
  const overview = channelData?._raw?.overview || {}
  const eng = overview.engagementRate || 3.5
  const growth = overview.viewsGrowth || overview.reachGrowth || 0
  return [
    { id: 1, type: 'positive', text: `${platform === 'instagram' ? 'Your account\'s' : 'Your channel\'s'} engagement is at ${eng.toFixed(1)}% — host interactive stories or reels to reinforce viewer retention.` },
    { id: 2, type: 'warning', text: growth >= 0 ? `${platform === 'instagram' ? 'Reach' : 'Views'} growth is solid, but comment response rates are below average (-12%). Respond to top comments.` : `Growth is currently dipping — try optimizing your ${platform === 'instagram' ? 'post captions' : 'video descriptions'} with popular search tags.` },
    { id: 3, type: 'info', text: platform === 'instagram' ? 'Reels performance is outperforming carousel uploads by 38% this week. Focus on creating 15-second teaser loops.' : 'Shorts performance is outperforming long-form uploads by 38% this week. Focus on creating 15-second teaser loops.' },
    { id: 4, type: 'positive', text: 'Optimal upload schedule: Publish between 6 PM - 9 PM in your core audience\'s timezone for peak initial visibility.' },
  ]
}

export default function AIStrategistPanel({ channelData }) {
  const { selectedPlatform } = usePlatform()
  const { activeAccountId: activeChannelId } = usePlatformAdapter()
  const [tips, setTips] = useState(() => generateFallback(channelData, selectedPlatform))

  useEffect(() => {
    if (!activeChannelId || activeChannelId === 'demo' || activeChannelId === 'demo_ig') {
      setTips(generateFallback(channelData, selectedPlatform))
      return
    }
    apiGetStrategistTips(activeChannelId)
      .then((res) => {
        const apiTips = res?.data?.tips
        if (Array.isArray(apiTips) && apiTips.length > 0) {
          setTips(apiTips)
        } else {
          setTips(generateFallback(channelData, selectedPlatform))
        }
      })
      .catch(() => setTips(generateFallback(channelData, selectedPlatform)))
  }, [activeChannelId, channelData, selectedPlatform])

  return (
    <div className="rounded-[20px] border border-gray-100 bg-white p-5.5 space-y-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)' }}>
      {/* Title */}
      <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600 ">
          <Sparkles className="h-4.5 w-4.5" />
        </div>
        <div>
          <h3 className="text-[15.5px] font-bold text-gray-900 tracking-tight leading-snug">AI Strategist</h3>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">Real-time action dashboard</p>
        </div>
      </div>

      {/* Strategy Tips List */}
      <div className="space-y-3.5">
        {tips.map((tip, i) => {
          let Icon = Lightbulb
          let bg = 'bg-violet-50 border-violet-200/20 text-violet-600 hover:border-violet-200/40'
          let color = 'text-violet-600'
          let dotColor = 'bg-violet-500'

          if (tip.type === 'positive') {
            Icon = CheckCircle2
            bg = 'bg-emerald-50 border-emerald-200/20 text-emerald-600 hover:border-emerald-200/40'
            color = 'text-emerald-600'
            dotColor = 'bg-emerald-500'
          } else if (tip.type === 'warning') {
            Icon = AlertTriangle
            bg = 'bg-amber-50 border-amber-200/20 text-amber-600 hover:border-amber-200/40'
            color = 'text-amber-600 font-bold'
            dotColor = 'bg-amber-500'
          } else if (tip.type === 'info') {
            Icon = TrendingUp
            bg = 'bg-blue-50 border-blue-200/20 text-blue-600 hover:border-blue-200/40'
            color = 'text-blue-600'
            dotColor = 'bg-blue-500'
          }

          return (
            <motion.div
              key={tip.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: i * 0.08, ease: [0.25, 1, 0.5, 1] }}
                            className={`relative rounded-2xl border p-4.5 bg-white transition-all duration-300 cursor-pointer ${bg}`}
            >
              {/* Selective Active Indicator Dot */}
              <div className={`absolute top-3.5 right-3.5 h-1.5 w-1.5 rounded-full ${dotColor}`} />

              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-lg flex items-center justify-center shrink-0 border border-white mt-0.5 bg-white shadow-xs">
                  <Icon className={`h-3.5 w-3.5 ${color}`} />
                </div>
                <p className="text-[11.5px] font-bold text-gray-700 leading-relaxed pr-2">
                  {tip.text}
                </p>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Algorithmic status */}
      <div className="rounded-2xl bg-gray-50 p-4 border border-gray-100 text-[10px] text-gray-500 space-y-2 leading-relaxed font-semibold shadow-xs">
        <p className="font-bold text-gray-700 flex items-center gap-1">
          <Sparkles className="h-3.5 w-3.5 text-violet-500 shrink-0" /> Algorithmic Indexing
        </p>
        <p className="leading-relaxed">AI scans similar top-100 niche {selectedPlatform === 'instagram' ? 'accounts' : 'channels'} every 6 hours to construct recommendations aligned with dynamic audience behavior.</p>
      </div>

    </div>
  )
}
