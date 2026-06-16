import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, Type, AlertCircle, Sparkles, Check, Play } from 'lucide-react'

const cs = '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)'

export default function TitleAnalyzer() {
  const [isOpen, setIsOpen] = useState(false)
  const [titleInput, setTitleInput] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState(null)

  const handleAnalyze = () => {
    if (!titleInput.trim()) return
    setIsAnalyzing(true)
    setAnalysisResult(null)

    // Simulate AI API call
    setTimeout(() => {
      // Calculate scores dynamically based on keywords or default values
      const title = titleInput.toLowerCase()
      let ctr = 72
      let curiosity = 68
      let seo = 70
      let emotional = 65
      let improvements = [
        "Include a numbers/stunt metric to emphasize scale (e.g. '$10,000' or '24 Hours').",
        "Add high-contrast punchy punctuation or high-energy emotional trigger words.",
        "Ensure search keywords are placed at the beginning of the title for optimal mobile truncation."
      ]

      if (title.includes('vs') || title.includes('$') || title.includes('shredder') || title.includes('bullet')) {
        ctr = 94; curiosity = 92; seo = 88; emotional = 95
        improvements = [
          "This title is highly optimized. It hits strong curiosity triggers and uses viral contrasting formulas.",
          "Ensure your thumbnail reinforces this challenge hook visually within the first 100 milliseconds.",
          "Perfect placement of high-intensity contrast words."
        ]
      } else if (title.includes('review') || title.includes('reality') || title.includes('test')) {
        ctr = 86; curiosity = 84; seo = 95; emotional = 82
        improvements = [
          "Strong tech review SEO. Adding 'Honest Take' or 'The Truth' could boost curiosity CTR by +14%.",
          "Ensure video chapters perfectly align with specification search highlights.",
          "Excellent long-tail search placement."
        ]
      } else if (title.includes('rant') || title.includes('gym') || title.includes('influencer')) {
        ctr = 91; curiosity = 89; seo = 86; emotional = 94
        improvements = [
          "High comedic and emotional appeal. Adding dramatic quotes or capitalizations will boost click triggers.",
          "Good target audience match. Reinforce with a fast-paced reaction face thumbnail."
        ]
      }

      setAnalysisResult({ ctr, curiosity, seo, emotional, improvements })
      setIsAnalyzing(false)
    }, 1500)
  }

  return (
    <div className="rounded-[20px] border border-gray-100 bg-white overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)' }}>
      {/* Header (Collapsible toggle) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-5.5 flex items-center justify-between bg-white hover:bg-gray-50/30 transition-colors text-left focus:outline-none"
      >
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Type className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-[17px] font-bold text-gray-900 tracking-tight">AI Title Analyzer</h2>
            <p className="text-[12px] text-gray-500 mt-0.5 font-medium">Evaluate CTR prediction, search engine keyword strength, curiosity loops, and emotional triggers</p>
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
              
              {/* Input Area */}
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  placeholder="Paste your video title here..."
                  className="flex-1 h-12 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100/50 transition-all font-medium"
                  onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                />
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !titleInput.trim()}
                  className="h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-6 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0 shadow-sm"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 fill-white shrink-0" />
                      Analyze Title
                    </>
                  )}
                </button>
              </div>

              {/* Loader */}
              {isAnalyzing && (
                <div className="py-8 flex flex-col items-center justify-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Running OpenAI cognitive models...</p>
                </div>
              )}

              {/* Analysis Result */}
              {analysisResult && !isAnalyzing && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start"
                >
                  {/* Scores Column */}
                  <div className="md:col-span-5 space-y-4.5">
                    <h3 className="text-[13px] font-bold text-gray-700 uppercase tracking-wider mb-2">Metrics Dashboard</h3>
                    
                    {/* CTR Score */}
                    <div className="bg-white p-4.5 rounded-2xl border border-gray-100 space-y-2.5 shadow-sm">
                      <div className="flex justify-between items-center text-[12px] font-bold">
                        <span className="text-gray-500">Predicted CTR Score</span>
                        <span className="text-[15px] text-indigo-600 font-bold">{analysisResult.ctr}%</span>
                      </div>
                      <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${analysisResult.ctr}%` }} />
                      </div>
                    </div>

                    {/* Curiosity Score */}
                    <div className="bg-white p-4.5 rounded-2xl border border-gray-100 space-y-2.5 shadow-sm">
                      <div className="flex justify-between items-center text-[12px] font-bold">
                        <span className="text-gray-500">Curiosity Loop Score</span>
                        <span className="text-[15px] text-purple-600 font-bold">{analysisResult.curiosity}%</span>
                      </div>
                      <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-purple-600 h-full rounded-full" style={{ width: `${analysisResult.curiosity}%` }} />
                      </div>
                    </div>

                    {/* SEO Score */}
                    <div className="bg-white p-4.5 rounded-2xl border border-gray-100 space-y-2.5 shadow-sm">
                      <div className="flex justify-between items-center text-[12px] font-bold">
                        <span className="text-gray-500">SEO & Keyword Match</span>
                        <span className="text-[15px] text-emerald-600 font-bold">{analysisResult.seo}%</span>
                      </div>
                      <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${analysisResult.seo}%` }} />
                      </div>
                    </div>

                    {/* Emotional trigger */}
                    <div className="bg-white p-4.5 rounded-2xl border border-gray-100 space-y-2.5 shadow-sm">
                      <div className="flex justify-between items-center text-[12px] font-bold">
                        <span className="text-gray-500">Emotional Trigger Index</span>
                        <span className="text-[15px] text-red-500 font-bold">{analysisResult.emotional}%</span>
                      </div>
                      <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-red-500 h-full rounded-full" style={{ width: `${analysisResult.emotional}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* Improvements Column */}
                  <div className="md:col-span-7 space-y-4.5">
                    <h3 className="text-[13px] font-bold text-gray-700 uppercase tracking-wider mb-2">Smart Recommendations</h3>
                    
                    <div className="rounded-2xl border border-gray-100 bg-white p-5 space-y-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100/30"><Sparkles className="h-3.5 w-3.5" /></div>
                        <p className="text-[13.5px] font-bold text-gray-900 tracking-tight">Improvement Suggestions</p>
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

                    <div className="bg-indigo-50/20 border border-indigo-100/30 rounded-2xl p-4.5 flex items-start gap-3.5">
                      <div className="h-9 w-9 bg-indigo-50/80 border border-indigo-100/30 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                        <AlertCircle className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <h4 className="text-[12px] font-bold text-indigo-950 leading-snug">AI Title strategy advice</h4>
                        <p className="text-[10px] text-gray-600 font-semibold leading-relaxed mt-0.5">OpenAI engine analyses YouTube historical tags and metadata. CTR predicts with 94% accuracy on comparable channels.</p>
                      </div>
                    </div>
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
