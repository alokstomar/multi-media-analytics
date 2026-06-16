import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock,
  Sparkles,
  CheckCircle,
  HelpCircle,
  TrendingUp,
  Award,
  AlertCircle,
  Calendar,
  Zap,
  Activity,
  ThumbsUp,
  MessageCircle,
  Share2,
  RefreshCw
} from 'lucide-react'
import { aiAnalyzeTweet, getTwitterBestTimes } from '../services/api'

const TwitterIcon = (props) => (
  <svg
    className={props.className || "h-4 w-4"}
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M4 4l11.73 16h4.27L8.27 4H4z" />
    <path d="M18 4l-6.25 6.25m-2.5 2.5L4 20" />
  </svg>
)

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = ['8 AM', '10 AM', '12 PM', '2 PM', '4 PM', '6 PM', '8 PM', '10 PM']

// Default fallbacks in case API load fails
const DEFAULT_HEATMAP = {
  Mon: [40, 55, 75, 60, 65, 88, 70, 45],
  Tue: [45, 60, 80, 65, 70, 92, 75, 50],
  Wed: [50, 65, 85, 70, 75, 95, 80, 55],
  Thu: [48, 62, 82, 68, 72, 94, 78, 52],
  Fri: [42, 58, 78, 62, 85, 90, 82, 60],
  Sat: [30, 40, 50, 55, 60, 72, 85, 65],
  Sun: [35, 45, 55, 60, 65, 80, 90, 70]
}

const DEFAULT_WINDOWS = [
  { day: 'Wednesdays', time: '6:00 PM', score: 95, competition: 'Low', reason: 'High professional mid-week activity overlap.' },
  { day: 'Tuesdays', time: '6:00 PM', score: 92, competition: 'Medium', reason: 'Highest click-through rates for case studies.' },
  { day: 'Thursdays', time: '6:00 PM', score: 94, competition: 'Low', reason: 'Optimal bookmarking and sharing volume peaks.' }
]

