import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, Sparkles, Copy, Check, Loader2 } from 'lucide-react'
import { generateTwitterPost } from '../../services/api'
import { usePlatformAdapter } from '../../platformAdapters'
import PublishModal from './PublishModal'

const TWEET_TYPES = [
  { value: 'tweet', label: 'Single Tweet' },
  { value: 'thread', label: 'Thread' },
  { value: 'launch', label: 'Launch Post' },
  { value: 'announcement', label: 'Announcement' },
  { value: 'engagement', label: 'Engagement Tweet' },
]

function generateFallback(topic) {
  return {
    tweets: [
      {
        type: 'tweet',
        tweet: `The secret to ${topic || 'growth'}? Stop optimizing for virality. Start optimizing for value.\n\nValue compounds. Virality fades.\n\nThat's the whole thread 🧵`,
        thread: [],
        tweetCount: 1,
        cta: 'What is your #1 growth insight? Reply below.',
        hashtags: ['CreatorTips', 'ContentStrategy'],
      },
      {
        type: 'thread',
        tweet: `🧵 The complete guide to ${topic || 'content creation'} (nobody talks about this):\n\nMost advice is surface level. Here's the real breakdown 👇`,
        thread: [
          `🧵 The complete guide to ${topic || 'content creation'} (nobody talks about this):\n\nMost advice is surface level. Here's the real breakdown 👇`,
          `1/ Start with the outcome, not the process.\n\nPeople don't care about your workflow. They care about the result. Lead with transformation.`,
          `2/ The "1-3-1" rule:\n\n→ 1 bold hook\n→ 3 supporting points\n→ 1 sharp CTA\n\nWorks for EVERY platform.`,
          `3/ Consistency > perfection.\n\nShow up daily for 30 days and watch what happens.`,
          `4/ Repurpose everything.\n\nOne idea → 5 pieces of content across 4 platforms.\n\nThat's leverage.`,
          `If this helped, bookmark it.\n\nWhat would you add? 👇`,
        ],
        tweetCount: 6,
        cta: 'Bookmark and share with a creator who needs this.',
        hashtags: ['Thread', 'ContentTips'],
      },
      {
        type: 'launch',
        tweet: `🚀 Excited to share something I've been building for months.\n\n${topic || 'A new approach'} that changes the game.\n\n→ The problem: Generic advice everywhere\n→ The solution: Data-driven, personalized insights\n→ The result: Faster growth, less guesswork\n\nEarly access drops next week. Reply "IN" for priority access.`,
        thread: [],
        tweetCount: 1,
        cta: 'Reply with your biggest challenge and I might solve it.',
        hashtags: ['Launch', 'CreatorEconomy'],
      },
      {
        type: 'announcement',
        tweet: `📢 Big update:\n\nJust hit a major milestone with ${topic || 'my content strategy'}.\n\n✅ Growth is accelerating\n📈 +34% this month\n🎯 Next phase starts Monday\n\nThe secret? Consistency compounds faster than any hack.`,
        thread: [],
        tweetCount: 1,
        cta: 'What milestone are you working toward?',
        hashtags: ['BuildInPublic', 'Milestone'],
      },
      {
        type: 'engagement',
        tweet: `Hot take: The best ${topic || 'content strategy'} for 2025 isn't about going viral.\n\nIt's about becoming the go-to person for ONE specific thing.\n\nSpecialist > Generalist. Always.\n\nAgree or disagree? 👇`,
        thread: [],
        tweetCount: 1,
        cta: 'Drop your hot take below.',
        hashtags: ['HotTake', 'GrowthTips'],
      },
    ],
  }
}

