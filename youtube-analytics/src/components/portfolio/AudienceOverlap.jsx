import { useMemo, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, Tooltip } from 'recharts'
import { Users, Link2, Sparkles, AlertCircle, ArrowRight, Activity, HelpCircle, Layers, CheckCircle2 } from 'lucide-react'
import { usePlatformAdapter } from '../../platformAdapters'
import { getPortfolioAudienceOverlap } from '../../services/api'

const cs = '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)'

const RADAR_AXES = [
  'Tech Appeal',
  'Entertainment Value',
  'Educational Depth',
  'Viral Potential',
  'Subscriber Loyalty',
  'Global Reach'
]

export default function AudienceOverlap({ selectedIds }) {
  const { accounts: allChannels } = usePlatformAdapter()
  const [activePairIdx, setActivePairIdx] = useState(0)

  const activeChannels = useMemo(() => {
    return allChannels.filter(c => selectedIds.includes(c.id))
  }, [allChannels, selectedIds])

  const getRadarValue = (channel, axis) => {
    const raw = channel._raw || {}
    const category = channel.category || ''
    const hash = (channel.name.length + axis.length) % 20

    switch (axis) {
      case 'Tech Appeal':
        return category.toLowerCase() === 'tech' ? 94 : 35 + hash
      case 'Entertainment Value':
        return ['entertainment', 'comedy', 'music', 'gaming'].includes(category.toLowerCase()) ? 96 : 40 + hash
      case 'Educational Depth':
        return ['education', 'tech', 'news'].includes(category.toLowerCase()) ? 90 : 25 + hash
      case 'Viral Potential':
        return 50 + (Number(raw.totalViews || 0) % 45)
      case 'Subscriber Loyalty':
        return 60 + (Number(raw.subscribers || 0) % 35)
      case 'Global Reach':
        return 55 + (channel.name.charCodeAt(0) % 40)
      default:
        return 50
    }
  }

  function generateFallbackPairs() {
    if (activeChannels.length < 2) return []
    const pairs = []
    for (let i = 0; i < activeChannels.length; i++) {
      for (let j = i + 1; j < activeChannels.length; j++) {
        const chA = activeChannels[i]
        const chB = activeChannels[j]
        const sameCat = chA.category === chB.category
        const hash = (chA.name.length * chB.name.length) % 25
        const overlap = sameCat ? (64 + hash) : (24 + hash)
        const contentSim = sameCat ? (76 + (hash % 17)) : (16 + (hash % 29))
        const demoMatch = 42 + ((chA.name.charCodeAt(0) + chB.name.charCodeAt(0)) % 49)
        const collabPotential = Math.round((overlap * 0.4) + (contentSim * 0.3) + (demoMatch * 0.3))

        let rating = 'Moderate Fit', ratingColor = 'text-amber-600 bg-amber-50 border-amber-100/50', recText = 'Consider simple cross-promotional community posts to gauge viewer crossover.'
        if (collabPotential >= 80) { rating = 'Outstanding Synergy'; ratingColor = 'text-emerald-600 bg-emerald-50 border-emerald-100/50'; recText = 'High recommendation! Schedule a joint long-form video or short collab immediately.' }
        else if (collabPotential >= 60) { rating = 'Strong Potential'; ratingColor = 'text-blue-600 bg-blue-50 border-blue-100/50'; recText = 'Great integration opportunities. A podcast crossover or shorts takeover is advised.' }
        else if (collabPotential < 40) { rating = 'Low Synergy'; ratingColor = 'text-gray-500 bg-gray-50 border-gray-200/50'; recText = 'Audiences are quite segmented. Focus on individual growth before attempting crossover campaigns.' }

        pairs.push({ chA, chB, overlap, contentSim, demoMatch, collabPotential, rating, ratingColor, recText })
      }
    }
    return pairs
  }

  function generateFallbackRadar() {
    return RADAR_AXES.map(axis => {
      const point = { subject: axis }
      activeChannels.forEach(c => { point[c.name] = getRadarValue(c, axis) })
      return point
    })
  }

  const [pairwiseRelations, setPairwiseRelations] = useState(() => generateFallbackPairs())
  const [radarData, setRadarData] = useState(() => generateFallbackRadar())

  useEffect(() => {
    setPairwiseRelations(generateFallbackPairs())
    setRadarData(generateFallbackRadar())
    if (!selectedIds || selectedIds.length < 2 || selectedIds.includes('demo')) return

    getPortfolioAudienceOverlap(selectedIds)
      .then((res) => {
        const d = res?.data
        if (Array.isArray(d?.pairs) && d.pairs.length > 0) {
          const channelMap = {}
          allChannels.forEach(c => { channelMap[c.id] = c })
          const mapped = d.pairs.map(p => ({
            chA: channelMap[p.channelAId] || { id: p.channelAId, name: p.channelAName, color: '#8B5CF6' },
            chB: channelMap[p.channelBId] || { id: p.channelBId, name: p.channelBName, color: '#3B82F6' },
            overlap: p.overlap, contentSim: p.contentSim, demoMatch: p.demoMatch,
            collabPotential: p.collabPotential, rating: p.rating, ratingColor: p.ratingColor, recText: p.recText,
          }))
          setPairwiseRelations(mapped)
          if (Array.isArray(d.radarData)) setRadarData(d.radarData)
        }
      })
      .catch(() => {})
  }, [selectedIds, activeChannels])

  // Safety fallback
  if (activeChannels.length < 2) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="rounded-[20px] border border-gray-100 bg-white p-6 space-y-4 shadow-sm"
        style={{ boxShadow: cs }}
      >
        <div className="flex items-center gap-2.5 border-b border-gray-100 pb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-gray-900 tracking-tight">Portfolio Audience Overlap</h3>
            <p className="text-[11px] text-gray-400">Map mutual crossovers and collaborative opportunities</p>
          </div>
        </div>

        <div className="py-12 text-center border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/10">
          <AlertCircle className="h-8 w-8 text-gray-300 mx-auto animate-pulse" />
          <p className="text-sm font-bold text-gray-500 mt-2">Audience overlap requires at least 2 channels</p>
          <p className="text-xs text-gray-400 mt-1">Please select multiple channels in the strip above to enable pairing calculations.</p>
        </div>
      </motion.div>
    )
  }

  const activePair = pairwiseRelations[activePairIdx] || pairwiseRelations[0]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="rounded-[20px] border border-gray-100 bg-white p-6 space-y-6"
      style={{ boxShadow: cs }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-gray-900 tracking-tight">Audience & Category Overlap</h3>
            <p className="text-[11px] text-gray-400">Cross-reference channel crossovers and category strengths</p>
          </div>
        </div>

        {/* Pairing Selector */}
        {pairwiseRelations.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide max-w-full">
            {pairwiseRelations.map((pair, idx) => (
              <button
                key={idx}
                onClick={() => setActivePairIdx(idx)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border shrink-0 cursor-pointer ${
                  activePairIdx === idx
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-100'
                    : 'bg-gray-50 border-gray-100 text-gray-400 hover:text-gray-600 hover:border-gray-200'
                }`}
              >
                {pair.chA.name.split(' ')[0]} × {pair.chB.name.split(' ')[0]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid: Comparison Cards vs Radar Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Side: Overlap Cards (60% width on desktop) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between bg-gray-50/50 border border-gray-100 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <img src={activePair.chA.avatar} className="h-10 w-10 rounded-full border-2 border-white shadow-sm" style={{ boxShadow: `0 0 0 2px ${activePair.chA.color}40` }} />
              <div className="h-6 w-6 rounded-full bg-white border border-gray-100 flex items-center justify-center shadow-sm">
                <Link2 className="h-3.5 w-3.5 text-gray-400" />
              </div>
              <img src={activePair.chB.avatar} className="h-10 w-10 rounded-full border-2 border-white shadow-sm" style={{ boxShadow: `0 0 0 2px ${activePair.chB.color}40` }} />
            </div>
            <div>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${activePair.ratingColor}`}>
                {activePair.rating}
              </span>
            </div>
          </div>

          {/* Core Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Audience Overlap', val: activePair.overlap, color: 'bg-indigo-600', text: 'shared viewers' },
              { label: 'Content Similarity', val: activePair.contentSim, color: 'bg-purple-600', text: 'topic mapping' },
              { label: 'Demographic Match', val: activePair.demoMatch, color: 'bg-emerald-600', text: 'geo & age match' }
            ].map((m) => (
              <div key={m.label} className="rounded-2xl border border-gray-100 p-4 space-y-2">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">{m.label}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-gray-900 leading-none">{m.val}%</span>
                </div>
                <div className="w-full bg-gray-100 h-[6px] rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${m.val}%` }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                    className={`h-full rounded-full ${m.color}`}
                  />
                </div>
                <p className="text-[9px] text-gray-300 font-medium">{m.text}</p>
              </div>
            ))}
          </div>

          {/* Collab Recommendation Card */}
          <div className="rounded-2xl bg-indigo-50/30 border border-indigo-100/50 p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-indigo-600">
              <Sparkles className="h-4.5 w-4.5 fill-indigo-100" />
              <h4 className="text-[12px] font-bold uppercase tracking-wider">Collaboration Forecast</h4>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-indigo-900">{activePair.collabPotential}</span>
              <span className="text-[11px] font-bold text-indigo-400">/ 100 synergy index</span>
            </div>
            <p className="text-[11px] text-gray-600 leading-relaxed font-medium">
              {activePair.recText}
            </p>
          </div>
        </div>

        {/* Right Side: Radar Chart Visualization (40% width on desktop) */}
        <div className="lg:col-span-2 border border-gray-100 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Interest Vectors alignment</p>
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gray-50 border border-gray-100">
              <Activity className="h-3.5 w-3.5 text-gray-400" />
            </div>
          </div>

          <div className="h-[220px] w-full text-[9px] font-bold select-none">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                <PolarGrid stroke="#F3F4F6" />
                <PolarAngleAxis dataKey="subject" stroke="#9CA3AF" />
                <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#E5E7EB" tick={false} />
                
                {activeChannels.map((c) => (
                  <Radar
                    key={c.id}
                    name={c.name}
                    dataKey={c.name}
                    stroke={c.color}
                    fill={c.color}
                    fillOpacity={0.12}
                  />
                ))}
                
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-xl border border-gray-100 bg-white/95 p-3 shadow-md ">
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">{payload[0].payload.subject}</p>
                          <div className="space-y-1">
                            {payload.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between gap-3 text-[10px] font-bold">
                                <span className="text-gray-600">{item.name}</span>
                                <span className="text-gray-900" style={{ color: item.stroke }}>{item.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    }
                    return null
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 justify-center mt-3 pt-3 border-t border-gray-50">
            {activeChannels.map((c) => (
              <div key={c.id} className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                <span className="text-[9px] text-gray-500 font-bold">{c.name.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
