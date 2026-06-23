import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, Users, Sparkles, TrendingUp, Compass, Target } from 'lucide-react'
import { usePlatformAdapter } from '../../platformAdapters'
import { usePlatform } from '../../context/PlatformContext'
import { getContentGaps as apiGetContentGaps } from '../../services/api'
import { LoadingState, ErrorState, EmptyState, isAiUnavailable } from './StateShells'

export default function CompetitorOpportunities() {
  const [isOpen, setIsOpen] = useState(false)
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
      setErrorMsg(isAiUnavailable(err) ? 'AI service temporarily unavailable' : 'Failed to load competitor opportunities')
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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-[17px] font-bold text-gray-900 tracking-tight">Competitor Content Opportunities</h2>
            <p className="text-[12px] text-gray-500 mt-0.5 font-medium">Cross-channel competitive gap evaluation and winning layout formats</p>
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
              {status === 'loading' && <LoadingState label="Loading competitor opportunities..." />}
              {status === 'error' && <ErrorState message={errorMsg} onRetry={load} />}
              {status === 'empty' && <EmptyState message="No competitor opportunities available" />}
              {status === 'idle' && compData && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-[13px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                      <Compass className="h-4 w-4 text-indigo-500 shrink-0" /> Niche Search Gaps
                    </h3>
                    <div className="space-y-3">
                      {compData.gaps.slice(0, 2).map((gap, i) => (
                        <motion.div
                          key={gap.id || i}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="rounded-2xl border border-gray-100 bg-white p-4.5 space-y-2.5 transition-all duration-300"
                        >
                          <div className="flex justify-between items-center">
                            {gap.opportunity && gap.badgeColor && (
                              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[9px] font-bold tracking-tight border ${gap.badgeColor}`}>
                                {gap.opportunity} Opportunity
                              </span>
                            )}
                            {gap.monthlyVolume && (
                              <span className="text-[10px] text-gray-400 font-bold">Vol: <span className="text-gray-600">{gap.monthlyVolume}</span></span>
                            )}
                          </div>
                          {gap.topic && (
                            <p className="text-[13.5px] font-bold text-gray-900 leading-snug tracking-tight">{gap.topic}</p>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
