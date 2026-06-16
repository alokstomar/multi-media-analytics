import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Repeat, Sparkles, Copy, Check, Loader2 } from 'lucide-react'
import { repurposeContent } from '../../services/api'
import { usePlatformAdapter } from '../../platformAdapters'

function generateFallback(title) {
  return {
    sourceTitle: title,
    sourceDescription: '',
    platforms: {
      linkedin: {
        hook: `I just released something that could change how you think about ${title.split(' ').slice(0, 4).join(' ')}...`,
        body: `Key insights from "${title}":\n\n→ The approach most people get wrong\n→ A framework that actually works\n→ Real results you can replicate\n\nThe full breakdown is in my latest video, but here are the takeaways you can apply today.`,
        cta: 'What resonated most? Drop your thoughts in the comments.',
        hashtags: ['ContentStrategy', 'CreatorTips', 'GrowthMindset'],
      },
      twitter: {
        thread: [
          `🧵 Just dropped a deep dive on "${title}"\n\nHere is everything you need to know 👇`,
          `1/ The biggest misconception:\n\nPeople think it is about talent. It is about systems.`,
          `2/ The framework:\n→ Define outcome first\n→ Reverse-engineer the steps\n→ Execute consistently`,
          `3/ Data is clear: systematic creators grow 3x faster.`,
          `4/ If this helped, share it. Full video in bio 🔗`,
        ],
        hashtags: ['#Thread', '#ContentTips'],
      },
      instagram: {
        caption: `New content alert 🚨\n\n"${title}" is live.\n\nKey takeaways:\n✅ Systems > talent\n✅ Consistency > perfection\n✅ Framework you can copy\n\nSave this for later!`,
        hashtags: ['#ReelContent', '#CreatorTips', '#ContentStrategy', '#InstagramGrowth'],
      },
      hooks: [
        `"What I learned from '${title.slice(0, 30)}' changed everything"`,
        `"Stop doing THIS if you want to grow"`,
        `"The hack nobody talks about"`,
        `"I spent 100 hours on this so you don't have to"`,
      ],
    },
  }
}

export default function RepurposeEngine() {
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [transcript, setTranscript] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [results, setResults] = useState(null)
  const [copiedKey, setCopiedKey] = useState(null)
  const { activeAccountId } = usePlatformAdapter()

  const handleGenerate = async () => {
    if (!title.trim()) return
    setIsGenerating(true)
    setResults(null)

    try {
      const res = await repurposeContent({ title, description, transcript, channelId: activeAccountId || undefined })
      const d = res?.data
      if (d?.platforms) {
        setResults(d)
      } else {
        setResults(generateFallback(title))
      }
    } catch {
      setResults(generateFallback(title))
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const CopyBtn = ({ text, keyName }) => (
    <button
      onClick={() => copyToClipboard(text, keyName)}
      className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 hover:text-violet-500 transition-colors cursor-pointer"
    >
      {copiedKey === keyName ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      {copiedKey === keyName ? 'Copied' : 'Copy'}
    </button>
  )

  return (
    <div className="rounded-[20px] border border-gray-100 bg-white overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-5 flex items-center justify-between bg-white hover:bg-gray-50/30 transition-colors text-left focus:outline-none"
      >
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <Repeat className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-[17px] font-bold text-gray-900 tracking-tight">Content Repurpose Engine</h2>
            <p className="text-[12px] text-gray-500 mt-0.5 font-medium">Transform YouTube content into LinkedIn posts, Twitter threads, Instagram captions & short-form hooks</p>
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
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">YouTube Video Title</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Paste your video title..."
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100/50 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Video Description (optional)</label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Paste your video description..."
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100/50 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Transcript (optional)</label>
                  <textarea
                    rows={4}
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder="Paste your video transcript for better results..."
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100/50 transition-all font-mono text-[12px]"
                  />
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={isGenerating || !title.trim()}
                className="h-11 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm px-6 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {isGenerating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Repurposing...</>
                ) : (
                  <><Sparkles className="h-4 w-4" /> Repurpose to All Platforms</>
                )}
              </button>

              {isGenerating && (
                <div className="py-8 flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-100 border-t-violet-600" />
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Generating multi-platform content...</p>
                </div>
              )}

              {results && !isGenerating && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  {/* LinkedIn */}
                  {results.platforms.linkedin && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100/50 uppercase tracking-wider">LinkedIn Post</span>
                        <CopyBtn text={`${results.platforms.linkedin.hook}\n\n${results.platforms.linkedin.body}\n\n${results.platforms.linkedin.cta}\n\n${results.platforms.linkedin.hashtags.map(h => `#${h}`).join(' ')}`} keyName="linkedin" />
                      </div>
                      <p className="text-[13px] font-bold text-gray-900">{results.platforms.linkedin.hook}</p>
                      <p className="text-[12px] text-gray-600 leading-relaxed whitespace-pre-line">{results.platforms.linkedin.body}</p>
                      <p className="text-[12px] text-blue-600 font-semibold">{results.platforms.linkedin.cta}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {results.platforms.linkedin.hashtags.map((h, i) => <span key={i} className="text-[10px] font-semibold text-blue-500 bg-blue-50/60 px-2 py-0.5 rounded-md">#{h}</span>)}
                      </div>
                    </div>
                  )}

                  {/* Twitter */}
                  {results.platforms.twitter && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-100/50 uppercase tracking-wider">Twitter Thread</span>
                        <CopyBtn text={results.platforms.twitter.thread.join('\n\n')} keyName="twitter" />
                      </div>
                      <div className="space-y-2">
                        {results.platforms.twitter.thread.map((tweet, ti) => (
                          <div key={ti} className="text-[12px] text-gray-700 leading-relaxed pl-3 border-l-2 border-sky-100">
                            <span className="text-gray-400 font-bold text-[10px] mr-1">{ti + 1}/</span>{tweet}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Instagram */}
                  {results.platforms.instagram && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-pink-600 bg-pink-50 px-2.5 py-1 rounded-lg border border-pink-100/50 uppercase tracking-wider">Instagram Caption</span>
                        <CopyBtn text={`${results.platforms.instagram.caption}\n\n${results.platforms.instagram.hashtags.map(h => `#${h}`).join(' ')}`} keyName="instagram" />
                      </div>
                      <p className="text-[12px] text-gray-700 leading-relaxed whitespace-pre-line">{results.platforms.instagram.caption}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {results.platforms.instagram.hashtags.map((h, i) => <span key={i} className="text-[10px] font-semibold text-pink-500 bg-pink-50/60 px-2 py-0.5 rounded-md">#{h}</span>)}
                      </div>
                    </div>
                  )}

                  {/* Hooks */}
                  {results.platforms.hooks && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3 shadow-sm">
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100/50 uppercase tracking-wider">Short-Form Hooks</span>
                      <div className="space-y-2">
                        {results.platforms.hooks.map((hook, i) => (
                          <div key={i} className="flex items-start gap-2 text-[12px] text-gray-700 bg-amber-50/30 rounded-xl p-3">
                            <span className="text-amber-500 font-bold shrink-0">{i + 1}.</span>
                            <span>{hook}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
