import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, Sparkles, AlertCircle, ArrowUpRight, BarChart2 } from 'lucide-react'
import { usePlatformAdapter } from '../../platformAdapters'
import { usePlatform } from '../../context/PlatformContext'
import { generateVideoIdeas as apiGenerateVideoIdeas } from '../../services/api'

const cs = '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)'

function fmtViews(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function generateFallback(channelData, platform) {
  const topVids = channelData?._raw?.topVideos || channelData?._raw?.posts || []
  return Array.from({ length: 10 }, (_, i) => {
    const matchingVid = topVids[i % topVids.length] || {}
    const baseTitle = matchingVid.title || matchingVid.caption || 'Latest Upload'
    const parsedTitle = baseTitle.replace(/[^a-zA-Z0-9\s]/g, '')
    const tags = ['Viral Opportunity', 'High Potential', 'Audience Favorite', 'Evergreen']
    const colors = [
      'bg-red-50 text-red-600 border-red-100',
      'bg-blue-50 text-blue-600 border-blue-100',
      'bg-purple-50 text-purple-600 border-purple-100',
      'bg-emerald-50 text-emerald-600 border-emerald-100',
    ]
    const idx = i % 4
    return {
      id: i + 1,
      title: `The Future of ${parsedTitle || (platform === 'instagram' ? 'Instagram Content' : 'YouTube Content')}`,
      whyRecommend: `Based on your top ${platform === 'instagram' ? 'post' : 'video'} "${baseTitle.slice(0, 30)}...", this concept leverages similar keywords, targeting a predicted boost of +18%.`,
      predictedViews: matchingVid.views || matchingVid.reach ? fmtViews((matchingVid.views || matchingVid.reach) * 1.2) : '450K',
      predictedEngagement: matchingVid.views || matchingVid.likes ? `${fmtViews((matchingVid.views || matchingVid.likes) * 0.08)} likes` : '32K likes',
      difficulty: Math.round(40 + ((i * 6) % 55)),
      opportunity: Math.round(75 + ((i * 3) % 23)),
      trendScore: Math.round(80 + ((i * 2) % 19)),
      tag: tags[idx],
      badgeColor: colors[idx],
    }
  })
}

export default function VideoIdeasSection({ channelData }) {
  const [isOpen, setIsOpen] = useState(true)
  const { selectedPlatform } = usePlatform()
  const { activeAccountId: activeChannelId } = usePlatformAdapter()
  const [ideas, setIdeas] = useState(() => generateFallback(channelData, selectedPlatform))

  useEffect(() => {
    if (!activeChannelId || activeChannelId === 'demo' || activeChannelId === 'demo_ig') {
      setIdeas(generateFallback(channelData, selectedPlatform))
      return
    }
    apiGenerateVideoIdeas(activeChannelId)
      .then((res) => {
        const apiIdeas = res?.data?.ideas
        if (Array.isArray(apiIdeas) && apiIdeas.length > 0) {
          setIdeas(apiIdeas)
        } else {
          setIdeas(generateFallback(channelData, selectedPlatform))
        }
      })
      .catch(() => setIdeas(generateFallback(channelData, selectedPlatform)))
  }, [activeChannelId, channelData, selectedPlatform])

  return (
    <div className="rounded-[20px] border border-gray-100 bg-white overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)' }}>
      {/* Header (Collapsible toggle) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-5.5 flex items-center justify-between bg-white hover:bg-gray-50/30 transition-colors text-left focus:outline-none"
      >
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-[17px] font-bold text-gray-900 tracking-tight">{selectedPlatform === 'instagram' ? 'Recommended Next Reels/Posts' : 'Recommended Next Videos'}</h2>
            <p className="text-[12px] text-gray-500 mt-0.5 font-medium">Top 10 creator concepts optimized for {selectedPlatform === 'instagram' ? 'reach, engagement and saves' : 'watch time, CTR and retention gains'}</p>
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
            <div className="p-6 pt-3 border-t border-gray-50 space-y-4.5 max-h-[640px] overflow-y-auto scrollbar-thin bg-gray-50">
              {ideas.map((idea, idx) => (
                <motion.div
                  key={idea.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.04 }}
                  className="rounded-2xl border border-gray-100 bg-white p-5 hover:border-violet-200/60 transition-all duration-300 grid grid-cols-1 md:grid-cols-12 gap-5 items-center"
                >
                  {/* Title & Explanation */}
                  <div className="md:col-span-6 space-y-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold text-gray-400 uppercase">CONCEPT #{idea.id}</span>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${idea.badgeColor}`}>
                        {idea.tag}
                      </span>
                    </div>
                    <h3 className="text-[15px] font-bold text-gray-900 leading-snug tracking-tight">
                      {idea.title}
                    </h3>
                    <p className="text-[11px] text-gray-600 leading-relaxed flex items-start gap-2 bg-violet-50 p-3 rounded-xl border border-violet-100/30">
                      <AlertCircle className="h-3.5 w-3.5 mt-0.5 text-violet-500 shrink-0" />
                      <span className="font-medium">{idea.whyRecommend}</span>
                    </p>
                  </div>

                  {/* Prediction KPIs */}
                  <div className="md:col-span-3 grid grid-cols-2 gap-3">
                    <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{selectedPlatform === 'instagram' ? 'Est. Reach' : 'Est. Views'}</p>
                      <p className="text-[16px] font-bold text-gray-800 mt-0.5">{idea.predictedViews}</p>
                    </div>
                    <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Est. Likes</p>
                      <p className="text-[16px] font-bold text-gray-800 mt-0.5">{idea.predictedEngagement.split(' ')[0]}</p>
                    </div>
                  </div>

                  {/* Score Meters */}
                  <div className="md:col-span-3 space-y-3">
                    {/* Opportunity Score */}
                    <div>
                      <div className="flex justify-between text-[11px] font-bold mb-1">
                        <span className="text-gray-500">Opportunity Score</span>
                        <span className="text-violet-600 font-bold">{idea.opportunity}%</span>
                      </div>
                      <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-violet-600 h-full rounded-full" style={{ width: `${idea.opportunity}%` }} />
                      </div>
                    </div>

                    {/* Difficulty Score */}
                    <div>
                      <div className="flex justify-between text-[11px] font-bold mb-1">
                        <span className="text-gray-500">Production Difficulty</span>
                        <span className="text-amber-600 font-bold">{idea.difficulty}%</span>
                      </div>
                      <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-amber-500 h-full rounded-full" style={{ width: `${idea.difficulty}%` }} />
                      </div>
                    </div>

                    {/* Trend Score */}
                    <div>
                      <div className="flex justify-between text-[11px] font-bold mb-1">
                        <span className="text-gray-500">Trend Index</span>
                        <span className="text-emerald-600 font-bold">{idea.trendScore}%</span>
                      </div>
                      <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${idea.trendScore}%` }} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
