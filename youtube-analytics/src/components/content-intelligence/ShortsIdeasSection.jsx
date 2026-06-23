import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, Zap, Radio, Target, Sparkles, TrendingUp } from 'lucide-react'
import { usePlatformAdapter } from '../../platformAdapters'
import { usePlatform } from '../../context/PlatformContext'
import { generateShortsIdeas as apiGenerateShortsIdeas } from '../../services/api'
import { LoadingState, ErrorState, EmptyState, isAiUnavailable } from './StateShells'

export default function ShortsIdeasSection() {
  const [isOpen, setIsOpen] = useState(true)
  const { selectedPlatform } = usePlatform()
  const { activeAccountId: activeChannelId } = usePlatformAdapter()
  const [shorts, setShorts] = useState(null)
  const [status, setStatus] = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const load = useCallback(async () => {
    if (!activeChannelId || activeChannelId === 'demo' || activeChannelId === 'demo_ig') {
      setShorts(null)
      setStatus('empty')
      return
    }
    setStatus('loading')
    try {
      const res = await apiGenerateShortsIdeas(activeChannelId)
      const apiIdeas = res?.data?.ideas
      if (Array.isArray(apiIdeas) && apiIdeas.length > 0) {
        setShorts(apiIdeas)
        setStatus('idle')
      } else {
        setShorts(null)
        setStatus('empty')
      }
    } catch (err) {
      setShorts(null)
      setErrorMsg(isAiUnavailable(err) ? 'AI service temporarily unavailable' : 'Failed to load Shorts ideas')
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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-[17px] font-bold text-gray-900 tracking-tight">{selectedPlatform === 'instagram' ? 'Reels Idea Engine' : 'Shorts Idea Engine'}</h2>
            <p className="text-[12px] text-gray-500 mt-0.5 font-medium">High-retention vertical hook concepts, cover and thumbnail cues, and CTAs designed for the feed</p>
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
              {status === 'loading' && <LoadingState label="Generating Shorts concepts..." />}
              {status === 'error' && <ErrorState message={errorMsg} onRetry={load} />}
              {status === 'empty' && <EmptyState message="No Shorts recommendations available" />}
              {status === 'idle' && shorts && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {shorts.map((item, idx) => (
                    <motion.div
                      key={item.id || idx}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.35, delay: idx * 0.05 }}
                      className="rounded-2xl border border-gray-100 bg-white p-5 hover:border-amber-200 transition-all duration-300 flex flex-col justify-between"
                    >
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100/50">
                            CONCEPT #{item.id || idx + 1}
                          </span>
                          {item.trendStrength != null && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                              <TrendingUp className="h-3.5 w-3.5" />
                              Trend: {item.trendStrength}%
                            </span>
                          )}
                        </div>

                        <h3 className="text-[14px] font-bold text-gray-900 leading-snug tracking-tight">
                          {item.title}
                        </h3>

                        <div className="space-y-2.5 text-[11px] text-gray-600">
                          {item.hook && (
                            <div className="bg-amber-50/5 border border-amber-100/10 p-3.5 rounded-xl space-y-1">
                              <p className="font-bold text-gray-800 flex items-center gap-1.5">
                                <Radio className="h-3.5 w-3.5 text-amber-500 shrink-0" /> Key Hook (0-3s)
                              </p>
                              <p className="leading-relaxed text-gray-500 font-medium">{item.hook}</p>
                            </div>
                          )}

                          {item.first3s && (
                            <div className="bg-violet-50/5 border border-violet-100/10 p-3.5 rounded-xl space-y-1">
                              <p className="font-bold text-gray-800 flex items-center gap-1.5">
                                <Sparkles className="h-3.5 w-3.5 text-violet-500 shrink-0" /> First 3s Visual Action
                              </p>
                              <p className="leading-relaxed text-gray-500 font-medium">{item.first3s}</p>
                            </div>
                          )}

                          {item.cta && (
                            <div className="bg-emerald-50/5 border border-emerald-100/10 p-3.5 rounded-xl space-y-1">
                              <p className="font-bold text-gray-800 flex items-center gap-1.5">
                                <Target className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Retention CTA
                              </p>
                              <p className="leading-relaxed text-gray-500 font-medium">{item.cta}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {(item.retention || item.viralScore) && (
                        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3 text-center">
                          {item.retention && (
                            <div className="p-2.5 rounded-xl bg-white border border-gray-100">
                              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Est. Retention</p>
                              <p className="text-[14px] font-bold text-amber-600 mt-0.5">{item.retention}</p>
                            </div>
                          )}
                          {item.viralScore != null && (
                            <div className="p-2.5 rounded-xl bg-white border border-gray-100">
                              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Viral Score</p>
                              <p className="text-[14px] font-bold text-amber-600 mt-0.5">{item.viralScore}%</p>
                            </div>
                          )}
                        </div>
                      )}
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
