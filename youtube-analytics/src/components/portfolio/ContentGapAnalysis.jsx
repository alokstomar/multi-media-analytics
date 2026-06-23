import { useState, useMemo, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Compass, Crown, Star, TrendingUp, Eye, ChevronDown, ChevronUp, Award, Users, Activity, Target } from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import { usePlatformAdapter } from '../../platformAdapters'
import { getPortfolioContentGaps } from '../../services/api'
import { LoadingState, ErrorState, EmptyState, isAiUnavailable } from '../content-intelligence/StateShells'

const cs = '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)'

function ScoreRing({ score, size = 40, strokeWidth = 3.5 }) {
  const safe = Number(score) || 0
  const radius = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * radius
  const offset = circ - (safe / 100) * circ
  const color = safe >= 95 ? '#8B5CF6' : safe >= 85 ? '#3B82F6' : safe >= 70 ? '#10B981' : '#F59E0B'
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#F3F4F6" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-800">{safe}</span>
    </div>
  )
}

function TierBadge({ score }) {
  const s = Number(score) || 0
  if (s >= 95) return <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 border border-violet-200/50 px-1.5 py-0.5 text-[8px] font-bold text-violet-700 uppercase"><Crown className="h-2.5 w-2.5" />Elite</span>
  if (s >= 85) return <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200/50 px-1.5 py-0.5 text-[8px] font-bold text-blue-700 uppercase"><Star className="h-2.5 w-2.5" />High</span>
  if (s >= 70) return <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200/50 px-1.5 py-0.5 text-[8px] font-bold text-emerald-700 uppercase"><TrendingUp className="h-2.5 w-2.5" />Good</span>
  return <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200/50 px-1.5 py-0.5 text-[8px] font-bold text-amber-700 uppercase"><Eye className="h-2.5 w-2.5" />Watch</span>
}

