import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, Users, Compass } from 'lucide-react'
import { usePlatformAdapter } from '../../platformAdapters'
import useCompetitorOpportunities from '../../hooks/useCompetitorOpportunities'
import { LoadingState, ErrorState, EmptyState, isAiUnavailable } from './StateShells'

export default function CompetitorOpportunities() {
  const [isOpen, setIsOpen] = useState(false)
  const { activeAccountId: activeChannelId } = usePlatformAdapter()

  const { data, loading, error, refetch } = useCompetitorOpportunities(activeChannelId)

  const opportunities = data?.opportunities || []
  const hasOpportunities = opportunities.length > 0

  const getBadgeColor = (level) => {
    switch (level?.toLowerCase()) {
      case 'very high':
        return 'bg-red-50 text-red-600 border-red-100'
      case 'high':
        return 'bg-blue-50 text-blue-600 border-blue-100'
      case 'medium':
        return 'bg-purple-50 text-purple-600 border-purple-100'
      case 'low':
      default:
        return 'bg-emerald-50 text-emerald-600 border-emerald-100'
    }
  }

  const isDemo = !activeChannelId || activeChannelId === 'demo' || activeChannelId === 'demo_ig'

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
              {loading && <LoadingState label="Analyzing competitor opportunities..." />}
              {!loading && error && (
                <ErrorState
                  message={isAiUnavailable(error) ? 'AI service temporarily unavailable' : 'Failed to load competitor opportunities'}
                  onRetry={refetch}
                />
              )}
              {!loading && !error && isDemo && (
                <EmptyState message="Please connect a channel to view competitor opportunities" />
              )}
              {!loading && !error && !isDemo && !hasOpportunities && (
                <EmptyState message="No competitor opportunities found at this time" />
              )}
              {!loading && !error && !isDemo && hasOpportunities && (
                <div className="space-y-4">
                  <h3 className="text-[13px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                    <Compass className="h-4 w-4 text-indigo-500 shrink-0" /> Recommended Opportunity Gaps
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {opportunities.map((opp, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-2xl border border-gray-100 bg-white p-4.5 space-y-2.5 transition-all duration-300 shadow-sm flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex justify-between items-start gap-2">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[9px] font-bold tracking-tight border ${getBadgeColor(opp.opportunityLevel)}`}>
                              {opp.opportunityLevel} Level
                            </span>
                            {opp.estimatedSearchVolume && (
                              <span className="text-[10px] text-gray-400 font-bold shrink-0">Vol: <span className="text-gray-600">{opp.estimatedSearchVolume}</span></span>
                            )}
                          </div>
                          <p className="text-[14px] font-bold text-gray-900 leading-snug tracking-tight">{opp.title}</p>
                          <p className="text-[12px] text-gray-500 font-medium leading-relaxed">{opp.reason}</p>
                        </div>
                      </motion.div>
                    ))}
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
