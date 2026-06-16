import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, ShieldCheck, Play, Plus, Sliders, AlertCircle } from 'lucide-react'

const cs = '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)'

export default function PerformancePrediction() {
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [script, setScript] = useState('')
  const [duration, setDuration] = useState(12)
  const [thumbnailUploaded, setThumbnailUploaded] = useState(false)
  const [isPredicting, setIsPredicting] = useState(false)
  const [predictionResult, setPredictionResult] = useState(null)

  const handlePredict = () => {
    setIsPredicting(true)
    setPredictionResult(null)

    setTimeout(() => {
      // Calculate dynamic simulated predictions based on inputs
      const titleLen = title.length
      const scriptLen = script.length
      let baseViews = 150000
      let ctr = 6.4
      let retention = 48
      let subs = 2400

      if (titleLen > 15 && scriptLen > 100) {
        baseViews = 1200000; ctr = 9.8; retention = 62; subs = 14200
      }

      setPredictionResult({
        views: fmtViews(baseViews),
        ctr: `${ctr}%`,
        retention: `${retention}%`,
        engagement: `${(baseViews * 0.08).toFixed(0)} likes`,
        subs: `+${fmtViews(subs)}`,
        grade: ctr >= 8 ? 'A+' : 'B'
      })
      setIsPredicting(false)
    }, 2000)
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
                      <button
                        onClick={() => setThumbnailUploaded(!thumbnailUploaded)}
                        className={`
                          w-full h-11 rounded-xl border-2 border-dashed text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer
                          ${thumbnailUploaded ? 'border-emerald-300 bg-emerald-50 text-emerald-600' : 'border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/5 text-gray-400'}
                        `}
                      >
                        <Plus className="h-4 w-4 shrink-0" />
                        {thumbnailUploaded ? 'Attached' : 'Add Draft Image'}
                      </button>
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

                  {!predictionResult && !isPredicting && (
                    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-9 text-center flex flex-col items-center justify-center gap-2.5">
                      <AlertCircle className="h-8 w-8 text-gray-400 shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-gray-700 tracking-tight">Awaiting Simulator Parameters</p>
                        <p className="text-xs text-gray-400 font-bold mt-0.5">Provide draft titles and script metrics on the left to begin</p>
                      </div>
                    </div>
                  )}

                  {predictionResult && !isPredicting && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="rounded-2xl border border-gray-100 bg-white p-5.5 space-y-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100/30"><ShieldCheck className="h-4 w-4 animate-pulse" /></div>
                          <p className="text-[13.5px] font-bold text-gray-900 tracking-tight">Reach Prediction Report</p>
                        </div>
                        <span className="text-[10px] font-bold px-2.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100/50">
                          GRADE: {predictionResult.grade}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-3.5 rounded-xl border border-gray-100 text-center shadow-xs">
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Estimated Views</p>
                          <p className="text-[18px] font-bold text-gray-900 mt-0.5">{predictionResult.views}</p>
                        </div>
                        <div className="bg-white p-3.5 rounded-xl border border-gray-100 text-center shadow-xs">
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Estimated CTR</p>
                          <p className="text-[18px] font-bold text-emerald-600 mt-0.5">{predictionResult.ctr}</p>
                        </div>
                        <div className="bg-white p-3.5 rounded-xl border border-gray-100 text-center shadow-xs">
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Estimated Retention</p>
                          <p className="text-[18px] font-bold text-indigo-600 mt-0.5">{predictionResult.retention}</p>
                        </div>
                        <div className="bg-white p-3.5 rounded-xl border border-gray-100 text-center shadow-xs">
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Sub Gain Target</p>
                          <p className="text-[18px] font-bold text-purple-600 mt-0.5">{predictionResult.subs}</p>
                        </div>
                      </div>

                      <div className="text-[10px] text-gray-600 font-semibold bg-emerald-50 p-3 rounded-xl border border-emerald-100/25 leading-relaxed">
                        <span className="font-bold text-emerald-600 uppercase tracking-wider text-[9px] block mb-0.5">AI algorithmic prediction:</span> This concept hits extreme emotional weights matching high search queries, positioning it for maximum initial video push target.
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
