import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, ShieldCheck, Play, Plus, Sliders, AlertCircle, AlertTriangle, CheckCircle, Lightbulb } from 'lucide-react'
import { useAnalytics } from '../../context/AnalyticsContext'
import { simulatePerformance } from '../../services/api'
import { ErrorState } from './StateShells'

const cs = '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)'

export default function PerformancePrediction() {
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [script, setScript] = useState('')
  const [duration, setDuration] = useState(12)
  const [thumbnailFile, setThumbnailFile] = useState(null)
  const [isPredicting, setIsPredicting] = useState(false)
  const [predictionResult, setPredictionResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  const { activeChannelId } = useAnalytics()

  const handlePredict = async () => {
    if (!title.trim() || !duration) return
    setIsPredicting(true)
    setPredictionResult(null)
    setErrorMsg('')

    console.log('Performance simulation payload:', {
      title,
      duration,
      scriptLength: script?.length || 0,
      thumbnail: thumbnailFile?.name || null,
      channelId: activeChannelId || null
    })

    const formData = new FormData()
    formData.append('title', title)
    formData.append('duration', duration)
    if (script) formData.append('script', script)
    if (thumbnailFile) formData.append('thumbnail', thumbnailFile)
    if (activeChannelId) formData.append('channelId', activeChannelId)

    try {
      const res = await simulatePerformance(formData)
      console.log('Performance simulation response:', res)
      const d = res?.data
      if (d && d.recommendationScore != null) {
        setPredictionResult(d)
      } else {
        setErrorMsg('Invalid response format received from simulation endpoint.')
      }
    } catch (err) {
      console.error('Performance simulation error:', err)
      const message =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message
      setErrorMsg(message)
    } finally {
      setIsPredicting(false)
    }
  }

  function fmtViews(n) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
    return String(n)
  }

  return (
    <div className="rounded-[20px] border border-gray-100 bg-white overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)' }}>
      {/* Header (Collapsible toggle) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-5.5 flex items-center justify-between bg-white hover:bg-gray-50/30 transition-colors text-left focus:outline-none"
      >
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-[17px] font-bold text-gray-900 tracking-tight">AI Pre-Upload Performance Predictor</h2>
            <p className="text-[12px] text-gray-500 mt-0.5 font-medium">Simulate actual algorithmic recommendation metrics before hitting publish on YouTube</p>
          </div>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gray-50 text-gray-400 border border-gray-100 hover:text-gray-600 transition-colors">
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {/* Content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="p-6 pt-3 border-t border-gray-50 space-y-6 bg-gray-50">
              
              {/* Parameter Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Inputs Column */}
                <div className="md:col-span-6 space-y-4.5">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Draft Video Title</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Paste final video title..."
                      className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100/50 transition-all font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5 font-sans flex justify-between">
                      <span>Video Duration</span>
                      <span className="text-emerald-600 font-bold">{duration} mins</span>
                    </label>
                    <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-gray-100 shadow-xs">
                      <Sliders className="h-4 w-4 text-gray-400 shrink-0" />
                      <input
                        type="range"
                        min={1}
                        max={60}
                        value={duration}
                        onChange={(e) => setDuration(parseInt(e.target.value))}
                        className="w-full accent-emerald-600 h-1.5 bg-gray-100 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Thumbnail Upload</label>
                      <label
                        className={`
                          w-full h-11 rounded-xl border-2 border-dashed text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer
                          ${thumbnailFile ? 'border-emerald-300 bg-emerald-50 text-emerald-600' : 'border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/5 text-gray-400'}
                        `}
                      >
                        <Plus className="h-4 w-4 shrink-0" />
                        {thumbnailFile ? (thumbnailFile.name.length > 15 ? `${thumbnailFile.name.slice(0, 12)}...` : thumbnailFile.name) : 'Add Draft Image'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
                          className="hidden"
                        />
                      </label>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Draft Script File</label>
                      <input
                        type="text"
                        value={script}
                        onChange={(e) => setScript(e.target.value)}
                        placeholder="Paste script opening..."
                        className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-xs text-gray-800 placeholder:text-gray-300 focus:outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100/50 transition-all font-medium"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handlePredict}
                    disabled={isPredicting || !title.trim()}
                    className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    {isPredicting ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Running Algorithmic Simulation...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4 shrink-0" />
                        Simulate Algorithmic Reach
                      </>
                    )}
                  </button>
                </div>

                {/* Dashboard Results Column */}
                <div className="md:col-span-6 flex flex-col justify-center">
                  
                  {isPredicting && (
                    <div className="py-12 flex flex-col items-center justify-center gap-3">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-600" />
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Matching upload tags against real-time database vectors...</p>
                    </div>
                  )}

                  {!predictionResult && !isPredicting && !errorMsg && (
                    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-9 text-center flex flex-col items-center justify-center gap-2.5">
                      <AlertCircle className="h-8 w-8 text-gray-400 shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-gray-700 tracking-tight">Awaiting Simulator Parameters</p>
                        <p className="text-xs text-gray-400 font-bold mt-0.5">Provide draft titles and script metrics on the left to begin</p>
                      </div>
                    </div>
                  )}

                  {errorMsg && !isPredicting && (
                    <ErrorState message={errorMsg} onRetry={handlePredict} />
                  )}

                  {predictionResult && !isPredicting && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="rounded-2xl border border-gray-100 bg-white p-5.5 space-y-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100/30">
                            <ShieldCheck className="h-4 w-4 animate-pulse" />
                          </div>
                          <p className="text-[13.5px] font-bold text-gray-900 tracking-tight">Reach Prediction Report</p>
                        </div>
                        <span className="text-[10px] font-bold px-2.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100/50">
                          SCORE: {predictionResult.recommendationScore}/100
                        </span>
                      </div>

                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                        <div className="bg-white p-3.5 rounded-xl border border-gray-100 text-center shadow-xs">
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Estimated Reach</p>
                          <p className="text-[15px] font-bold text-gray-900 mt-0.5">{predictionResult.estimatedViews}</p>
                        </div>
                        <div className="bg-white p-3.5 rounded-xl border border-gray-100 text-center shadow-xs">
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Viral Probability</p>
                          <p className="text-[15px] font-bold text-emerald-600 mt-0.5">{predictionResult.viralProbability}%</p>
                        </div>
                        <div className="bg-white p-3.5 rounded-xl border border-gray-100 text-center shadow-xs">
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Predicted CTR</p>
                          <p className="text-[15px] font-bold text-indigo-600 mt-0.5">{predictionResult.predictedCTR}%</p>
                        </div>
                        <div className="bg-white p-3.5 rounded-xl border border-gray-100 text-center shadow-xs col-span-2 lg:col-span-3">
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Predicted Retention</p>
                          <p className="text-[15px] font-bold text-purple-600 mt-0.5">{predictionResult.predictedRetention}%</p>
                        </div>
                      </div>

                      {/* Strengths & Weaknesses Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                        {predictionResult.strengths?.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[10.5px] font-bold text-gray-700 tracking-tight flex items-center gap-1">
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> Strengths
                            </p>
                            <ul className="space-y-1.5">
                              {predictionResult.strengths.map((str, i) => (
                                <li key={i} className="text-[10px] text-gray-600 bg-gray-50 border border-gray-100 p-2 rounded-lg font-medium leading-relaxed">
                                  {str}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {predictionResult.weaknesses?.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[10.5px] font-bold text-gray-700 tracking-tight flex items-center gap-1">
                              <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" /> Weaknesses
                            </p>
                            <ul className="space-y-1.5">
                              {predictionResult.weaknesses.map((weak, i) => (
                                <li key={i} className="text-[10px] text-gray-600 bg-gray-50 border border-gray-100 p-2 rounded-lg font-medium leading-relaxed">
                                  {weak}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Suggestions & Risk Warnings */}
                      <div className="space-y-3 pt-2">
                        {predictionResult.optimizationSuggestions?.length > 0 && (
                          <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-100/30 space-y-2">
                            <span className="font-bold text-emerald-700 uppercase tracking-wider text-[9px] flex items-center gap-1">
                              <Lightbulb className="h-3.5 w-3.5" /> Optimization Suggestions
                            </span>
                            <ul className="space-y-1.5 text-[10px] text-gray-700 list-disc list-inside font-medium leading-relaxed">
                              {predictionResult.optimizationSuggestions.map((sug, i) => (
                                <li key={i}>{sug}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {predictionResult.riskWarnings?.length > 0 && (
                          <div className="bg-red-50/50 p-3.5 rounded-xl border border-red-100/30 space-y-2">
                            <span className="font-bold text-red-700 uppercase tracking-wider text-[9px] flex items-center gap-1">
                              <AlertCircle className="h-3.5 w-3.5 text-red-500" /> Algorithmic Risk Warnings
                            </span>
                            <ul className="space-y-1.5 text-[10px] text-gray-700 list-disc list-inside font-medium leading-relaxed">
                              {predictionResult.riskWarnings.map((risk, i) => (
                                <li key={i} className="text-red-900/90">{risk}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                </div>

              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
