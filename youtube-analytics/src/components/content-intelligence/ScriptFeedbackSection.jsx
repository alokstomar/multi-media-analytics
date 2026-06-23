import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, FileText, Sparkles, Check, Play, AlertTriangle } from 'lucide-react'
import { useAnalytics } from '../../context/AnalyticsContext'
import { analyzeScript } from '../../services/api'
import { LoadingState, ErrorState, isAiUnavailable } from './StateShells'

export default function ScriptFeedbackSection() {
  const [isOpen, setIsOpen] = useState(false)
  const [scriptInput, setScriptInput] = useState('')
  const [status, setStatus] = useState('idle') // 'idle' | 'loading' | 'error' | 'success'
  const [analysisResult, setAnalysisResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const { activeChannelId } = useAnalytics()

  const handleAnalyze = async () => {
    if (!scriptInput.trim()) return
    setStatus('loading')
    setAnalysisResult(null)
    try {
      const res = await analyzeScript({ script: scriptInput, channelId: activeChannelId || undefined })
      const d = res?.data
      if (d && d.viral != null) {
        setAnalysisResult(d)
        setStatus('success')
      } else {
        setErrorMsg('No analysis returned')
        setStatus('error')
      }
    } catch (err) {
      setAnalysisResult(null)
      setErrorMsg(isAiUnavailable(err) ? 'AI service temporarily unavailable' : 'Failed to analyze script')
      setStatus('error')
    }
  }

  return (
    <div className="rounded-[20px] border border-gray-100 bg-white overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-5.5 flex items-center justify-between bg-white hover:bg-gray-50/30 transition-colors text-left focus:outline-none"
      >
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-[17px] font-bold text-gray-900 tracking-tight">AI Script Feedback & Pacing</h2>
            <p className="text-[12px] text-gray-500 mt-0.5 font-medium">Evaluate intro hook speed, pacing retention drop-offs, storytelling quality, and call-to-action positions</p>
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
            <div className="p-6 pt-3 border-t border-gray-50 space-y-6 bg-gray-50">
              <div className="space-y-3.5">
                <textarea
                  rows={6}
                  value={scriptInput}
                  onChange={(e) => setScriptInput(e.target.value)}
                  placeholder="Paste your video script draft here..."
                  className="w-full rounded-2xl border border-gray-200 bg-white p-4.5 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100/50 transition-all font-mono leading-relaxed"
                />
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-gray-400 font-bold">
                    Characters: {scriptInput.length} | Recommended: ~4,000 for 10 min video
                  </span>
                  <button
                    onClick={handleAnalyze}
                    disabled={status === 'loading' || !scriptInput.trim()}
                    className="h-11 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm px-6 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    {status === 'loading' ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Analyzing Script...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 fill-white shrink-0" />
                        Analyze Pacing
                      </>
                    )}
                  </button>
                </div>
              </div>

              {status === 'loading' && <LoadingState label="Analyzing storytelling curves and hook delivery times..." />}
              {status === 'error' && <ErrorState message={errorMsg} onRetry={handleAnalyze} />}

              {status === 'success' && analysisResult && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
                >
                  <div className="lg:col-span-6 space-y-5">
                    <h3 className="text-[13px] font-bold text-gray-700 uppercase tracking-wider mb-2 font-sans">Pacing & Retention</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white p-4.5 rounded-2xl border border-gray-100 shadow-sm">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Viral Potential</p>
                        <p className="text-[22px] font-bold text-violet-600 mt-1">{analysisResult.viral}%</p>
                      </div>
                      <div className="bg-white p-4.5 rounded-2xl border border-gray-100 shadow-sm">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Estimated Retention</p>
                        <p className="text-[22px] font-bold text-blue-600 mt-1">{analysisResult.retention}%</p>
                      </div>
                      <div className="bg-white p-4.5 rounded-2xl border border-gray-100 shadow-sm">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Audience Interest</p>
                        <p className="text-[22px] font-bold text-purple-600 mt-1">{analysisResult.interest}%</p>
                      </div>
                      <div className="bg-white p-4.5 rounded-2xl border border-gray-100 shadow-sm">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Watch Time Forecast</p>
                        <p className="text-[22px] font-bold text-emerald-600 mt-1">{analysisResult.watchTime}m</p>
                      </div>
                    </div>

                    {analysisResult.weakSections?.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-[12.5px] font-bold text-gray-700 tracking-tight">Weak Sections & Dropping Risks</p>
                        {analysisResult.weakSections.map((sec, idx) => (
                          <div key={idx} className="bg-red-50 p-4.5 rounded-2xl border border-red-200/40 space-y-2 text-[11px] shadow-sm">
                            <div className="flex justify-between items-center text-red-600 font-bold">
                              <span className="bg-red-50 px-2 py-0.5 rounded-md border border-red-100">Drop Zone: {sec.time}</span>
                              <span className="flex items-center gap-1.5 uppercase tracking-wide text-[10px]"><AlertTriangle className="h-3.5 w-3.5 shrink-0 animate-bounce" /> High Risk</span>
                            </div>
                            <p className="text-gray-700 font-semibold"><span className="font-bold text-gray-900">Issue:</span> {sec.problem}</p>
                            <p className="text-gray-600 font-medium bg-white p-2.5 rounded-xl border border-gray-100 mt-1"><span className="font-bold text-emerald-600">Action:</span> {sec.fix}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="lg:col-span-6 space-y-5">
                    <h3 className="text-[13px] font-bold text-gray-700 uppercase tracking-wider mb-2 font-sans">OpenAI Rewrite Curations</h3>
                    {analysisResult.rewrites?.length > 0 && (
                      <div className="rounded-2xl border border-gray-100 bg-white p-5 space-y-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-violet-600 border border-violet-100/30"><Sparkles className="h-3.5 w-3.5" /></div>
                          <p className="text-[13.5px] font-bold text-gray-900 tracking-tight">Hook Rewrite Suggestion</p>
                        </div>
                        {analysisResult.rewrites.map((rw, idx) => (
                          <div key={idx} className="space-y-3 text-[11px]">
                            <div className="p-3.5 bg-red-50 border border-red-100/30 rounded-xl">
                              <span className="font-bold text-red-500 uppercase tracking-wider text-[9px]">Original opening:</span>
                              <p className="text-gray-500 mt-1 italic font-semibold">"{rw.original}"</p>
                            </div>
                            <div className="p-3.5 bg-emerald-50 border border-emerald-100/30 rounded-xl">
                              <span className="font-bold text-emerald-600 uppercase tracking-wider text-[9px]">AI Suggested Opening:</span>
                              <p className="text-gray-800 mt-1 font-bold leading-relaxed">"{rw.alternative}"</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {analysisResult.hooks?.length > 0 && (
                      <div className="rounded-2xl border border-gray-100 bg-white p-5 space-y-3.5 shadow-sm">
                        <p className="text-[12.5px] font-bold text-gray-700 tracking-tight">General Hook Delivery Rules</p>
                        {analysisResult.hooks.map((hook, idx) => (
                          <div key={idx} className="flex gap-2.5 items-start text-[11px] text-gray-600 font-medium leading-relaxed">
                            <div className="h-4.5 w-4.5 rounded-full bg-violet-50 text-violet-600 flex items-center justify-center shrink-0 border border-violet-100/50 mt-0.5"><Check className="h-3 w-3" /></div>
                            <p className="leading-relaxed">{hook}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
