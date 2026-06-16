import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Sliders,
  Send,
  Save,
  Clock,
  Layers,
  Copy,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle,
  HelpCircle,
  ChevronRight
} from 'lucide-react'

import { useNavigate } from 'react-router-dom'
import { aiGenerateTweet, aiGenerateThread, createStudioPost } from '../services/api'


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

const STORAGE_KEY = 'tw_drafts'

const TONES = ['Professional', 'Educational', 'Viral', 'Personal', 'Storytelling', 'Humorous']
const GOALS = ['Engagement', 'Followers', 'Leads', 'Brand Awareness', 'Traffic']

export default function AITweetWriter() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('Tweet') // Tweet or Thread
  const [successToast, setSuccessToast] = useState('')

  // Tweet Inputs
  const [topic, setTopic] = useState('')
  const [audience, setAudience] = useState('')
  const [tone, setTone] = useState('Viral')
  const [goal, setGoal] = useState('Engagement')
  const [loading, setLoading] = useState(false)

  // Tweet Output State
  const [generatedTweet, setGeneratedTweet] = useState('')
  const [variants, setVariants] = useState([])
  const [hooks, setHooks] = useState([])
  const [ctas, setCtas] = useState([])
  const [hashtags, setHashtags] = useState([])

  // Thread Inputs
  const [threadTopic, setThreadTopic] = useState('')
  const [threadCount, setThreadCount] = useState(3)
  const [threadStyle, setThreadStyle] = useState('Storytelling')
  const [threadLoading, setThreadLoading] = useState(false)

  // Thread Output State
  const [generatedThread, setGeneratedThread] = useState([])
  const [ctaTweet, setCtaTweet] = useState('')
  const [threadSummary, setThreadSummary] = useState('')

  const showToast = (msg) => {
    setSuccessToast(msg)
    setTimeout(() => setSuccessToast(''), 3000)
  }

  // Generate Tweet Action
  const handleGenerateTweet = async (e) => {
    e.preventDefault()
    if (!topic.trim()) return
    setLoading(true)
    
    try {
      const res = await aiGenerateTweet({ topic, audience, tone, goal })
      if (res.success && res.data) {
        const { tweet, variants, hooks, ctas, hashtags } = res.data
        setGeneratedTweet(tweet)
        setVariants(variants || [])
        setHooks(hooks || [])
        setCtas(ctas || [])
        setHashtags(hashtags || [])
        showToast('AI Tweet generated successfully!')
      } else {
        showToast('Failed to generate tweet.')
      }
    } catch (err) {
      console.error(err)
      showToast('Error connecting to AI Provider.')
    } finally {
      setLoading(false)
    }
  }

  // Generate Thread Action
  const handleGenerateThread = async (e) => {
    e.preventDefault()
    if (!threadTopic.trim()) return
    setThreadLoading(true)

    try {
      const res = await aiGenerateThread({ topic: threadTopic, count: threadCount, style: threadStyle })
      if (res.success && res.data) {
        const { thread, cta, summary } = res.data
        const mappedList = thread.map((tText, idx) => ({
          id: 'th_' + (idx + 1),
          text: tText
        }))
        setGeneratedThread(mappedList)
        setCtaTweet(cta)
        setThreadSummary(summary)
        showToast('AI Thread generated successfully!')
      } else {
        showToast('Failed to generate thread.')
      }
    } catch (err) {
      console.error(err)
      showToast('Error connecting to AI Provider.')
    } finally {
      setThreadLoading(false)
    }
  }


  // Edit / Regenerate Individual Thread Node
  const handleRegenerateNode = (id, idx) => {
    const list = [...generatedThread]
    list[idx] = {
      id,
      text: `${idx + 1}/ REGENERATED node detailing advanced ${threadTopic} frameworks. Save 10+ hours a week starting now!`
    }
    setGeneratedThread(list)
    showToast(`Regenerated Tweet ${idx + 1}!`)
  }

  // Save Tweet/Thread Draft
  const handleSaveDraft = async () => {
    const isThread = activeTab === 'Thread'
    const contentToSave = isThread
      ? (generatedThread[0]?.text || '')
      : generatedTweet
    
    if (!contentToSave) return

    try {
      const payload = {
        platform: 'twitter',
        type: isThread ? 'thread' : 'tweet',
        status: 'draft',
        content: {
          fullText: contentToSave,
          thread: isThread ? generatedThread.map(t => t.text) : []
        }
      }
      
      const res = await createStudioPost(payload)
      if (res?.success) {
        showToast('AI generation saved to drafts!')
        setTimeout(() => navigate('/drafts'), 800)
      } else {
        showToast('Failed to save draft.')
      }
    } catch (err) {
      console.error(err)
      showToast('Error saving draft to backend database.')
    }
  }

  // Copy trigger
  const handleCopy = (text) => {
    navigator.clipboard.writeText(text)
    showToast('Copied to clipboard!')
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
            X AI Growth Writer
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Formulate high-performance, hook-optimized tweets or storytelling threads utilizing fine-tuned copy blueprints.
          </p>
        </div>

        <div className="flex border border-gray-100 rounded-xl p-0.5 bg-white shadow-xs">
          {['Tweet', 'Thread'].map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-3.5 h-8 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === t ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              AI {t} Generator
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'Tweet' ? (
        /* AI TWEET WRITER INTERFACE */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Left panel: Generation Parameters */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" />
              Generation Parameters
            </h3>

            <form onSubmit={handleGenerateTweet} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block pl-1">Core Topic</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SaaS growth automation hacks"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-gray-100 text-xs font-semibold text-gray-700 bg-gray-50/50 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/25 transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block pl-1">Target Audience</label>
                <input
                  type="text"
                  placeholder="e.g. Indie Hackers, Solopreneurs"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-gray-100 text-xs font-semibold text-gray-700 bg-gray-50/50 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/25 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block pl-1">Tone Option</label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-gray-100 text-xs font-semibold text-gray-700 bg-gray-50/50 outline-none focus:border-blue-400 transition cursor-pointer"
                  >
                    {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block pl-1">Primary Goal</label>
                  <select
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-gray-100 text-xs font-semibold text-gray-700 bg-gray-50/50 outline-none focus:border-blue-400 transition cursor-pointer"
                  >
                    {GOALS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm shadow-blue-500/10 flex items-center justify-center gap-1.5"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Generating Copy...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Compose AI Tweet
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right Panels: Outputs Grid (2 columns) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Main Generated Tweet Card */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-gray-50 pb-3">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1">Primary Generated Tweet</h3>
                {generatedTweet && (
                  <div className="flex gap-2">
                    <button onClick={() => handleCopy(generatedTweet)} className="flex h-7 px-2.5 items-center gap-1 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg text-[10px] font-bold transition cursor-pointer">
                      <Copy className="w-3 h-3" /> Copy
                    </button>
                    <button onClick={handleSaveDraft} className="flex h-7 px-2.5 items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-[10px] font-bold transition cursor-pointer">
                      <Save className="w-3 h-3" /> Save Draft
                    </button>
                  </div>
                )}
              </div>

              {generatedTweet ? (
                <div className="p-4 bg-gray-50/50 border border-gray-100 rounded-xl">
                  <p className="text-sm font-semibold text-gray-800 leading-relaxed whitespace-pre-wrap">{generatedTweet}</p>
                </div>
              ) : (
                <div className="py-12 text-center text-gray-400 space-y-2 border border-dashed border-gray-100 rounded-xl">
                  <Sparkles className="w-8 h-8 mx-auto text-gray-300 animate-pulse" />
                  <p className="text-xs font-semibold text-gray-800">Your AI Copy Will Appear Here</p>
                  <p className="text-[10px] text-gray-400">Configure parameters on the left and trigger generation.</p>
                </div>
              )}
            </div>

            {/* AI Alternative Variants & Hooks/Hashtags */}
            {generatedTweet && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Alternative Variants */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1">Alternative Variants</h4>
                  <div className="space-y-3">
                    {variants.map((v, i) => (
                      <div key={i} className="p-3 bg-gray-50/70 border border-gray-50 rounded-xl space-y-2">
                        <p className="text-xs font-medium text-gray-700 leading-relaxed">"{v}"</p>
                        <button
                          onClick={() => setGeneratedTweet(v)}
                          className="text-[9px] font-bold text-blue-600 hover:underline cursor-pointer flex items-center gap-0.5"
                        >
                          Use this variant <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Hooks, CTAs, and Hashtags */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1">Optimization Hooks & CTAs</h4>
                  
                  <div className="space-y-3.5">
                    <div>
                      <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest pl-1">Hook Variations</span>
                      <div className="space-y-1.5 mt-1">
                        {hooks.map((hk, i) => (
                          <p key={i} onClick={() => handleCopy(hk)} className="text-[10px] font-semibold text-gray-700 hover:bg-gray-50 p-1.5 border border-gray-50 rounded-lg cursor-pointer transition">
                            🪝 "{hk}"
                          </p>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest pl-1">CTA Suggestions</span>
                      <div className="space-y-1.5 mt-1">
                        {ctas.map((ct, i) => (
                          <p key={i} onClick={() => handleCopy(ct)} className="text-[10px] font-semibold text-gray-700 hover:bg-gray-50 p-1.5 border border-gray-50 rounded-lg cursor-pointer transition">
                            📣 "{ct}"
                          </p>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest pl-1">Generated Hashtags</span>
                      <div className="flex flex-wrap gap-1.5 mt-1.5 pl-0.5">
                        {hashtags.map(tag => (
                          <span key={tag} className="text-[9px] font-bold text-blue-600 bg-blue-50/50 border border-blue-100/50 px-2 py-0.5 rounded-md">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}

          </div>
        </div>
      ) : (
        /* AI THREAD GENERATOR INTERFACE */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Left panel: Thread configuration */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" />
              Thread Parameters
            </h3>

            <form onSubmit={handleGenerateThread} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block pl-1">Thread Core Concept</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 5 rules of compounding organic impressions"
                  value={threadTopic}
                  onChange={(e) => setThreadTopic(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-gray-100 text-xs font-semibold text-gray-700 bg-gray-50/50 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/25 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block pl-1">Tweet Count</label>
                  <select
                    value={threadCount}
                    onChange={(e) => setThreadCount(parseInt(e.target.value))}
                    className="w-full h-11 px-3.5 rounded-xl border border-gray-100 text-xs font-semibold text-gray-700 bg-gray-50/50 outline-none focus:border-blue-400 transition cursor-pointer"
                  >
                    {[3, 4, 5, 6, 7].map(num => <option key={num} value={num}>{num} Nodes</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block pl-1">Storytelling Style</label>
                  <select
                    value={threadStyle}
                    onChange={(e) => setThreadStyle(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-gray-100 text-xs font-semibold text-gray-700 bg-gray-50/50 outline-none focus:border-blue-400 transition cursor-pointer"
                  >
                    <option value="Storytelling">Storytelling</option>
                    <option value="Case Study">Case Study</option>
                    <option value="Actionable List">Actionable List</option>
                    <option value="Debate Blueprint">Debate Blueprint</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={threadLoading}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm shadow-blue-500/10 flex items-center justify-center gap-1.5"
              >
                {threadLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Compiling Thread Nodes...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Compose AI Thread
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right Columns: Thread Breakdown output (2 columns) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-gray-50 pb-3">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1">Generated Thread Breakdown</h3>
                {generatedThread.length > 0 && (
                  <button onClick={handleSaveDraft} className="flex h-7 px-2.5 items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-[10px] font-bold transition cursor-pointer">
                    <Save className="w-3 h-3" /> Save Thread Draft
                  </button>
                )}
              </div>

              {generatedThread.length === 0 ? (
                <div className="py-16 text-center text-gray-400 space-y-2 border border-dashed border-gray-100 rounded-xl">
                  <Layers className="w-8 h-8 mx-auto text-gray-300 animate-pulse" />
                  <p className="text-xs font-semibold text-gray-800">Your AI Thread Will Appear Here</p>
                  <p className="text-[10px] text-gray-400">Configure parameters on the left and trigger generation.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Summary Box */}
                  <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl">
                    <p className="text-[10px] font-semibold text-gray-600"><strong>AI Summary:</strong> {threadSummary}</p>
                  </div>

                  {/* Connecting Node Preview */}
                  <div className="space-y-4 relative pl-3">
                    {generatedThread.map((tweet, idx) => (
                      <div key={tweet.id} className="relative flex gap-3.5 items-start">
                        {/* Connecting Line */}
                        <div className="flex flex-col items-center shrink-0">
                          <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px] z-10">
                            {idx + 1}
                          </div>
                          {idx < generatedThread.length - 1 && (
                            <div className="w-0.5 absolute top-7 bottom-[-24px] left-[13px] bg-gray-100" />
                          )}
                        </div>

                        {/* Content text block */}
                        <div className="flex-1 bg-gray-50/50 p-4 border border-gray-100 rounded-xl space-y-3">
                          <p className="text-xs font-semibold text-gray-800 leading-relaxed whitespace-pre-wrap">{tweet.text}</p>
                          
                          <div className="flex justify-between items-center border-t border-gray-100/50 pt-2 text-[9px] font-bold text-gray-400">
                            <span className={tweet.text.length > 280 ? 'text-red-500 font-extrabold' : ''}>
                              {tweet.text.length} / 280 chars
                            </span>
                            
                            <div className="flex gap-2">
                              <button onClick={() => handleCopy(tweet.text)} className="hover:text-blue-600 transition shrink-0 cursor-pointer">
                                Copy
                              </button>
                              <button
                                onClick={() => handleRegenerateNode(tweet.id, idx)}
                                className="text-blue-600 hover:underline transition shrink-0 cursor-pointer flex items-center gap-0.5"
                              >
                                <RefreshCw className="w-2.5 h-2.5" /> Regenerate Node
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* CTA Tweet Box */}
                  <div className="p-4 bg-blue-50/20 border border-blue-100/30 rounded-xl space-y-2">
                    <span className="text-[8px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-wider">CTA Tweet Node</span>
                    <p className="text-xs font-semibold text-gray-800 leading-relaxed italic">"{ctaTweet}"</p>
                    <div className="flex justify-end pt-1">
                      <button onClick={() => handleCopy(ctaTweet)} className="flex h-6 px-2.5 items-center gap-1 bg-white hover:bg-gray-50 border border-blue-100 text-blue-600 rounded-lg text-[9px] font-bold transition cursor-pointer">
                        Copy CTA Node
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
