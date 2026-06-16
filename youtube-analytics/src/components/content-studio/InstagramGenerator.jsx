import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Share2, Sparkles, Copy, Check, Loader2 } from 'lucide-react'
import { generateInstagramContent } from '../../services/api'
import { usePlatformAdapter } from '../../platformAdapters'

const CONTENT_TYPES = [
  { value: 'reel-caption', label: 'Reel Caption' },
  { value: 'carousel-caption', label: 'Carousel Caption' },
  { value: 'story-content', label: 'Story Content' },
]

function generateFallback(topic) {
  return {
    items: [
      {
        type: 'reel-caption',
        caption: `The #1 thing separating creators who grow from those who don't?\n\nLEVERAGE.\n\nCreating once and distributing everywhere.\n\nSave this if you're ready to work smarter ↗️`,
        hashtags: ['#ReelContent', '#CreatorTips', '#GrowthMindset', '#ContentCreator', '#InstagramGrowth', '#ViralReel', '#ContentStrategy', '#DigitalCreator', '#SocialMediaTips', '#Motivation'],
        audioSuggestion: 'Trending motivational audio',
        reelHook: 'Bold text overlay: "The #1 thing separating creators who grow..."',
      },
      {
        type: 'carousel-caption',
        caption: `I analyzed 500+ viral posts about ${topic || 'growth'}. Here are the patterns that keep showing up 👆\n\nSave this for your next carousel.`,
        hashtags: ['#CarouselPost', '#ContentTips', '#CreatorEconomy', '#InstagramStrategy', '#MarketingTips', '#BrandGrowth'],
        slides: [
          'Slide 1: "5 Patterns Every Viral Post Shares"',
          'Slide 2: #1 — The Hook Formula',
          'Slide 3: #2 — Data-Driven Claims',
          'Slide 4: #3 — The Story Arc',
          'Slide 5: #4 — Actionable Frameworks',
          'Slide 6: #5 — Engagement CTAs',
          'Slide 7: "Which pattern do you use most? Comment 👇"',
        ],
      },
      {
        type: 'story-content',
        caption: `Quick poll: What's your biggest ${topic || 'content'} challenge?\n\nA) Coming up with ideas\nB) Finding time\nC) Growing audience\nD) Monetizing`,
        hashtags: ['#StoryPoll', '#CreatorLife'],
        storyType: 'Poll',
        stickerText: 'What is your biggest challenge?',
        storyVisual: 'Gradient background with bold text overlay',
      },
    ],
  }
}

export default function InstagramGenerator() {
  const [isOpen, setIsOpen] = useState(false)
  const [topic, setTopic] = useState('')
  const [tone, setTone] = useState('professional')
  const [audience, setAudience] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [results, setResults] = useState(null)
  const [copiedIdx, setCopiedIdx] = useState(null)
  const { activeAccountId } = usePlatformAdapter()

  const handleGenerate = async () => {
    if (!topic.trim()) return
    setIsGenerating(true)
    setResults(null)

    try {
      const res = await generateInstagramContent({ topic, tone, audience, channelId: activeAccountId || undefined })
      const items = res?.data?.items
      if (items?.length) {
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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-50 text-pink-500">
            <Share2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-[17px] font-bold text-gray-900 tracking-tight">Instagram Content Generator</h2>
            <p className="text-[12px] text-gray-500 mt-0.5 font-medium">Reel captions, carousel content, story ideas & hashtag optimization</p>
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
                    placeholder="e.g. Fitness, Travel, Tech..."
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100/50 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Tone</label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100/50 transition-all"
                  >
                    <option value="professional">Professional</option>
                    <option value="casual">Casual</option>
                    <option value="aesthetic">Aesthetic</option>
                    <option value="fun">Fun & Energetic</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Audience</label>
                  <input
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    placeholder="e.g. Millennials, Fitness lovers..."
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100/50 transition-all"
                  />
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={isGenerating || !topic.trim()}
                className="h-11 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-bold text-sm px-6 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {isGenerating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="h-4 w-4" /> Generate Instagram Content</>
                )}
              </button>

              {isGenerating && (
                <div className="py-8 flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-pink-100 border-t-pink-500" />
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Optimizing for Instagram engagement...</p>
                </div>
              )}

              {results && !isGenerating && (
                <div className="space-y-4">
                  {results.items.map((item, idx) => {
                    const typeLabel = CONTENT_TYPES.find(t => t.value === item.type)?.label || item.type
                    const copyText = item.type === 'carousel-caption' && item.slides
                      ? `${item.caption}\n\n${item.slides.join('\n')}\n\n${item.hashtags.map(h => `#${h}`).join(' ')}`
                      : `${item.caption}\n\n${item.hashtags.map(h => `#${h}`).join(' ')}`

                    return (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3 shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-pink-600 bg-pink-50 px-2.5 py-1 rounded-lg border border-pink-100/50 uppercase tracking-wider">{typeLabel}</span>
                          <button
                            onClick={() => copyToClipboard(copyText, idx)}
                            className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 hover:text-pink-500 transition-colors cursor-pointer"
                          >
                            {copiedIdx === idx ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                            {copiedIdx === idx ? 'Copied' : 'Copy'}
                          </button>
                        </div>

                        <p className="text-[12px] text-gray-700 leading-relaxed whitespace-pre-line">{item.caption}</p>

                        {item.type === 'reel-caption' && item.reelHook && (
                          <div className="bg-pink-50/50 rounded-xl p-3 border border-pink-100/30">
                            <p className="text-[10px] font-bold text-pink-600 uppercase tracking-wider mb-1">Reel Hook</p>
                            <p className="text-[11px] text-gray-600">{item.reelHook}</p>
                            {item.audioSuggestion && <p className="text-[10px] text-gray-400 mt-1">Audio: {item.audioSuggestion}</p>}
                          </div>
                        )}

                        {item.type === 'carousel-caption' && item.slides && (
                          <div className="space-y-1.5">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Carousel Slides</p>
                            {item.slides.map((slide, si) => (
                              <div key={si} className="text-[11px] text-gray-600 pl-3 border-l-2 border-pink-100">{slide}</div>
                            ))}
                          </div>
                        )}

                        {item.type === 'story-content' && item.storyVisual && (
                          <div className="bg-purple-50/50 rounded-xl p-3 border border-purple-100/30">
                            <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1">Story Type: {item.storyType}</p>
                            <p className="text-[11px] text-gray-600">{item.storyVisual}</p>
                            {item.stickerText && <p className="text-[10px] text-gray-400 mt-1">Sticker: "{item.stickerText}"</p>}
                          </div>
                        )}

                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {item.hashtags.map((tag, i) => (
                            <span key={i} className="text-[10px] font-semibold text-pink-500 bg-pink-50/60 px-2 py-0.5 rounded-md">#{tag}</span>
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
    </div>
  )
}
