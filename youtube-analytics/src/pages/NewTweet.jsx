import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Smile,
  Hash,
  Image as ImageIcon,
  Clock,
  Send,
  Save,
  ChevronRight,
  TrendingUp,
  X,
  CheckCircle,
  HelpCircle
} from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'

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

const SUGGESTED_HASHTAGS = ['#solopreneur', '#SaaS', '#buildinpublic', '#indiehackers', '#marketing', '#productivity']

const MOCK_AI_TEMPLATES = [
  "Stop wasting hours on manual tasks.\n\nHere are 3 simple automation playbooks that will save you 10+ hours a week starting tomorrow:\n\n1. Auto-cross-posting to X\n2. Smart DM workflows\n3. Dynamic calendar loops\n\nWhich one are you setting up first? 🧵👇",
  "Consistency is the ultimate superpower.\n\nBut staying consistent manually is a recipe for burnout.\n\nUse this simple rule:\n- Batch write on Sundays\n- Automate queues for the week\n- Spend 15m a day interacting\n\nBuild in public, automate in private. 💡🚀",
  "The math of content creation is compounding:\n\n- 1 post a day = 365 shots a year\n- 3 posts a day = 1,095 shots a year\n\nBy building an automated publishing queue, we scaled organic views by 3.2x without writing extra hours. Here is the process... 🧠⚡"
]

