import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Clock,
  Send,
  Save,
  CheckCircle,
  X,
  Smile,
  HelpCircle
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

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

const DRAFTS_KEY = 'tw_drafts'

const MOCK_THREAD_AI = [
  [
    "Most creators fail because they focus 100% on creation and 0% on distribution.\n\nHere is a 5-step checklist to turn a single blog post into 10 pieces of social media content automatically: 🧵👇",
    "Step 1: The AI Hook extraction.\n\nTake the most controversial or thought-provoking thesis statement from your post. Put it right at the top. High debate value = high comments index.",
    "Step 2: Bullet summaries.\n\nCondense each major section of your post into a 3-bullet list. Cut out adjectives. Keep it punchy and immediately useful.",
    "Step 3: Leverage queues.\n\nInstead of publishing all at once, schedule thread nodes to hit top activity slots on different platforms automatically using Content Studio! 💡⚡"
  ],
  [
    "Building in public is the ultimate cheat code for 2026.\n\nBut most people do it wrong by just sharing screenshots of metrics.\n\nHere is the exact framework to tell compelling building stories: 👇",
    "1. The Problem: Start with a blocker you faced today. Be brutally honest about the frustration.\n\n2. The Failed Attempts: What did you try first that crashed? Shows humility.",
    "3. The Epiphany: What was the spark that solved it?\n\n4. The Code/Insight: Share the actual code snippet or design structure. High bookmark value!\n\n5. The Takeaway: Summarize it in one actionable sentence."
  ]
]