export default function ContentGapAnalysis({ selectedIds }) {
  const { accounts: allChannels } = usePlatformAdapter()
  const [sortBy, setSortBy] = useState('opportunity')
  const [expandedIdx, setExpandedIdx] = useState(null)
  const [gaps, setGaps] = useState(null)
  const [status, setStatus] = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const activeChannels = useMemo(() => (allChannels || []).filter(c => selectedIds.includes(c.id)), [allChannels, selectedIds])

  const load = useCallback(async () => {
    if (!selectedIds || selectedIds.length === 0 || selectedIds.includes('demo')) {
      setGaps(null)
      setStatus('empty')
      return
    }
    setStatus('loading')
    try {
      const res = await getPortfolioContentGaps(selectedIds)
      const d = res?.data
      if (Array.isArray(d?.gaps) && d.gaps.length > 0) {
        const channelMap = {}
        allChannels.forEach(c => { channelMap[c.id] = c })
        const mapped = d.gaps.map(g => {
          const ch = channelMap[g.bestChannelId] || activeChannels[0] || { name: g.bestChannelName }
          return { ...g, bestChannel: ch }
        })
        setGaps(mapped)
        setStatus('idle')
      } else {
        setGaps(null)
        setStatus('empty')
      }
    } catch (err) {
      setGaps(null)
      setErrorMsg(isAiUnavailable(err) ? 'AI service temporarily unavailable' : 'Failed to load content gap analysis')
      setStatus('error')
    }
  }, [selectedIds, allChannels, activeChannels])

  useEffect(() => { load() }, [load])

  const summaryStats = useMemo(() => {
    if (!gaps || gaps.length === 0) return null
    const sorted = [...gaps].sort((a, b) => (b.opportunityScore || 0) - (a.opportunityScore || 0))
    const avgScore = Math.round(gaps.reduce((s, o) => s + (o.opportunityScore || 0), 0) / gaps.length)
    const fastestGrowth = [...gaps].sort((a, b) => parseFloat(b.growth || 0) - parseFloat(a.growth || 0))[0]
    const totalReach = gaps.reduce((s, o) => {
      const low = parseFloat((o.viewRange || '').replace(/[^0-9.]/g, ''))
      return s + (low || 0)
    }, 0)
    return {
      total: gaps.length,
      avgScore,
      topROI: sorted[0],
      fastestCat: fastestGrowth,
      reachGain: `${totalReach.toFixed(1)}M+`
    }
  }, [gaps])

  const sortedOpportunities = useMemo(() => {
    if (!gaps) return []
    const list = [...gaps]
    if (sortBy === 'opportunity') list.sort((a, b) => (b.opportunityScore || 0) - (a.opportunityScore || 0))
    else if (sortBy === 'growth') list.sort((a, b) => parseFloat(b.growth || 0) - parseFloat(a.growth || 0))
    else if (sortBy === 'roi') list.sort((a, b) => (b.roiScore || 0) - (a.roiScore || 0))
    else if (sortBy === 'difficulty') list.sort((a, b) => (a.diffScore || 0) - (b.diffScore || 0))
    return list
  }, [gaps, sortBy])

  if (activeChannels.length === 0) {
    return (
      <div className="rounded-[20px] border border-gray-100 bg-white p-8 flex flex-col items-center justify-center min-h-[300px]" style={{ boxShadow: cs }}>
        <Compass className="h-10 w-10 text-gray-200" />
        <p className="text-sm font-bold text-gray-400 mt-3">No channels selected</p>
        <p className="text-xs text-gray-300 mt-1">Select portfolio channels to discover content opportunity</p>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.25 }}
      className="rounded-[20px] border border-gray-100 bg-white space-y-0"
      style={{ boxShadow: cs }}
    >
      <div className="sticky top-0 z-10 bg-white/95 rounded-t-[20px] border-b border-gray-100 p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
              <Compass className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-gray-900 tracking-tight">Content Gap Analysis</h3>
              <p className="text-[11px] text-gray-400">AI-powered opportunity engine across your portfolio</p>
            </div>
          </div>
          {status === 'idle' && gaps && (
            <div className="flex items-center gap-1 bg-gray-50 border border-gray-100 p-0.5 rounded-xl">
              {[
                { key: 'opportunity', label: 'Score' },
                { key: 'growth', label: 'Growth' },
                { key: 'roi', label: 'ROI' },
                { key: 'difficulty', label: 'Easy First' }
              ].map((item) => (
                <button key={item.key} onClick={() => setSortBy(item.key)}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${sortBy === item.key ? 'bg-white text-gray-900 shadow-sm border border-gray-100/50' : 'text-gray-400 hover:text-gray-600'}`}
                >{item.label}</button>
              ))}
            </div>
          )}
        </div>

        {summaryStats && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {[
              { label: 'Opportunities', value: summaryStats.total, sub: 'topics found', color: 'text-cyan-600' },
              { label: 'Avg Score', value: summaryStats.avgScore, sub: '/ 100', color: 'text-blue-600' },
              { label: 'Highest ROI', value: summaryStats.topROI?.topic?.split(' ').slice(0, 3).join(' '), sub: `Score ${summaryStats.topROI?.opportunityScore}`, color: 'text-violet-600', small: true },
              { label: 'Fastest Growing', value: summaryStats.fastestCat?.category, sub: summaryStats.fastestCat?.growth, color: 'text-emerald-600' },
              { label: 'Est. Reach Gain', value: summaryStats.reachGain, sub: 'potential views', color: 'text-amber-600' }
            ].map((kpi, i) => (
              <div key={i} className="rounded-xl bg-gray-50/80 border border-gray-100/60 px-3 py-2.5">
                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">{kpi.label}</p>
                <p className={`${kpi.small ? 'text-[11px]' : 'text-[16px]'} font-bold ${kpi.color} leading-tight mt-0.5 truncate`}>{kpi.value}</p>
                <p className="text-[9px] text-gray-400 font-medium">{kpi.sub}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-5 space-y-3">
        {status === 'loading' && <LoadingState label="Analyzing portfolio content gaps..." />}
        {status === 'error' && <ErrorState message={errorMsg} onRetry={load} />}
        {status === 'empty' && <EmptyState message="No portfolio intelligence available" />}

        {status === 'idle' && gaps && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Award className="h-3.5 w-3.5 text-cyan-500" /> Portfolio Opportunity Leaderboard
              </p>
              <span className="text-[9px] font-bold text-gray-300">{sortedOpportunities.length} opportunities ranked</span>
            </div>

            <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
              <AnimatePresence mode="popLayout">
                {sortedOpportunities.map((opp, idx) => {
                  const isExpanded = expandedIdx === idx
                  return (
                    <motion.div
                      key={opp.topic || idx}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3, delay: idx * 0.03 }}
                      className="group border border-gray-100 bg-white rounded-2xl overflow-hidden hover:border-cyan-200/80 transition-all duration-300"
                      style={{ boxShadow: cs }}
                    >
                      <div className="p-4 flex items-center gap-4">
                        <div className="shrink-0 w-7 text-center">
                          <span className={`text-[14px] font-bold ${idx < 3 ? 'text-cyan-600' : 'text-gray-300'}`}>#{idx + 1}</span>
                        </div>

                        <div className="shrink-0"><ScoreRing score={opp.opportunityScore} /></div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <TierBadge score={opp.opportunityScore} />
                            {opp.category && <span className="text-[8px] font-bold text-gray-400 bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded">{opp.category}</span>}
                            {opp.format && <span className="text-[8px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">{opp.format}</span>}
                          </div>
                          <h4 className="text-[13px] font-bold text-gray-900 group-hover:text-cyan-700 transition-colors leading-tight truncate">{opp.topic}</h4>
                        </div>

                        <div className="shrink-0 flex items-center gap-4">
                          {Array.isArray(opp.sparkData) && opp.sparkData.length > 0 && (
                            <div className="hidden sm:block h-7 w-16">
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={opp.sparkData} margin={{ top: 2, right: 1, left: 1, bottom: 0 }}>
                                  <defs>
                                    <linearGradient id={`gap-${idx}`} x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="#0891b2" stopOpacity={0.2} />
                                      <stop offset="100%" stopColor="#0891b2" stopOpacity={0} />
                                    </linearGradient>
                                  </defs>
                                  <Area type="monotone" dataKey="v" stroke="#0891b2" strokeWidth={1.5} fill={`url(#gap-${idx})`} dot={false} />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                          <div className="text-right space-y-0.5">
                            <p className="text-[11px] font-bold text-emerald-600">{opp.growth}</p>
                            <p className="text-[9px] font-bold text-gray-400">{opp.volume} vol</p>
                          </div>
                          {opp.viewRange && (
                            <div className="text-right space-y-0.5">
                              <p className="text-[11px] font-bold text-indigo-600">{opp.viewRange.split(' – ')[0]}</p>
                              <p className="text-[9px] font-bold text-gray-400">min views</p>
                            </div>
                          )}
                          {opp.bestChannel && (
                            <div className="flex items-center gap-1.5">
                              {opp.bestChannel.avatar && <img src={opp.bestChannel.avatar} className="h-5 w-5 rounded-full object-cover" alt="" />}
                              <div>
                                <p className="text-[9px] font-bold text-gray-700 leading-none">{opp.bestChannel.name?.split(' ')[0]}</p>
                                {opp.confidence != null && <p className="text-[8px] font-bold text-emerald-600">{opp.confidence}%</p>}
                              </div>
                            </div>
                          )}
                          <button onClick={() => setExpandedIdx(isExpanded ? null : idx)} className="shrink-0 h-6 w-6 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition cursor-pointer">
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
                          </button>
                        </div>
                      </div>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
                              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-3">
                                {[
                                  { label: 'Opp Score', value: opp.opportunityScore, color: 'text-cyan-600' },
                                  { label: 'CTR Uplift', value: opp.ctr || '—', color: 'text-blue-600' },
                                  { label: 'Search Growth', value: opp.growth, color: 'text-emerald-600' },
                                  { label: 'Competition', value: opp.compLevel || '—', color: 'text-gray-700' },
                                  { label: 'Difficulty', value: opp.diffScore != null ? `${opp.diffScore}/100` : (opp.difficulty || '—'), color: 'text-amber-600' },
                                  { label: 'Confidence', value: opp.confidence != null ? `${opp.confidence}%` : '—', color: 'text-violet-600' }
                                ].map((m, i) => (
                                  <div key={i} className="rounded-lg bg-gray-50 px-2.5 py-2 text-center">
                                    <p className="text-[7px] font-bold text-gray-400 uppercase">{m.label}</p>
                                    <p className={`text-[13px] font-bold ${m.color} mt-0.5`}>{m.value ?? '—'}</p>
                                  </div>
                                ))}
                              </div>

                              {opp.reasons && (
                                <div className="rounded-xl bg-cyan-50/40 border border-cyan-100/50 p-3 space-y-2">
                                  <p className="text-[10px] font-bold text-cyan-800 uppercase tracking-wider">Why AI Recommends This</p>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {[
                                      { label: 'Audience Demand', text: opp.reasons.audience, icon: Users },
                                      { label: 'Search Trends', text: opp.reasons.search, icon: TrendingUp },
                                      { label: 'Competitor Gap', text: opp.reasons.competitor, icon: Activity },
                                      { label: 'Portfolio Fit', text: opp.reasons.portfolio, icon: Target }
                                    ].filter(r => r.text).map((r, i) => (
                                      <div key={i} className="rounded-lg bg-white p-2.5">
                                        <p className="text-[9px] font-bold text-cyan-700 flex items-center gap-1 mb-1"><r.icon className="h-3 w-3" />{r.label}</p>
                                        <p className="text-[10px] text-gray-600 leading-relaxed">{r.text}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
    </motion.div>
  )
}
