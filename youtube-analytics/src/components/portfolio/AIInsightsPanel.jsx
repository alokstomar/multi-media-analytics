import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, BrainCircuit, ArrowUpRight, Zap } from 'lucide-react'
import { usePlatformAdapter } from '../../platformAdapters'
import { usePlatform } from '../../context/PlatformContext'
import { getPortfolioStrategist } from '../../services/api'
import { LoadingState, ErrorState, EmptyState, isAiUnavailable } from '../content-intelligence/StateShells'

const cs = '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)'

export default function AIInsightsPanel({ selectedIds }) {
  const { selectedPlatform } = usePlatform()
  const { accounts: allChannels } = usePlatformAdapter()
  const [report, setReport] = useState(null)
  const [status, setStatus] = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const activeChannels = useMemo(() => {
    return (allChannels || []).filter(c => selectedIds.includes(c.id))
  }, [allChannels, selectedIds])

  const load = useCallback(async () => {
    if (!selectedIds || selectedIds.length === 0 || selectedIds.includes('demo')) {
      setReport(null)
      setStatus('empty')
      return
    }
    setStatus('loading')
    try {
      const res = await getPortfolioStrategist(selectedIds)
      const d = res?.data
      if (d && (d.healthScore != null || Array.isArray(d.recommendations) || Array.isArray(d.growthRadar))) {
        setReport(d)
        setStatus('idle')
      } else {
        setReport(null)
        setStatus('empty')
      }
    } catch (err) {
      setReport(null)
      setErrorMsg(isAiUnavailable(err) ? 'AI service temporarily unavailable' : 'Failed to load strategist report')
      setStatus('error')
    }
  }, [selectedIds])

  useEffect(() => { load() }, [load])

  if (activeChannels.length === 0) {
    return (
      <div className="rounded-[20px] border border-gray-100 bg-white p-6 space-y-4 h-full flex flex-col justify-center" style={{ boxShadow: cs }}>
        <div className="text-center py-6">
          <BrainCircuit className="h-8 w-8 text-gray-300 mx-auto" />
          <p className="text-sm font-bold text-gray-500 mt-2">No active strategist</p>
          <p className="text-xs text-gray-400 mt-1">Select channels to activate the Portfolio AI CSO.</p>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-[20px] border border-gray-100 bg-white p-6 space-y-5 h-full flex flex-col justify-between"
      style={{ boxShadow: cs }}
    >
      <div className="flex items-center justify-between border-b border-gray-100 pb-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <BrainCircuit className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-gray-900 tracking-tight">AI Chief Strategy Officer</h3>
            <p className="text-[11px] text-gray-400">Strategic portfolio advisor & growth orchestrator</p>
          </div>
        </div>
      </div>

      {status === 'loading' && <LoadingState label="Generating strategist report..." />}
      {status === 'error' && <ErrorState message={errorMsg} onRetry={load} />}
      {status === 'empty' && <EmptyState message="No portfolio intelligence available" />}

      {status === 'idle' && report && (
        <>
          {(report.healthScore != null || report.growthMomentum != null || report.riskLevel) && (
            <div className="space-y-3 shrink-0">
              <div className="grid grid-cols-3 gap-2.5">
                {report.healthScore != null && (
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-2.5">
                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wide">Health Score</span>
                    <p className="text-[14px] font-bold text-gray-900 mt-0.5">{report.healthScore}/100</p>
                  </div>
                )}
                {report.growthMomentum != null && (
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-2.5">
                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wide">Momentum</span>
                    <p className="text-[14px] font-bold text-emerald-600 mt-0.5">{report.growthMomentum}</p>
                  </div>
                )}
                {report.riskLevel && (
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-2.5">
                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wide">CSO Risk</span>
                    <span className={`inline-flex rounded text-[10px] font-bold uppercase mt-0.5 px-1 ${report.riskBadgeColor || 'text-gray-600 bg-gray-50 border-gray-100'}`}>
                      {report.riskLevel}
                    </span>
                  </div>
                )}
              </div>

              {report.briefing && (
                <div className="rounded-xl border border-violet-100 bg-violet-50/15 p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 text-violet-700 font-bold text-[10px] uppercase tracking-wider">
                    <Sparkles className="h-3.5 w-3.5 fill-violet-100 shrink-0" />
                    <span>AI Executive Summary Briefing</span>
                  </div>
                  <p className="text-[11px] text-gray-600 leading-relaxed font-medium">{report.briefing}</p>
                </div>
              )}
            </div>
          )}

          {report.stabilityScore != null && (
            <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4 shrink-0 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Stability Assessment</span>
                  <p className="text-[13px] font-bold text-gray-900 tracking-tight leading-none mt-1">Portfolio Stability Index</p>
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold text-indigo-600 block leading-none">{report.stabilityScore}/100</span>
                  {report.riskLevel && (
                    <span className={`inline-flex rounded-full text-[8px] font-bold px-1.5 py-[1px] mt-1 border ${report.riskBadgeColor || 'text-gray-600 bg-gray-50 border-gray-100'}`}>
                      {report.riskLevel} Risk
                    </span>
                  )}
                </div>
              </div>

              {[
                { label: selectedPlatform === 'instagram' ? 'Follower Share' : 'Subscriber Share', val: report.subConcentration },
                { label: selectedPlatform === 'instagram' ? 'Reach Share' : 'Views Share', val: report.viewConcentration },
                { label: selectedPlatform === 'instagram' ? 'Direct Actions' : 'Revenue Dependency', val: report.revenueDependency },
                { label: 'Audience Diversity', val: report.audienceDiversification }
              ].filter(m => m.val != null).length > 0 && (
                <div className="grid grid-cols-2 gap-3 text-[10px]">
                  {[
                    { label: selectedPlatform === 'instagram' ? 'Follower Share' : 'Subscriber Share', val: report.subConcentration },
                    { label: selectedPlatform === 'instagram' ? 'Reach Share' : 'Views Share', val: report.viewConcentration },
                    { label: selectedPlatform === 'instagram' ? 'Direct Actions' : 'Revenue Dependency', val: report.revenueDependency },
                    { label: 'Audience Diversity', val: report.audienceDiversification }
                  ].filter(m => m.val != null).map((m, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between font-bold text-gray-700">
                        <span>{m.label}</span>
                        <span className="font-bold text-gray-900">{m.val}%</span>
                      </div>
                      <div className="w-full bg-gray-200/50 h-[4px] rounded-full overflow-hidden">
                        <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${m.val}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {Array.isArray(report.leaderboard) && report.leaderboard.length > 0 && (
            <div className="rounded-xl border border-gray-100 p-4 space-y-3 shrink-0">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">{selectedPlatform === 'instagram' ? 'Portfolio Champion Accounts' : 'Portfolio Champion Channels'}</span>
              <div className="grid grid-cols-2 gap-2.5 text-[10px] font-bold">
                {report.leaderboard.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                    {item.ch?.avatar ? (
                      <img src={item.ch.avatar} className="h-6.5 w-6.5 rounded-full object-cover border border-gray-100" />
                    ) : (
                      <div className="h-6.5 w-6.5 rounded-full bg-gray-100 flex items-center justify-center text-[8px] font-bold text-gray-400">?</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="text-[8px] font-bold text-gray-400 block uppercase tracking-wide leading-none">{item.label}</span>
                      <p className="text-gray-900 truncate text-[11px] font-bold leading-tight mt-0.5">{item.ch?.name || 'N/A'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(report.growthRadar) && report.growthRadar.length > 0 && (
            <div className="rounded-xl border border-gray-100 p-4 space-y-3 shrink-0">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Top Growth Niche Radar</span>
              <div className="space-y-2.5">
                {report.growthRadar.map((radar, idx) => (
                  <div key={idx} className="space-y-1 text-[10px]">
                    <div className="flex items-center justify-between font-bold text-gray-700">
                      <span>{radar.topic}</span>
                      {radar.growth && <span className="text-cyan-600 font-bold">{radar.growth} velocity</span>}
                    </div>
                    {radar.score != null && (
                      <div className="w-full bg-gray-100 h-[4px] rounded-full overflow-hidden">
                        <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${radar.score}%` }} />
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[8px] text-gray-400 font-bold">
                      {radar.score != null && <span>Opp Score: {radar.score} / 100</span>}
                      {radar.comp && <span>{radar.comp} competition</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(report.recommendations) && report.recommendations.length > 0 && (
            <div className="flex-1 space-y-3 overflow-y-auto max-h-[280px] pr-1.5 scrollbar-thin">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Strategic Priority Stream</span>
              {report.recommendations.map((rec, idx) => (
                <div
                  key={idx}
                  className="relative rounded-xl border border-gray-100 bg-white p-3 hover:border-gray-200 transition-all duration-200 group overflow-hidden text-[10px]"
                >
                  {rec.channelColor && <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: rec.channelColor }} />}
                  <div className="flex items-start gap-2.5">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between">
                        {rec.priority && (
                          <span className={`inline-flex rounded px-1.5 py-[1px] text-[8px] font-bold uppercase ${rec.priorityColor || 'text-gray-600 bg-gray-50'}`}>
                            {rec.priority}
                          </span>
                        )}
                        {rec.confidence != null && (
                          <span className="text-[9px] text-gray-300 font-bold">{rec.confidence}% Conf.</span>
                        )}
                      </div>

                      {rec.title && <p className="text-[11px] font-bold text-gray-900 leading-tight">{rec.title}</p>}
                      {rec.desc && <p className="text-[10px] text-gray-400 leading-relaxed font-semibold">{rec.desc}</p>}

                      {(rec.impact || rec.executionTime) && (
                        <div className="grid grid-cols-2 gap-2 pt-1.5 text-[9px] font-bold text-gray-400 border-t border-gray-50">
                          {rec.impact && (
                            <div>
                              <span>Expected Impact:</span>
                              <p className="text-gray-900 font-bold">{rec.impact}</p>
                            </div>
                          )}
                          {rec.executionTime && (
                            <div>
                              <span>Execution Time:</span>
                              <p className="text-gray-900 font-bold">{rec.executionTime}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {rec.actionText && (
                        <button className="mt-2 inline-flex items-center gap-1 font-bold text-blue-600 bg-blue-50/50 hover:bg-blue-50 border border-blue-100/50 px-2 py-0.5 rounded transition-all cursor-pointer">
                          {rec.actionText}
                          <ArrowUpRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {Array.isArray(report.actionCenter) && report.actionCenter.length > 0 && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/10 p-4 space-y-3 shrink-0">
              <div className="flex items-center gap-1.5 text-indigo-600 border-b border-indigo-100/50 pb-2">
                <Zap className="h-4 w-4 fill-indigo-100 shrink-0" />
                <h4 className="text-[11px] font-bold uppercase tracking-wider">AI Strategy Action Center</h4>
              </div>
              <div className="space-y-2">
                {report.actionCenter.map((act, idx) => (
                  <div key={idx} className="rounded-xl bg-white border border-indigo-100/30 p-2.5 text-[10px] flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-gray-900 leading-tight block truncate">{act.action}</span>
                      {(act.difficulty || act.impact) && (
                        <span className="text-[8px] font-bold text-gray-400">
                          {act.difficulty && `Difficulty: ${act.difficulty}`}
                          {act.difficulty && act.impact && ' · '}
                          {act.impact && `Impact: ${act.impact}`}
                        </span>
                      )}
                    </div>
                    {act.gain && (
                      <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100/30 px-2 py-0.5 shrink-0 rounded">
                        {act.gain} Expected
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </motion.div>
  )
}