export default function TwitterGenerator() {
  const [isOpen, setIsOpen] = useState(false)
  const [topic, setTopic] = useState('')
  const [tone, setTone] = useState('professional')
  const [audience, setAudience] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [results, setResults] = useState(null)
  const [copiedIdx, setCopiedIdx] = useState(null)
  const [selectedPostForPublish, setSelectedPostForPublish] = useState(null)
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false)
  const { activeAccountId } = usePlatformAdapter()

  const handleGenerate = async () => {
    if (!topic.trim()) return
    setIsGenerating(true)
    setResults(null)

    try {
      const res = await generateTwitterPost({ topic, tone, audience, channelId: activeAccountId || undefined })
      const tweets = res?.data?.tweets
      if (tweets?.length) {
        setResults(res.data)
      } else {
        setResults(generateFallback(topic))
      }
    } catch {
      setResults(generateFallback(topic))
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = (text, idx) => {
    navigator.clipboard.writeText(text)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  return (
    <div className="rounded-[20px] border border-gray-100 bg-white overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-5 flex items-center justify-between bg-white hover:bg-gray-50/30 transition-colors text-left focus:outline-none"
      >
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-500">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-[17px] font-bold text-gray-900 tracking-tight">Twitter / X Generator</h2>
            <p className="text-[12px] text-gray-500 mt-0.5 font-medium">Tweets, threads, launch posts, announcements & engagement hooks</p>
          </div>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gray-50 text-gray-400 border border-gray-100 hover:text-gray-600 transition-colors">
          {isOpen ? <span className="text-sm">&#9650;</span> : <span className="text-sm">&#9660;</span>}
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
            <div className="p-6 pt-3 border-t border-gray-50 space-y-5 bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Topic</label>
                  <input
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. AI Tools, Creator Growth..."
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100/50 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Tone</label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100/50 transition-all"
                  >
                    <option value="professional">Professional</option>
                    <option value="casual">Casual</option>
                    <option value="witty">Witty</option>
                    <option value="bold">Bold</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Audience</label>
                  <input
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    placeholder="e.g. Developers, Founders..."
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100/50 transition-all"
                  />
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={isGenerating || !topic.trim()}
                className="h-11 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-sm px-6 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {isGenerating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="h-4 w-4" /> Generate Tweets</>
                )}
              </button>

              {isGenerating && (
                <div className="py-8 flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" />
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Crafting tweets & threads...</p>
                </div>
              )}

              {results && !isGenerating && (
                <div className="space-y-4">
                  {results.tweets.map((item, idx) => {
                    const typeLabel = TWEET_TYPES.find(t => t.value === item.type)?.label || item.type
                    const isThread = item.type === 'thread' && item.thread?.length > 0
                    const copyText = isThread ? item.thread.join('\n\n') : item.tweet

                    return (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3 shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-100/50 uppercase tracking-wider">{typeLabel}</span>
                            {isThread && <span className="text-[10px] font-semibold text-gray-400">{item.thread.length} tweets</span>}
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => {
                                setSelectedPostForPublish(item)
                                setIsPublishModalOpen(true)
                              }}
                              className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 hover:text-sky-500 transition-colors cursor-pointer"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              Preview & Schedule
                            </button>
                            <button
                              onClick={() => copyToClipboard(copyText, idx)}
                              className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 hover:text-sky-500 transition-colors cursor-pointer"
                            >
                              {copiedIdx === idx ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                              {copiedIdx === idx ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                        </div>

                        {isThread ? (
                          <div className="space-y-2">
                            {item.thread.map((tweet, ti) => (
                              <div key={ti} className="text-[12px] text-gray-700 leading-relaxed pl-3 border-l-2 border-sky-100">
                                <span className="text-gray-400 font-bold text-[10px] mr-1">{ti + 1}/</span>{tweet}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[12px] text-gray-700 leading-relaxed">{item.tweet}</p>
                        )}

                        <p className="text-[11px] text-sky-500 font-semibold">{item.cta}</p>
                        {item.hashtags?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {item.hashtags.map((tag, i) => (
                              <span key={i} className="text-[10px] font-semibold text-sky-500 bg-sky-50/60 px-2 py-0.5 rounded-md">#{tag}</span>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <PublishModal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        platform="twitter"
        content={selectedPostForPublish || {}}
        topic={topic}
        tone={tone}
        audience={audience}
      />
    </div>
  )
}
