import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Globe, Sparkles, Copy, Check, Loader2 } from 'lucide-react'
import { generateLinkedInPost } from '../../services/api'
import { usePlatformAdapter } from '../../platformAdapters'
import PublishModal from './PublishModal'

const POST_TYPES = [
  { value: 'thought-leadership', label: 'Thought Leadership', desc: 'Industry insights & opinions' },
  { value: 'story', label: 'Story Post', desc: 'Personal journey narrative' },
  { value: 'educational', label: 'Educational', desc: 'Teach a concept or framework' },
  { value: 'carousel', label: 'Carousel Caption', desc: 'Multi-slide content' },
  { value: 'personal-branding', label: 'Personal Branding', desc: 'Build your identity' },
]

function generateFallback(topic) {
  return {
    posts: POST_TYPES.map((pt) => ({
      type: pt.value,
      hook: `Most ${topic || 'creators'} overlook the one thing that changes everything...`,
      body: `After studying the landscape of ${topic || 'content creation'} extensively, one pattern is undeniable.\n\nThe top performers don't work harder — they work with more leverage.\n\n→ They repurpose content across platforms\n→ They systematize their workflow\n→ They focus on depth over width\n\nThis isn't theory. It's what the data shows.`,
      cta: 'What is your #1 takeaway from this? Drop it below — I read every comment.',
      hashtags: ['ContentStrategy', 'CreatorEconomy', 'GrowthMindset', 'PersonalBranding', 'Leadership'],
    })),
  }
}

export default function LinkedInGenerator() {
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
      const res = await generateLinkedInPost({ topic, tone, audience, channelId: activeAccountId || undefined })
      const posts = res?.data?.posts
      if (posts?.length) {
        setResults(res.data)
      } else {
        setResults(generateFallback(topic))
      }
    } catch (err) {
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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-[17px] font-bold text-gray-900 tracking-tight">LinkedIn Post Generator</h2>
            <p className="text-[12px] text-gray-500 mt-0.5 font-medium">Thought leadership, stories, educational posts, carousels & personal branding</p>
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
              {/* Input Controls */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Topic</label>
                  <input
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. AI Productivity, Content Strategy..."
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100/50 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Tone</label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100/50 transition-all"
                  >
                    <option value="professional">Professional</option>
                    <option value="casual">Casual</option>
                    <option value="inspirational">Inspirational</option>
                    <option value="humorous">Humorous</option>
                    <option value="controversial">Controversial</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Audience</label>
                  <input
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    placeholder="e.g. SaaS founders, creators..."
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100/50 transition-all"
                  />
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={isGenerating || !topic.trim()}
                className="h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-6 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {isGenerating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="h-4 w-4" /> Generate LinkedIn Posts</>
                )}
              </button>

              {/* Loader */}
              {isGenerating && (
                <div className="py-8 flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Crafting platform-optimized posts...</p>
                </div>
              )}

              {/* Results */}
              {results && !isGenerating && (
                <div className="space-y-4">
                  {results.posts.map((post, idx) => {
                    const typeLabel = POST_TYPES.find(t => t.value === post.type)?.label || post.type
                    return (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3 shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100/50 uppercase tracking-wider">{typeLabel}</span>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => {
                                setSelectedPostForPublish(post)
                                setIsPublishModalOpen(true)
                              }}
                              className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 hover:text-blue-600 transition-colors cursor-pointer"
                            >
                              <Globe className="h-3.5 w-3.5" />
                              Preview & Schedule
                            </button>
                            <button
                              onClick={() => copyToClipboard(`${post.hook}\n\n${post.body}\n\n${post.cta}\n\n${post.hashtags.map(h => `#${h}`).join(' ')}`, idx)}
                              className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 hover:text-blue-600 transition-colors cursor-pointer"
                            >
                              {copiedIdx === idx ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                              {copiedIdx === idx ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                        </div>
                        <p className="text-[13px] font-bold text-gray-900 leading-snug">{post.hook}</p>
                        <p className="text-[12px] text-gray-600 leading-relaxed whitespace-pre-line">{post.body}</p>
                        <p className="text-[12px] text-blue-600 font-semibold">{post.cta}</p>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {post.hashtags.map((tag, i) => (
                            <span key={i} className="text-[10px] font-semibold text-blue-500 bg-blue-50/60 px-2 py-0.5 rounded-md">#{tag}</span>
                          ))}
                        </div>
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
        platform="linkedin"
        content={selectedPostForPublish || {}}
        topic={topic}
        tone={tone}
        audience={audience}
      />
    </div>
  )
}