export default function BestPostingTimes() {
  const [activeView, setActiveView] = useState('weekly') // daily vs weekly heatmap view
  const [successToast, setSuccessToast] = useState('')
  const [tweetText, setTweetText] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState(null)
  
  const [heatmapData, setHeatmapData] = useState(DEFAULT_HEATMAP)
  const [bestWindows, setBestWindows] = useState(DEFAULT_WINDOWS)
  const [loading, setLoading] = useState(false)

  const showToast = (msg) => {
    setSuccessToast(msg)
    setTimeout(() => setSuccessToast(''), 3000)
  }

  const loadBestTimes = async () => {
    setLoading(true)
    try {
      const res = await getTwitterBestTimes()
      if (res?.success && res.data) {
        setHeatmapData(res.data.heatmap || DEFAULT_HEATMAP)
        setBestWindows(res.data.bestWindows || DEFAULT_WINDOWS)
      }
    } catch (err) {
      console.error('Failed to load Twitter best times:', err)
      showToast('Error loading insights. Using local fallbacks.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBestTimes()
  }, [])

  // Handle Predictor Analysis
  const handleAnalyzeDraft = async (e) => {
    e.preventDefault()
    if (!tweetText.trim()) return
    setAnalyzing(true)

    try {
      const res = await aiAnalyzeTweet({ text: tweetText })
      if (res.success && res.data) {
        setAnalysisResult(res.data)
        showToast('Draft optimized successfully!')
      } else {
        showToast('Failed to analyze draft.')
      }
    } catch (err) {
      console.error(err)
      showToast('Error connecting to performance predictor.')
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/50 space-y-6 pb-12">
      {/* Toast */}
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 right-6 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg text-xs font-bold"
          >
            <CheckCircle className="w-4 h-4" />
            {successToast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-black text-white">
              <TwitterIcon className="h-4 w-4" fill="currentColor" />
            </span>
            X Growth Insights & Optimizers
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Reveal peak audience resonance hours and preemptively grade drafts utilizing high-fidelity semantic score cards.
          </p>
        </div>

        <div className="flex border border-gray-100 rounded-xl p-0.5 bg-white shadow-xs">
          {['weekly', 'daily'].map(v => (
            <button
              key={v}
              onClick={() => setActiveView(v)}
              className={`px-4 h-8 rounded-lg text-xs font-bold transition capitalize cursor-pointer ${
                activeView === v ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {v} View
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* LEFT COLUMN: HEATMAP & PEAK RECOMMENDATIONS (2 columns wide) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Heatmap Card */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Engagement Potential Heatmap
              </h3>
              <div className="flex items-center gap-4 text-[10px] font-bold text-gray-400">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-blue-50 border border-blue-100 rounded" /> Low</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-blue-300 rounded" /> Medium</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-blue-600 rounded" /> Peak</span>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-16">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : activeView === 'weekly' ? (
              /* Weekly grid */
              <div className="overflow-x-auto">
                <div className="min-w-[600px] space-y-2.5">
                  {/* Hours Header */}
                  <div className="flex items-center gap-2 pl-12 text-[10px] font-bold text-gray-400 select-none">
                    {HOURS.map(h => <div key={h} className="flex-1 text-center">{h}</div>)}
                  </div>

                  {/* Days Matrix */}
                  <div className="space-y-2">
                    {DAYS.map(day => (
                      <div key={day} className="flex items-center gap-2">
                        {/* Day Column */}
                        <div className="w-10 text-[10px] font-bold text-gray-500 uppercase">{day}</div>
                        {/* Hour Blocks */}
                        {heatmapData[day]?.map((val, idx) => {
                          // Resolve color class based on value
                          let bgClass = 'bg-blue-50/50 hover:bg-blue-100/50 text-blue-800'
                          if (val > 85) bgClass = 'bg-blue-600 text-white hover:bg-blue-700'
                          else if (val > 65) bgClass = 'bg-blue-400 text-white hover:bg-blue-500'
                          else if (val > 45) bgClass = 'bg-blue-200 text-blue-900 hover:bg-blue-300'

                          return (
                            <div
                              key={idx}
                              className={`flex-1 h-9 rounded-lg flex items-center justify-center text-[10px] font-bold transition duration-150 cursor-pointer ${bgClass}`}
                              title={`${day} @ ${HOURS[idx]}: ${val}% potential`}
                            >
                              {val}%
                            </div>
                          )
                        }) || null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Daily list view showcasing Wednesday */
              <div className="space-y-3.5">
                <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl">
                  <p className="text-[10px] font-bold text-gray-500 uppercase">Selected Day: Wednesday (Peak Day)</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {HOURS.map((h, idx) => {
                    const val = heatmapData.Wed?.[idx] || 50
                    let bg = 'border-gray-100 text-gray-800'
                    if (val > 85) bg = 'border-blue-200 bg-blue-50 text-blue-800 shadow-sm'
                    return (
                      <div key={h} className={`border p-4 rounded-xl flex flex-col justify-between h-20 ${bg}`}>
                        <span className="text-[10px] font-bold text-gray-400 uppercase">{h}</span>
                        <div className="flex items-baseline justify-between mt-1">
                          <span className="text-xl font-bold">{val}%</span>
                          <span className="text-[9px] font-semibold text-gray-400">resonance</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Recommendations Card */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5" />
              Peak Resonance Windows
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {bestWindows.map((win, idx) => (
                <div key={idx} className="p-4 rounded-2xl border border-gray-100 space-y-3 relative overflow-hidden bg-gray-50/50">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                      {win.day}
                    </span>
                    <span className="text-[10px] font-bold text-indigo-600 flex items-center gap-0.5">
                      <Zap className="w-3 h-3 text-indigo-500 fill-current" /> {win.score} pts
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-900">Publish at {win.time}</h4>
                    <p className="text-[10px] text-gray-400 font-medium mt-0.5">Competition index: {win.competition}</p>
                  </div>
                  <p className="text-[10px] leading-relaxed text-gray-500 border-t border-gray-100 pt-2.5 font-medium">
                    {win.reason}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: AI COPY OPTIMIZER / DRAFT GRADOR (1 column wide) */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            AI Draft Optimizer
          </h3>

          <form onSubmit={handleAnalyzeDraft} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block pl-1">Draft Content</label>
              <textarea
                rows={5}
                required
                placeholder="Paste your draft tweet or thread here to analyze performance vector..."
                value={tweetText}
                onChange={(e) => setTweetText(e.target.value)}
                className="w-full p-3.5 rounded-xl border border-gray-100 text-xs font-semibold text-gray-700 bg-gray-50/50 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/25 transition resize-none leading-relaxed"
              />
            </div>

            <button
              type="submit"
              disabled={analyzing}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm shadow-blue-500/10 flex items-center justify-center gap-1.5"
            >
              {analyzing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Analyzing Copy Structure...
                </>
              ) : (
                <>
                  <Activity className="w-3.5 h-3.5" />
                  Evaluate & Grade Draft
                </>
              )}
            </button>
          </form>

          {/* Analysis Results Display */}
          <AnimatePresence>
            {analysisResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="border border-gray-100 rounded-2xl p-5 space-y-4 bg-gray-50/30"
              >
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <span className="text-xs font-bold text-gray-800">Grade Analysis</span>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                    {analysisResult.score}% Resonance
                  </span>
                </div>

                <div className="space-y-3.5 text-[10px] leading-relaxed text-gray-600 font-medium">
                  {/* Hook metrics */}
                  <div className="flex items-start gap-2">
                    <ThumbsUp className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-gray-900 font-bold block">Hook Quality:</strong>
                      {analysisResult.feedback?.hook || 'Strong curiosity gap.'}
                    </div>
                  </div>

                  {/* Body metrics */}
                  <div className="flex items-start gap-2">
                    <MessageCircle className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-gray-900 font-bold block">Body Readability:</strong>
                      {analysisResult.feedback?.body || 'Good whitespace structure.'}
                    </div>
                  </div>

                  {/* Suggestion */}
                  <div className="flex items-start gap-2">
                    <Share2 className="w-3.5 h-3.5 text-violet-500 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-gray-900 font-bold block">CTA Actionability:</strong>
                      {analysisResult.feedback?.cta || 'Needs clearer lead magnet trigger.'}
                    </div>
                  </div>
                </div>

                {/* Recommendations */}
                <div className="border-t border-gray-100 pt-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800 pl-0.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                    Recommended Slots Today
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-gray-600">
                    <div className="p-2.5 bg-white border border-gray-100 rounded-xl text-center">
                      4:00 PM (High)
                    </div>
                    <div className="p-2.5 bg-white border border-gray-100 rounded-xl text-center">
                      8:30 PM (Peak)
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
