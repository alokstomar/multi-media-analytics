import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, Sparkles, AlertCircle } from 'lucide-react'
import { usePlatformAdapter } from '../../platformAdapters'
import { usePlatform } from '../../context/PlatformContext'
import { generateVideoIdeas as apiGenerateVideoIdeas } from '../../services/api'
import { LoadingState, ErrorState, EmptyState, isAiUnavailable } from './StateShells'

export default function VideoIdeasSection() {
  const [isOpen, setIsOpen] = useState(true)
  const { selectedPlatform } = usePlatform()
  const { activeAccountId: activeChannelId } = usePlatformAdapter()
  const [ideas, setIdeas] = useState(null)
  const [status, setStatus] = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const emptyRetriedRef = useRef(false)

  useEffect(() => { emptyRetriedRef.current = false }, [activeChannelId])

  const load = useCallback(async () => {
    if (!activeChannelId || activeChannelId === 'demo' || activeChannelId === 'demo_ig') {
      setIdeas(null)
      setStatus('empty')
      return
    }
    setStatus('loading')
    try {
      const res = await apiGenerateVideoIdeas(activeChannelId)
      const apiIdeas = res?.data?.ideas
      if (Array.isArray(apiIdeas) && apiIdeas.length > 0) {
        setIdeas(apiIdeas)
        setStatus('idle')
      } else if (!emptyRetriedRef.current) {
        emptyRetriedRef.current = true
        setTimeout(load, 400)
      } else {
        setIdeas(null)
        setStatus('empty')
      }
    } catch (err) {
      setIdeas(null)
      setErrorMsg(isAiUnavailable(err) ? 'AI service temporarily unavailable' : 'Failed to load ideas')
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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-[17px] font-bold text-gray-900 tracking-tight">{selectedPlatform === 'instagram' ? 'Recommended Next Reels/Posts' : 'Recommended Next Videos'}</h2>
            <p className="text-[12px] text-gray-500 mt-0.5 font-medium">Top 10 creator concepts optimized for {selectedPlatform === 'instagram' ? 'reach, engagement and saves' : 'watch time, CTR and retention gains'}</p>
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
            <div className="p-6 pt-3 border-t border-gray-50 max-h-[640px] overflow-y-auto scrollbar-thin bg-gray-50">
              {status === 'loading' && <LoadingState label="Generating ideas..." />}
              {status === 'error' && <ErrorState message={errorMsg} onRetry={load} />}
              {status === 'empty' && <EmptyState message="No recommendations yet — the AI service may be warming up" onRetry={load} />}
              {status === 'idle' && ideas && (
                <div className="space-y-4.5">
                  {ideas.map((idea, idx) => (
                    <motion.div
                      key={idea.id || idx}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: idx * 0.04 }}
                      className="rounded-2xl border border-gray-100 bg-white p-5 hover:border-violet-200/60 transition-all duration-300 grid grid-cols-1 md:grid-cols-12 gap-5 items-center"
                    >
                      <div className="md:col-span-6 space-y-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold text-gray-400 uppercase">CONCEPT #{idea.id || idx + 1}</span>
                          {idea.tag && idea.badgeColor && (
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${idea.badgeColor}`}>
                              {idea.tag}
                            </span>
                          )}
                        </div>
                        <h3 className="text-[15px] font-bold text-gray-900 leading-snug tracking-tight">
                          {idea.title}
                        </h3>
                        {idea.whyRecommend && (
                          <p className="text-[11px] text-gray-600 leading-relaxed flex items-start gap-2 bg-violet-50 p-3 rounded-xl border border-violet-100/30">
                            <AlertCircle className="h-3.5 w-3.5 mt-0.5 text-violet-500 shrink-0" />
                            <span className="font-medium">{idea.whyRecommend}</span>
                          </p>
                        )}
                      </div>

                      <div className="md:col-span-3 grid grid-cols-2 gap-3">
                        <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{selectedPlatform === 'instagram' ? 'Est. Reach' : 'Est. Views'}</p>
                          <p className="text-[16px] font-bold text-gray-800 mt-0.5">{idea.predictedViews || '—'}</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Est. Likes</p>
                          <p className="text-[16px] font-bold text-gray-800 mt-0.5">{idea.predictedEngagement?.split(' ')[0] || '—'}</p>
                        </div>
                      </div>

                      <div className="md:col-span-3 space-y-3">
                        {[
                          { label: 'Opportunity Score', value: idea.opportunity, color: 'violet', bar: 'bg-violet-600' },
                          { label: 'Production Difficulty', value: idea.difficulty, color: 'amber', bar: 'bg-amber-500' },
                          { label: 'Trend Index', value: idea.trendScore, color: 'emerald', bar: 'bg-emerald-500' },
                        ].map((m) => (
                          <div key={m.label}>
                            <div className="flex justify-between text-[11px] font-bold mb-1">
                              <span className="text-gray-500">{m.label}</span>
                              <span className={`text-${m.color}-600 font-bold`}>{m.value || 0}%</span>
                            </div>
                            <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                              <div className={`${m.bar} h-full rounded-full`} style={{ width: `${m.value || 0}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