export default function Threads() {
  const navigate = useNavigate()

  // Seed default thread with 2 blank tweets
  const [tweets, setTweets] = useState([
    { id: 't1', text: '1/ This is the hook of your thread. Capture attention immediately with a bold claim, question, or counter-intuitive insight... 👇' },
    { id: 't2', text: '2/ Add your supporting statistics, bullet points, or step-by-step breakdown here.' }
  ])

  const [scheduleTime, setScheduleTime] = useState('')
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [successToast, setSuccessToast] = useState('')
  const [previewTheme, setPreviewTheme] = useState('light')

  const charLimit = 280

  const handleAddTweet = () => {
    const nextIdx = tweets.length + 1
    setTweets([...tweets, { id: 't_' + Date.now(), text: `${nextIdx}/ ` }])
  }

  const handleRemoveTweet = (id) => {
    if (tweets.length <= 1) return
    const filtered = tweets.filter(t => t.id !== id)
    // Re-index prefixes
    const reindexed = filtered.map((t, idx) => {
      // replace starting number e.g. "3/ " with "2/ "
      let newText = t.text
      const match = t.text.match(/^(\d+)\//)
      if (match) {
        newText = t.text.replace(/^(\d+)\//, `${idx + 1}/`)
      }
      return { ...t, text: newText }
    })
    setTweets(reindexed)
  }

  const handleTweetChange = (id, newText) => {
    setTweets(tweets.map(t => t.id === id ? { ...t, text: newText } : t))
  }

  const handleMoveUp = (idx) => {
    if (idx === 0) return
    const newTweets = [...tweets]
    const temp = newTweets[idx]
    newTweets[idx] = newTweets[idx - 1]
    newTweets[idx - 1] = temp

    // Re-index prefixes
    const reindexed = newTweets.map((t, i) => {
      let text = t.text
      if (t.text.match(/^(\d+)\//)) {
        text = t.text.replace(/^(\d+)\//, `${i + 1}/`)
      }
      return { ...t, text }
    })
    setTweets(reindexed)
  }

  const handleMoveDown = (idx) => {
    if (idx === tweets.length - 1) return
    const newTweets = [...tweets]
    const temp = newTweets[idx]
    newTweets[idx] = newTweets[idx + 1]
    newTweets[idx + 1] = temp

    // Re-index prefixes
    const reindexed = newTweets.map((t, i) => {
      let text = t.text
      if (t.text.match(/^(\d+)\//)) {
        text = t.text.replace(/^(\d+)\//, `${i + 1}/`)
      }
      return { ...t, text }
    })
    setTweets(reindexed)
  }

  const handleAIGenerate = () => {
    const randomIndex = Math.floor(Math.random() * MOCK_THREAD_AI.length)
    const templates = MOCK_THREAD_AI[randomIndex]
    setTweets(templates.map((text, i) => ({ id: 't_ai_' + i, text })))
    showToast('AI Thread generated successfully!')
  }

  const showToast = (msg) => {
    setSuccessToast(msg)
    setTimeout(() => setSuccessToast(''), 3000)
  }

  const handleSaveDraft = () => {
    const hasContent = tweets.some(t => t.text.trim())
    if (!hasContent) return

    const summaryContent = `🧵 Thread (${tweets.length} posts): ${tweets[0].text.substring(0, 60)}...`
    
    const raw = localStorage.getItem(DRAFTS_KEY)
    let currentDrafts = []
    try {
      if (raw) currentDrafts = JSON.parse(raw)
    } catch {}

    const newDraft = {
      id: 'd_th_' + Date.now(),
      content: summaryContent,
      created: new Date().toLocaleDateString(),
      updated: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'Draft Thread'
    }

    localStorage.setItem(DRAFTS_KEY, JSON.stringify([newDraft, ...currentDrafts]))
    showToast('Thread draft saved successfully!')
    setTimeout(() => navigate('/drafts'), 800)
  }

  const handlePublish = () => {
    showToast('Thread published successfully!')
    setTimeout(() => navigate('/dashboard'), 1000)
  }

  const handleScheduleConfirm = (e) => {
    e.preventDefault()
    showToast(`Thread scheduled for publication!`)
    setShowScheduleModal(false)
    setTimeout(() => navigate('/dashboard'), 1000)
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-black text-white">
              <TwitterIcon className="h-4 w-4" fill="currentColor" />
            </span>
            X Thread Composer
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Build viral Twitter/X threads. Sequence multiple posts with live connecting feed previews.
          </p>
        </div>

        <button
          onClick={handleAIGenerate}
          className="flex h-10 px-4 items-center gap-2 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-600 text-xs font-bold cursor-pointer transition self-start sm:self-center"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Generate AI Thread
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left: Multi-tweet Composer List (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-6">
            <div className="space-y-4">
              {tweets.map((t, idx) => {
                const isOver = t.text.length > charLimit
                return (
                  <div key={t.id} className="relative p-4 border border-gray-100 bg-gray-50/20 rounded-xl space-y-3">
                    <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 pl-1 uppercase tracking-wider">
                      <span>TWEET {idx + 1}</span>
                      <div className="flex items-center gap-3">
                        <span className={isOver ? 'text-red-500 font-extrabold' : ''}>
                          {t.text.length} / {charLimit}
                        </span>
                        
                        {/* Reordering */}
                        <div className="flex gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveUp(idx)}
                            className="p-1 hover:bg-white border border-gray-100 rounded text-gray-400 hover:text-gray-700 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === tweets.length - 1}
                            onClick={() => handleMoveDown(idx)}
                            className="p-1 hover:bg-white border border-gray-100 rounded text-gray-400 hover:text-gray-700 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <textarea
                      value={t.text}
                      onChange={(e) => handleTweetChange(t.id, e.target.value)}
                      placeholder={`${idx + 1}/ Continue thread...`}
                      className="w-full min-h-[90px] bg-transparent border-0 outline-0 resize-none text-xs text-gray-800 font-medium placeholder-gray-400 leading-relaxed"
                    />

                    {tweets.length > 1 && (
                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => handleRemoveTweet(t.id)}
                          className="flex h-7 px-2.5 items-center gap-1 hover:bg-red-50 text-red-500 rounded-lg text-[10px] font-bold cursor-pointer transition border border-transparent hover:border-red-100"
                        >
                          <Trash2 className="w-3 h-3" /> Remove Node
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Actions Row */}
            <div className="flex justify-between items-center border-t border-gray-50 pt-5">
              <button
                onClick={handleAddTweet}
                className="flex h-9 px-4 items-center gap-1.5 border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 rounded-xl text-xs font-semibold cursor-pointer transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Tweet to Thread
              </button>

              <div className="flex gap-2">
                <button
                  onClick={handleSaveDraft}
                  className="flex h-9 px-3.5 items-center gap-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-xs font-semibold cursor-pointer transition"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Draft
                </button>
                <button
                  onClick={() => setShowScheduleModal(true)}
                  className="flex h-9 px-3.5 items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-xs font-bold cursor-pointer transition"
                >
                  <Clock className="w-3.5 h-3.5" />
                  Schedule Thread
                </button>
                <button
                  onClick={handlePublish}
                  className="flex h-9 px-4 items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-sm shadow-blue-500/10"
                >
                  <Send className="w-3.5 h-3.5" />
                  Publish Thread
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Connective Live Thread Preview */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1">Live Thread Preview</h3>
              <div className="flex border border-gray-100 rounded-lg p-0.5 bg-gray-50">
                <button
                  onClick={() => setPreviewTheme('light')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition ${
                    previewTheme === 'light' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'
                  }`}
                >
                  Light
                </button>
                <button
                  onClick={() => setPreviewTheme('dark')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition ${
                    previewTheme === 'dark' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400'
                  }`}
                >
                  Dark
                </button>
              </div>
            </div>

            {/* Connective Node Preview Container */}
            <div className={`p-5 rounded-2xl border ${
              previewTheme === 'dark' ? 'bg-[#15181c] border-[#2f3336] text-white' : 'bg-white border-gray-100 text-gray-800'
            } shadow-sm space-y-6 relative overflow-hidden`}>
              
              {tweets.map((t, idx) => (
                <div key={t.id} className="relative flex gap-3 items-start">
                  
                  {/* Left Column connecting line and dots */}
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs z-10">
                      S
                    </div>
                    {idx < tweets.length - 1 && (
                      <div className={`w-0.5 absolute top-8 bottom-[-24px] left-[15px] ${
                        previewTheme === 'dark' ? 'bg-[#2f3336]' : 'bg-gray-100'
                      }`} />
                    )}
                  </div>

                  {/* Right Column Tweet Content */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold truncate">Samay Raina</span>
                      <span className="w-3.5 h-3.5 bg-blue-500 rounded-full flex items-center justify-center text-[8px] text-white font-bold shrink-0">✓</span>
                      <span className={`text-[9px] ${previewTheme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>@samay_raina</span>
                    </div>

                    <p className="text-xs font-medium leading-relaxed whitespace-pre-wrap">
                      {t.text || <span className={previewTheme === 'dark' ? 'text-[#6e767d]' : 'text-gray-300'}>Empty post...</span>}
                    </p>

                    <div className={`flex gap-4 pt-1 text-[8px] font-bold ${
                      previewTheme === 'dark' ? 'text-[#6e767d]' : 'text-gray-400'
                    }`}>
                      <span>💬 0</span>
                      <span>🔁 0</span>
                      <span>❤️ 0</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Picker Modal Overlay */}
      <AnimatePresence>
        {showScheduleModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
          >
            <motion.form
              onSubmit={handleScheduleConfirm}
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white rounded-[24px] border border-gray-100 p-6 w-full max-w-md shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  Schedule Publication
                </h3>
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="p-1 hover:bg-gray-50 rounded-full text-gray-400 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block pl-1">Publication Time</label>
                <input
                  type="datetime-local"
                  required
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-gray-100 text-xs font-medium text-gray-700 bg-gray-50/50 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/25 transition"
                />
              </div>

              <div className="bg-blue-50/30 border border-blue-100/50 p-3 rounded-xl flex gap-2">
                <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-[10px] leading-relaxed text-blue-700 font-medium">
                  Threads are published incrementally in intervals of 2 seconds to ensure correct Twitter Graph API chronological rendering order.
                </p>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="h-10 px-4 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer shadow-sm shadow-blue-500/10"
                >
                  Confirm Schedule
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
