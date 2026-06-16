import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp,
  Search,
  Plus,
  Sparkles,
  Zap,
  CheckCircle,
  HelpCircle,
  Award,
  RefreshCw
} from 'lucide-react'

import { useNavigate } from 'react-router-dom'
import { aiGetTrendingTopics } from '../services/api'


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

const CATEGORIES = ['AI', 'Business', 'Finance', 'Marketing', 'Tech', 'Startups']

const MOCK_TRENDS = [
  { id: 'tr1', topic: 'AI Agentic Coding Workflows', category: 'AI', trendScore: 98, growth: 142.5, competition: 'Medium', opportunity: 96, hook: 'AI agents are no longer just answering questions. They are writing entire repositories in seconds...' },
  { id: 'tr2', topic: 'Solopreneur micro-SaaS exits', category: 'Startups', trendScore: 94, growth: 84.2, competition: 'Low', opportunity: 95, hook: 'You don\'t need a 10-person team to build a $50K/mo SaaS anymore. Here is the framework:' },
  { id: 'tr3', topic: 'Decentralized Finance Layer 3 systems', category: 'Finance', trendScore: 91, growth: 52.8, competition: 'High', opportunity: 88, hook: 'L3 systems are quietly capturing the next wave of DeFi liquidity. Here is why:' },
  { id: 'tr4', topic: 'Short-Form Video AI Dubbing', category: 'Marketing', trendScore: 89, growth: 95.4, competition: 'Medium', opportunity: 91, hook: 'Localizing short-form video content used to cost thousands. AI Dubbing does it in 1 click...' },
  { id: 'tr5', topic: 'Next.js 19 and Server Actions', category: 'Tech', trendScore: 95, growth: 110.2, competition: 'High', opportunity: 92, hook: 'Next.js 19 Server Actions completely change how we manage state. 3 playbooks you need to know:' },
  { id: 'tr6', topic: 'Bootstrapping without VC funding', category: 'Business', trendScore: 90, growth: 64.8, competition: 'Low', opportunity: 93, hook: 'VC funding is dry. But the best indie companies are thriving by being bootstrapped. The rules:' }
]

import { useEffect } from 'react'

