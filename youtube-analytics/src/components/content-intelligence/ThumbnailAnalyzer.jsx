import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, Image, Sparkles, Check, Play, UploadCloud } from 'lucide-react'
import { useAnalytics } from '../../context/AnalyticsContext'
import { analyzeThumbnail } from '../../services/api'
import { LoadingState, ErrorState } from './StateShells'

export default function ThumbnailAnalyzer() {
  const [isOpen, setIsOpen] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [thumbnailFile, setThumbnailFile] = useState(null)
  const [status, setStatus] = useState('idle') // 'idle' | 'loading' | 'error' | 'success'
  const [analysisResult, setAnalysisResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const { activeChannelId } = useAnalytics()

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      setThumbnailFile(file)
      runAnalysis(file)
    }
  }

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setThumbnailFile(file)
      runAnalysis(file)
    }
  }

  const runAnalysis = useCallback(async (file) => {
    setStatus('loading')
    setAnalysisResult(null)
    setErrorMsg('')
    try {
      console.log('[ThumbnailAnalyzer] Starting analysis for file:', {
        name: file.name,
        size: file.size,
        type: file.type,
        channelId: activeChannelId
      })

      const formData = new FormData()
      formData.append('thumbnail', file)
      if (activeChannelId) {
        formData.append('channelId', activeChannelId)
      }

      console.log('[ThumbnailAnalyzer] Dispatching upload to analyzeThumbnail...')
      const res = await analyzeThumbnail(formData)
      console.log('[ThumbnailAnalyzer] Response received:', res)

      const d = res?.data
      if (d && d.ctr != null) {
        setAnalysisResult(d)
        setStatus('success')
      } else {
        setErrorMsg('No analysis returned')
        setStatus('error')
      }
    } catch (err) {
      console.error('[ThumbnailAnalyzer] Error during analysis:', err)
      setAnalysisResult(null)
      
      // Parse structured error or string error from backend
      const backendError = err.response?.data?.error?.message || err.response?.data?.message || err.response?.data?.error || err.message
      setErrorMsg(backendError || 'Failed to analyze thumbnail')
      setStatus('error')
    }
  }, [activeChannelId])

  return (
    <div className="rounded-[20px] border border-gray-100 bg-white overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-5.5 flex items-center justify-between bg-white hover:bg-gray-50/30 transition-colors text-left focus:outline-none"
      >
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <Image className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-[17px] font-bold text-gray-900 tracking-tight">AI Thumbnail Vision Analyzer</h2>
            <p className="text-[12px] text-gray-500 mt-0.5 font-medium">Evaluate visual CTR probability, color contrast balance, emotional face visibility, and visual clutter</p>
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
              {!thumbnailFile && status !== 'loading' && (
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`relative rounded-2xl border-2 border-dashed p-9 text-center transition-all duration-300 cursor-pointer
                    ${dragActive ? 'border-rose-400 bg-rose-50/30 shadow-[0_0_24px_rgba(244,63,94,0.05)]' : 'border-gray-200 hover:border-rose-300 hover:bg-rose-50/10'}`}
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center gap-3.5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white border border-gray-100 text-gray-400 shadow-sm hover:scale-105 transition-transform duration-200">
                      <UploadCloud className="h-6 w-6 text-rose-500" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-gray-800 tracking-tight">Drag & drop your thumbnail image here</p>
                      <p className="text-xs text-gray-400 font-bold">Supports PNG, JPG, JPEG (Max 4MB)</p>
                    </div>
                    <button className="mt-1 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100/60 border border-rose-100/50 rounded-xl px-4.5 py-2 transition-all duration-200 shadow-sm">
                      Browse Files
                    </button>
                  </div>
                </div>
              )}

              {status === 'loading' && <LoadingState label="Running OpenAI vision model scans..." />}
              {status === 'error' && <ErrorState message={errorMsg} onRetry={() => thumbnailFile && runAnalysis(thumbnailFile)} />}

              {thumbnailFile && status !== 'loading' && (
                <div className="flex items-center justify-between bg-white p-3.5 px-4.5 rounded-xl border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 bg-rose-50 text-rose-600 rounded-lg flex items-center justify-center border border-rose-100 shrink-0">
                      <Image className="h-4 w-4" />
                    </div>
                    <span className="text-[12px] font-bold text-gray-700 truncate max-w-xs">{thumbnailFile.name}</span>
                  </div>
                  <button
                    onClick={() => { setThumbnailFile(null); setAnalysisResult(null); setStatus('idle') }}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-700 cursor-pointer"
                  >
                    Remove File
                  </button>
                </div>
              )}

              {status === 'success' && analysisResult && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start"
                >
                  <div className="md:col-span-5 space-y-4.5">
                    <h3 className="text-[13px] font-bold text-gray-700 uppercase tracking-wider mb-2">Vision Dashboard</h3>

                    {[
                      { label: 'Predicted Thumbnail CTR', value: analysisResult.ctr, color: 'rose-500', text: 'rose-600' },
                      { label: 'Attention Focus Score', value: analysisResult.attention, color: 'amber-500', text: 'amber-600' },
                      { label: 'Color Contrast Balance', value: analysisResult.contrast, color: 'indigo-600', text: 'indigo-600' },
                    ].map((m) => (
                      <div key={m.label} className="bg-white p-4.5 rounded-2xl border border-gray-100 space-y-2.5 shadow-sm">
                        <div className="flex justify-between items-center text-[12px] font-bold">
                          <span className="text-gray-500">{m.label}</span>
                          <span className={`text-[15px] text-${m.text} font-bold`}>{m.value}%</span>
                        </div>
                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                          <div className={`bg-${m.color} h-full rounded-full`} style={{ width: `${m.value}%` }} />
                        </div>
                      </div>
                    ))}

                    {analysisResult.clutter != null && (
                      <div className="bg-white p-4.5 rounded-2xl border border-gray-100 space-y-2.5 shadow-sm">
                        <div className="flex justify-between items-center text-[12px] font-bold">
                          <span className="text-gray-500">Visual Clutter Index</span>
                          <span className="text-[13px] text-gray-700 font-bold">{analysisResult.clutter}% (Optimal)</span>
                        </div>
                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                          <div className="bg-gray-400 h-full rounded-full" style={{ width: `${analysisResult.clutter}%` }} />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-7 space-y-4.5">
                    <h3 className="text-[13px] font-bold text-gray-700 uppercase tracking-wider mb-2">Vision Insights</h3>

                    {analysisResult.improvements?.length > 0 && (
                      <div className="rounded-2xl border border-gray-100 bg-white p-5 space-y-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600 border border-rose-100/30"><Sparkles className="h-3.5 w-3.5" /></div>
                          <p className="text-[13.5px] font-bold text-gray-900 tracking-tight">Vision Analysis Feedback</p>
                        </div>
                        <div className="space-y-3">
                          {analysisResult.improvements.map((imp, idx) => (
                            <div key={idx} className="flex gap-3 items-start text-[11px] text-gray-600 font-medium">
                              <div className="h-4.5 w-4.5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100/50 mt-0.5"><Check className="h-3 w-3" /></div>
                              <p className="leading-relaxed">{imp}</p>
                            </div>
                          ))}
                        </div>
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
