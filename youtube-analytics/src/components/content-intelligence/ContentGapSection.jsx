import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, Compass, AlertCircle, TrendingUp, Search, Layers } from 'lucide-react'
import { usePlatformAdapter } from '../../platformAdapters'
import { usePlatform } from '../../context/PlatformContext'
import { getContentGaps as apiGetContentGaps } from '../../services/api'
import { LoadingState, ErrorState, EmptyState, isAiUnavailable } from './StateShells'

export default function ContentGapSection() {
  const [isOpen, setIsOpen] = useState(true)
  const { selectedPlatform } = usePlatform()
  const { activeAccountId: activeChannelId } = usePlatformAdapter()
  const [compData, setCompData] = useState(null)
  const [status, setStatus] = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const load = useCallback(async () => {
    if (!activeChannelId || activeChannelId === 'demo' || activeChannelId === 'demo_ig') {
      setCompData(null)
      setStatus('empty')
      return
    }
    setStatus('loading')
    try {
      const res = await apiGetContentGaps(activeChannelId)
      const d = res?.data
      if (Array.isArray(d?.gaps) && d.gaps.length > 0) {
        setCompData({ gaps: d.gaps, nicheTrends: d.nicheTrends || [] })
        setStatus('idle')
      } else {
        setCompData(null)
        setStatus('empty')
      }
    } catch (err) {
      setCompData(null)
      setErrorMsg(isAiUnavailable(err) ? 'AI service temporarily unavailable' : 'Failed to load content gaps')
      setStatus('error')
    }
  }, [activeChannelId])

  useEffect(() => { load() }, [load])

  return (
    <div className="rounded-[20px] border border-gray-100 bg-white overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-5.5 flex items-center justify-between bg-white hover:bg-gray-50/30 transition-colors text-left focus:outline-none"
      >
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-[17px] font-bold text-gray-900 tracking-tight">Content Gap Analysis</h2>
            <p className="text-[12px] text-gray-500 mt-0.5 font-medium">High-demand search terms and competitor content formats currently missing from your {selectedPlatform === 'instagram' ? 'account' : 'channel'}</p>
          </div>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gray-50 text-gray-400 border border-gray-100 hover:text-gray-600 transition-colors">
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="p-6 pt-3 border-t border-gray-50 bg-gray-50">
              {status === 'loading' && <LoadingState label="Analyzing content gaps..." />}
              {status === 'error' && <ErrorState message={errorMsg} onRetry={load} />}
              {status === 'empty' && <EmptyState message="No content gaps available" />}
              {status === 'idle' && compData && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-7 space-y-4">
                    <h3 className="text-[13px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                      <AlertCircle className="h-4 w-4 text-cyan-500 shrink-0" /> Key Missed Niche Opportunities
                    </h3>
                    <div className="space-y-3">
                      {compData.gaps.map((gap, i) => (
                        <motion.div
                          key={gap.id || i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: i * 0.05 }}
                          className="rounded-2xl border border-gray-100 bg-white p-4.5 transition-all duration-300 flex items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 shrink-0 border border-cyan-100/30">
                              <Search className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[13.5px] font-bold text-gray-900 leading-snug truncate tracking-tight">
                                {gap.topic}
                              </p>
                              {gap.monthlyVolume && (
                                <p className="text-[11px] text-gray-400 font-semibold mt-0.5 flex items-center gap-1">
                                  Search Volume: <span className="font-bold text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">{gap.monthlyVolume}</span>
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            {gap.opportunity && gap.badgeColor && (
                              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[9px] font-bold tracking-tight border ${gap.badgeColor}`}>
                                {gap.opportunity} Opportunity
                              </span>
                            )}
                            {gap.difficulty && (
                              <p className="text-[10px] text-gray-400 font-bold mt-1.5">Difficulty: <span className="text-gray-600">{gap.difficulty}</span></p>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {compData.nicheTrends?.length > 0 && (
                    <div className="lg:col-span-5 space-y-4">
                      <h3 className="text-[13px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                        <Layers className="h-4 w-4 text-cyan-500 shrink-0" /> Trending Niche Topic Clusters
                      </h3>
                      <div className="rounded-2xl border border-gray-100 bg-white p-5 space-y-4 shadow-sm">
                        {compData.nicheTrends.map((trend, i) => (
                          <motion.div
                            key={trend.name || i}
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3, delay: i * 0.05 }}
                            className="flex items-center justify-between border-b border-gray-100 pb-3.5 last:border-b-0 last:pb-0"
                          >
                            <div>
                              <p className="text-[12px] font-bold text-gray-900 tracking-tight">{trend.name}</p>
                              {trend.growth && (
                                <p className="text-[10px] text-cyan-600 font-bold mt-0.5 flex items-center gap-1">
                                  <TrendingUp className="h-3 w-3" /> {trend.growth}
                                </p>
                              )}
                            </div>
                            {trend.demand && (
                              <span className="text-[10px] font-bold text-gray-500 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100 shrink-0">
                                {trend.demand}
                              </span>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