export default function TrendingTopics() {
  const navigate = useNavigate()
  const [activeCategory, setActiveCategory] = useState('AI')
  const [searchQuery, setSearchQuery] = useState('')
  const [successToast, setSuccessToast] = useState('')
  const [trends, setTrends] = useState([])
  const [loading, setLoading] = useState(false)

  const showToast = (msg) => {
    setSuccessToast(msg)
    setTimeout(() => setSuccessToast(''), 3000)
  }

  useEffect(() => {
    let active = true
    const loadTrends = async () => {
      setLoading(true)
      try {
        const res = await aiGetTrendingTopics(activeCategory)
        if (active && res.success && res.data) {
          const enriched = res.data.map((item, idx) => ({
            id: `tr_${activeCategory}_${idx}`,
            topic: item.topic,
            category: activeCategory,
            trendScore: item.trendScore,
            growth: item.growth,
            competition: item.competition,
            opportunity: item.opportunityScore || item.opportunity || 90,
            hook: `Here is the truth about ${item.topic}: Most creators get it completely wrong. Here is the exact breakdown of how we built it:`
          }))
          setTrends(enriched)
        }
      } catch (err) {
        console.error(err)
        // Fallback to client-side MOCK_TRENDS for robustness if api fails
        if (active) {
          const catTrends = MOCK_TRENDS.filter(t => t.category === activeCategory)
          setTrends(catTrends)
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    loadTrends()
    return () => { active = false }
  }, [activeCategory])

  const handleGenerateTweet = (trend) => {
    showToast(`Drafting tweet for "${trend.topic}"...`)
    setTimeout(() => {
      navigate('/new-tweet', { state: { content: `${trend.hook} \n\n#${trend.category.toLowerCase()} #${trend.topic.replace(/\s+/g, '')}` } })
    }, 800)
  }

  const handleGenerateThread = (trend) => {
    showToast(`Drafting thread for "${trend.topic}"...`)
    setTimeout(() => {
      navigate('/threads', { state: { content: `1/ ${trend.hook} \n\n#${trend.category.toLowerCase()} \n\n2/ Node detailing key ${trend.topic} stats...` } })
    }, 800)
  }

  // Filter trends based on active category and search query
  const filteredTrends = trends.filter(t => {
    const matchesSearch = t.topic.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch
  })


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
            X Trending Topics Snapshot
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Identify real-time algorithmic shifts. Track growth trajectories and draft viral tweets on under-covered topics.
          </p>
        </div>

        <div className="flex border border-gray-100 rounded-xl p-0.5 bg-white shadow-xs">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3.5 h-8 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeCategory === cat ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Search Bar Panel */}
      <div className="flex items-center gap-3 max-w-md w-full border border-gray-100 bg-white px-3.5 py-2.5 rounded-xl shadow-sm focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400/20 transition">
        <Search className="w-4 h-4 text-gray-400 shrink-0" />
        <input
          type="text"
          placeholder={`Search trending topics in ${activeCategory}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-transparent border-0 outline-0 text-xs text-gray-700 placeholder-gray-400 font-medium"
        />
      </div>

      {/* Datatable Wrapper */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-2">
            <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
            <p className="text-xs text-gray-500 font-bold">Scanning active X algorithm opportunities...</p>
          </div>
        ) : filteredTrends.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-50 text-gray-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">No active trends found</p>
              <p className="text-xs text-gray-400">Change your category selections or search query.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <th className="pb-3.5 pl-2">Opportunity Topic</th>
                  <th className="pb-3.5">Trend Score</th>
                  <th className="pb-3.5">Growth % (24h)</th>
                  <th className="pb-3.5">Competition</th>
                  <th className="pb-3.5">Opportunity Index</th>
                  <th className="pb-3.5 pr-2 text-right">Quick AI Draft</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-xs font-semibold text-gray-700">
                {filteredTrends.map((trend) => (
                  <tr key={trend.id} className="hover:bg-gray-50/30 transition">
                    <td className="py-4 pl-2 font-bold text-gray-900">
                      {trend.topic}
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-gray-800">{trend.trendScore}</span>
                        <div className="w-16 bg-gray-100 h-1.5 rounded-full overflow-hidden shrink-0">
                          <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${trend.trendScore}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="py-4 text-green-600 font-extrabold flex items-center gap-0.5">
                      <TrendingUp className="w-3 h-3" /> +{trend.growth}%
                    </td>
                    <td className="py-4">
                      <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        trend.competition === 'Low' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'
                      }`}>
                        {trend.competition} Competition
                      </span>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-1 text-emerald-600 font-extrabold">
                        <Award className="w-3.5 h-3.5" />
                        {trend.opportunity} / 100
                      </div>
                    </td>
                    <td className="py-4 pr-2 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => handleGenerateTweet(trend)}
                          className="flex h-7 px-2.5 items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[9px] font-bold cursor-pointer transition shadow-xs"
                        >
                          <Plus className="w-2.5 h-2.5" /> Tweet
                        </button>
                        <button
                          onClick={() => handleGenerateThread(trend)}
                          className="flex h-7 px-2.5 items-center gap-1 border border-indigo-200 text-indigo-600 hover:bg-indigo-50 bg-white rounded-lg text-[9px] font-bold cursor-pointer transition"
                        >
                          <Zap className="w-2.5 h-2.5" /> Thread
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Guide/Tip card */}
      <div className="bg-blue-50/20 border border-blue-100/50 rounded-2xl p-5 shadow-inner flex gap-3.5 items-start">
        <HelpCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-blue-900">How to Capitalize on Opportunity Scores</h4>
          <p className="text-[10px] text-blue-700 leading-relaxed font-medium">
            Opportunity Scores reflect algorithmic gaps where user search growth is skyrocketing but existing competition is low or medium. Drafting structured case studies or educational listicles on topics with scores above 90 is the highest leverage action to gain organic algorithmic discovery!
          </p>
        </div>
      </div>
    </div>
  )
}