export default function NewTweet() {
  const navigate = useNavigate()
  const location = useLocation()

  // Content state
  const [content, setContent] = useState('')
  const [mediaFile, setMediaFile] = useState(null)
  const [mediaPreview, setMediaPreview] = useState(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [scheduleTime, setScheduleTime] = useState('')
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [successToast, setSuccessToast] = useState('')
  const [previewTheme, setPreviewTheme] = useState('light') // light or dark X theme

  // Seed draft content if coming from AI Suggestion or Edit Draft
  useEffect(() => {
    if (location.state?.content) {
      setContent(location.state.content)
    }
  }, [location.state])

  // Character counter limits
  const charLimit = 280
  const charCount = content.length
  const isOverLimit = charCount > charLimit

  // Preset emojis for active insertion
  const emojis = ['🚀', '🔥', '💡', '🧵', '🧠', '⚡', '🤖', '📈', '👇', '🎯', '✨', '📝']

  const handleInsertEmoji = (emoji) => {
    setContent(prev => prev + emoji)
    setShowEmojiPicker(false)
  }

  const handleHashtagClick = (tag) => {
    if (content.endsWith(' ') || content === '') {
      setContent(prev => prev + tag + ' ')
    } else {
      setContent(prev => prev + ' ' + tag + ' ')
    }
  }

  const handleMediaUpload = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setMediaFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setMediaPreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleClearMedia = () => {
    setMediaFile(null)
    setMediaPreview(null)
  }

  const handleAIGenerate = () => {
    const randomIndex = Math.floor(Math.random() * MOCK_AI_TEMPLATES.length)
    setContent(MOCK_AI_TEMPLATES[randomIndex])
    showToast('AI tweet generated successfully!')
  }

  const showToast = (msg) => {
    setSuccessToast(msg)
    setTimeout(() => setSuccessToast(''), 3000)
  }

  // Load and save drafts to local storage
  const handleSaveDraft = () => {
    if (!content.trim()) return
    const raw = localStorage.getItem(STORAGE_KEY)
    let currentDrafts = []
    try {
      if (raw) currentDrafts = JSON.parse(raw)
    } catch {}

    const newDraft = {
      id: 'd_' + Date.now(),
      content: content,
      created: new Date().toLocaleDateString(),
      updated: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'Draft'
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify([newDraft, ...currentDrafts]))
    showToast('Draft saved successfully!')
    setTimeout(() => navigate('/drafts'), 800)
  }

  const handlePublish = () => {
    if (!content.trim() || isOverLimit) return
    showToast('Tweet published successfully!')
    setContent('')
    handleClearMedia()
    setTimeout(() => navigate('/dashboard'), 1000)
  }

  const handleScheduleConfirm = (e) => {
    e.preventDefault()
    if (!scheduleTime) return
    showToast(`Tweet scheduled for ${new Date(scheduleTime).toLocaleString()}`)
    setShowScheduleModal(false)
    setContent('')
    handleClearMedia()
    setTimeout(() => navigate('/dashboard'), 1000)
  }

  return (
    <div className="min-h-screen bg-gray-50/50 space-y-6 pb-12">
      {/* Toast Notification */}
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-black text-white">
            <TwitterIcon className="h-4 w-4" fill="currentColor" />
          </span>
          Create New Tweet
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Draft a high-impact single tweet. Use the AI engine to generate copy or schedule into publishing timetables.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Side: Composer Area (2 columns) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
            {/* Editor Area */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs text-gray-400 font-semibold pl-1">
                <span>COMPOSE TWEET</span>
                <span className={isOverLimit ? 'text-red-500 font-bold' : ''}>
                  {charCount} / {charLimit} characters
                </span>
              </div>
              
              <div className="relative border border-gray-100 rounded-xl bg-gray-50/30 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400/20 transition-all p-4">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="What is happening? Share an actionable insight, update, or hook..."
                  className="w-full min-h-[160px] bg-transparent border-0 outline-0 resize-none text-sm text-gray-800 placeholder-gray-400 font-medium leading-relaxed"
                />

                {/* Media Preview Box */}
                {mediaPreview && (
                  <div className="relative mt-3 rounded-lg overflow-hidden border border-gray-100 w-full max-h-[220px] bg-black/5 flex items-center justify-center">
                    <img src={mediaPreview} alt="Upload preview" className="max-h-[220px] object-contain" />
                    <button
                      onClick={handleClearMedia}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white cursor-pointer transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Editor Widgets Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-50 pt-4">
              <div className="flex items-center gap-2">
                {/* Image upload Button */}
                <label className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-500 cursor-pointer transition relative">
                  <input type="file" accept="image/*" onChange={handleMediaUpload} className="hidden" />
                  <ImageIcon className="w-4 h-4" />
                </label>

                {/* Emoji button */}
                <div className="relative">
                  <button
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-500 cursor-pointer transition"
                  >
                    <Smile className="w-4 h-4" />
                  </button>

                  {showEmojiPicker && (
                    <div className="absolute top-11 left-0 z-20 bg-white border border-gray-100 p-2 rounded-xl shadow-lg grid grid-cols-4 gap-1.5 w-44">
                      {emojis.map(e => (
                        <button
                          key={e}
                          onClick={() => handleInsertEmoji(e)}
                          className="h-8 w-8 hover:bg-gray-50 rounded-lg flex items-center justify-center text-lg cursor-pointer"
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* AI Generator Button */}
                <button
                  onClick={handleAIGenerate}
                  className="flex h-9 px-3 items-center gap-1.5 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-600 text-xs font-bold cursor-pointer transition"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  AI Assist
                </button>
              </div>

              {/* Standard Composer Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleSaveDraft}
                  disabled={!content.trim()}
                  className="flex h-9 px-3.5 items-center gap-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg text-xs font-semibold cursor-pointer transition disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  Draft
                </button>
                <button
                  onClick={() => setShowScheduleModal(true)}
                  disabled={!content.trim() || isOverLimit}
                  className="flex h-9 px-3.5 items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-xs font-bold cursor-pointer transition disabled:opacity-50"
                >
                  <Clock className="w-3.5 h-3.5" />
                  Schedule
                </button>
                <button
                  onClick={handlePublish}
                  disabled={!content.trim() || isOverLimit}
                  className="flex h-9 px-4 items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer transition disabled:opacity-50 shadow-sm shadow-blue-500/10"
                >
                  <Send className="w-3.5 h-3.5" />
                  Publish
                </button>
              </div>
            </div>

            {/* Hashtag Suggestions */}
            <div className="space-y-2 border-t border-gray-50 pt-4">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 block">Hashtag Suggestions</span>
              <div className="flex flex-wrap gap-1.5 pl-0.5">
                {SUGGESTED_HASHTAGS.map(tag => (
                  <button
                    key={tag}
                    onClick={() => handleHashtagClick(tag)}
                    className="flex items-center gap-0.5 px-2.5 py-1 bg-gray-50 hover:bg-blue-50 hover:text-blue-600 text-gray-500 rounded-lg text-[10px] font-bold cursor-pointer transition border border-transparent hover:border-blue-100"
                  >
                    <Hash className="w-2.5 h-2.5" />
                    {tag.replace('#', '')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Preview & Forecasting (1 column) */}
        <div className="space-y-6">
          
          {/* Live Tweet Feed Preview */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1">Live Feed Preview</h3>
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

            {/* X Card Render */}
            <div className={`p-4 rounded-2xl border ${
              previewTheme === 'dark' ? 'bg-[#15181c] border-[#2f3336] text-white' : 'bg-white border-gray-100 text-gray-800'
            } shadow-sm space-y-3`}>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  S
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate flex items-center gap-1">
                    Samay Raina
                    <span className="w-3.5 h-3.5 bg-blue-500 rounded-full flex items-center justify-center text-[8px] text-white font-bold shrink-0">✓</span>
                  </p>
                  <p className={`text-[10px] truncate ${previewTheme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>@samay_raina</p>
                </div>
              </div>

              {/* Feed Text */}
              <p className="text-xs font-medium leading-relaxed whitespace-pre-wrap">
                {content || <span className={previewTheme === 'dark' ? 'text-[#6e767d]' : 'text-gray-400'}>Tweet preview will appear here in real-time...</span>}
              </p>

              {/* Media Preview inside Feed */}
              {mediaPreview && (
                <div className="rounded-xl overflow-hidden border border-gray-100 max-h-[180px]">
                  <img src={mediaPreview} alt="Post preview" className="w-full max-h-[180px] object-cover" />
                </div>
              )}

              {/* Interaction Bar */}
              <div className={`flex justify-between border-t pt-2 text-[9px] font-bold ${
                previewTheme === 'dark' ? 'border-[#2f3336] text-[#6e767d]' : 'border-gray-50 text-gray-400'
              }`}>
                <span>💬 0</span>
                <span>🔁 0</span>
                <span>❤️ 0</span>
                <span>📊 0</span>
              </div>
            </div>
          </div>

          {/* Forecast Card */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1">Algorithmic Forecast</h3>

            <div className="space-y-3">
              <div className="p-3 bg-green-50/20 border border-green-100/50 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-green-700">ESTIMATED REACH</p>
                  <p className="text-lg font-bold text-green-600 mt-0.5">8.4K - 16.5K</p>
                </div>
                <div className="text-right">
                  <span className="inline-block text-[9px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                    94% Virality
                  </span>
                </div>
              </div>

              <div className="p-3 bg-blue-50/20 border border-blue-100/50 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-blue-700">OPTIMAL POSTING HOUR</p>
                  <p className="text-xs font-bold text-gray-800 mt-1">Today at 6:45 PM</p>
                </div>
                <span className="text-[9px] font-bold text-blue-600 bg-white border border-blue-100 px-2.5 py-1 rounded-lg">
                  Set Time
                </span>
              </div>
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
                  We've automatically cross-referenced optimal historical reach slots. The selected index maps to highest user engagement bounds.
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
