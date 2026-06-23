import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from 'recharts'
import { Users, Link2, Sparkles, AlertCircle, Activity } from 'lucide-react'
import { usePlatformAdapter } from '../../platformAdapters'
import { getPortfolioAudienceOverlap } from '../../services/api'
import { LoadingState, ErrorState, EmptyState, isAiUnavailable } from '../content-intelligence/StateShells'

const cs = '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)'

export default function AudienceOverlap({ selectedIds }) {
  const { accounts: allChannels } = usePlatformAdapter()
  const [activePairIdx, setActivePairIdx] = useState(0)
  const [data, setData] = useState(null)
  const [status, setStatus] = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const emptyRetriedRef = useRef(false)
  const selectedIdsKey = (selectedIds || []).join(',')

  useEffect(() => { emptyRetriedRef.current = false }, [selectedIdsKey])

  const activeChannels = useMemo(() => {
    return (allChannels || []).filter(c => selectedIds.includes(c.id))
  }, [allChannels, selectedIds])

  const pairwiseRelations = useMemo(() => data?.pairs || [], [data])
  const radarData = useMemo(() => data?.radarData || [], [data])

  const load = useCallback(async () => {
    if (!selectedIds || selectedIds.length < 2 || selectedIds.includes('demo')) {
      setData(null)
      setStatus('empty')
      return
    }
    setStatus('loading')
    try {
      const res = await getPortfolioAudienceOverlap(selectedIds)
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
        setData({ pairs: mapped, radarData: Array.isArray(d.radarData) ? d.radarData : [] })
        setStatus('idle')
      } else if (!emptyRetriedRef.current) {
        emptyRetriedRef.current = true
        setTimeout(load, 400)
      } else {
        setData(null)
        setStatus('empty')
      }
    } catch (err) {
      setData(null)
      setErrorMsg(isAiUnavailable(err) ? 'AI service temporarily unavailable' : 'Failed to load audience overlap')
      setStatus('error')
    }
  }, [selectedIds, allChannels])

  useEffect(() => { load() }, [load])

  if (activeChannels.length < 2) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="rounded-[20px] border border-gray-100 bg-white p-6 space-y-4"
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
          <AlertCircle className="h-8 w-8 text-gray-300 mx-auto" />
          <p className="text-sm font-bold text-gray-500 mt-2">Audience overlap requires at least 2 channels</p>
          <p className="text-xs text-gray-400 mt-1">Select multiple channels in the strip above to enable pairing calculations.</p>
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

      {status === 'loading' && <LoadingState label="Computing audience overlap..." />}
      {status === 'error' && <ErrorState message={errorMsg} onRetry={load} />}
      {status === 'empty' && <EmptyState message="No portfolio intelligence yet — the AI service may be warming up" onRetry={load} />}

      {status === 'idle' && activePair && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-4">
            <div className="flex items-center justify-between bg-gray-50/50 border border-gray-100 rounded-2xl p-4">
              <div className="flex items-center gap-3">
                {activePair.chA?.avatar && <img src={activePair.chA.avatar} className="h-10 w-10 rounded-full border-2 border-white shadow-sm" style={{ boxShadow: `0 0 0 2px ${activePair.chA.color}40` }} />}
                <div className="h-6 w-6 rounded-full bg-white border border-gray-100 flex items-center justify-center shadow-sm">
                  <Link2 className="h-3.5 w-3.5 text-gray-400" />
                </div>
                {activePair.chB?.avatar && <img src={activePair.chB.avatar} className="h-10 w-10 rounded-full border-2 border-white shadow-sm" style={{ boxShadow: `0 0 0 2px ${activePair.chB.color}40` }} />}
              </div>
              <div>
                {activePair.ratingColor && activePair.rating && (
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${activePair.ratingColor}`}>
                    {activePair.rating}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: 'Audience Overlap', val: activePair.overlap, color: 'bg-indigo-600', text: 'shared viewers' },
                { label: 'Content Similarity', val: activePair.contentSim, color: 'bg-purple-600', text: 'topic mapping' },
                { label: 'Demographic Match', val: activePair.demoMatch, color: 'bg-emerald-600', text: 'geo & age match' }
              ].map((m) => (
                <div key={m.label} className="rounded-2xl border border-gray-100 p-4 space-y-2">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">{m.label}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-gray-900 leading-none">{m.val != null ? `${m.val}%` : '—'}</span>
                  </div>
                  {m.val != null && (
                    <div className="w-full bg-gray-100 h-[6px] rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${m.val}%` }}
                        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                        className={`h-full rounded-full ${m.color}`}
                      />
                    </div>
                  )}
                  <p className="text-[9px] text-gray-300 font-medium">{m.text}</p>
                </div>
              ))}
            </div>

            {activePair.collabPotential != null && (
              <div className="rounded-2xl bg-indigo-50/30 border border-indigo-100/50 p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-indigo-600">
                  <Sparkles className="h-4.5 w-4.5 fill-indigo-100" />
                  <h4 className="text-[12px] font-bold uppercase tracking-wider">Collaboration Forecast</h4>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold text-indigo-900">{activePair.collabPotential}</span>
                  <span className="text-[11px] font-bold text-indigo-400">/ 100 synergy index</span>
                </div>
                {activePair.recText && (
                  <p className="text-[11px] text-gray-600 leading-relaxed font-medium">{activePair.recText}</p>
                )}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 border border-gray-100 rounded-2xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Interest Vectors alignment</p>
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gray-50 border border-gray-100">
                <Activity className="h-3.5 w-3.5 text-gray-400" />
              </div>
            </div>

            {radarData.length > 0 ? (
              <>
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
                              <div className="rounded-xl border border-gray-100 bg-white/95 p-3 shadow-md">
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
              </>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-center px-4">
                <p className="text-[11px] text-gray-400 font-medium">No interest vector data available</p>
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
}
