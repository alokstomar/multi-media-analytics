import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Layers,
  Search,
  Plus,
  SlidersHorizontal,
  ChevronDown,
  Clock,
  Send,
  FileText,
  Sparkles,
  CheckCircle,
  Copy,
  PlusCircle,
  ArrowRight,
  TrendingUp,
  RefreshCw
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getStudioPosts } from '../services/api'

const LinkedInIcon = (props) => (
  <svg
    className={props.className || "h-4 w-4"}
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
  </svg>
)

const MOCK_ITEMS = [
  { id: 'lib_d1', title: 'Why automation is the leverage of 2026', content: 'In 2026, you don\'t compete on simple hourly inputs. You compete on workflow leverage. Automated check-lists syndicate value while you sleep. Here is the blueprint:', type: 'Draft', cat: 'Thought Leadership', date: 'Yesterday' },
  { id: 'lib_d2', title: 'LinkedIn SSI Growth playbook', content: 'Our Social Selling Index (SSI) crossed 82 points this week. The 3 rules we followed: (1) industry insight posts twice weekly, (2) visual architecture diagrams, (3) regular authority comments:', type: 'Draft', cat: 'Industry Insight', date: '2 days ago' },
  
  { id: 'lib_s1', title: '5 frameworks to structure B2B carousels', content: '5 frameworks to structure high-converting LinkedIn carousel hooks in 2026. 🧵👇\n\n1/ The hook must disrupt traditional patterns...\n2/ Structure is everything...', type: 'Scheduled', cat: 'Personal Post', date: 'Tomorrow @ 09:00 AM' },
  { id: 'lib_s2', title: 'B2B SaaS marketing is completely broken', content: 'Why traditional B2B SaaS marketing is completely broken. (The compounding playbooks we are using instead):\n\nStop paying for lead forms. Build developer tools.', type: 'Scheduled', cat: 'Story Post', date: 'Wed @ 02:00 PM' },
  
  { id: 'lib_p1', title: 'Syndicating leverage checklists', content: 'Building a leveraged social engine is not about automated spam. It is about syndicating data blueprints into visual checklists. 📊👇', type: 'Published', cat: 'Thought Leadership', date: 'Yesterday' },
  { id: 'lib_p2', title: 'Production release Phase 3 AI', content: 'Our engineering team just pushed Phase 3 AI capabilities live to production! Here is the full case study on how we reduced Vite Rollups to 1.9s:', type: 'Published', cat: 'Industry Insight', date: '2 days ago' },

  { id: 'lib_t1', title: 'B2B Case Study Blueprint', content: 'Detailed outline to draft authoritative B2B success roadmaps:\n\n[DISRUPTIVE HOOK]\n\n[THE CORE PROBLEM]\n\n[THE METRIC GAINED]\n\n[ACTIONABLE LIST]', type: 'Template', cat: 'Industry Insight', date: 'System Preset' },
  { id: 'lib_t2', title: 'Contrarian Debate Builder', content: 'Structure to post contrarian but backed opinions:\n\n[TRADITIONAL THESIS]\n\n[WHY IT FAILS IN 2026]\n\n[OUR BLUEPRINT PROOF]\n\n[CALL TO ACTION]', type: 'Template', cat: 'Thought Leadership', date: 'System Preset' }
]

const TABS = ['Drafts', 'Scheduled', 'Published', 'Templates']

export default function LinkedInContentLibrary() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('Drafts')
  const [searchQuery, setSearchQuery] = useState('')
  const [catFilter, setCatFilter] = useState('All')
  const [sortBy, setSortBy] = useState('Newest')
  const [successToast, setSuccessToast] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)

  const showToast = (msg) => {
    setSuccessToast(msg)
    setTimeout(() => setSuccessToast(''), 3000)
  }

  // Load from DB
  const loadLibrary = async () => {
    setLoading(true)
    try {
      const res = await getStudioPosts({ platform: 'linkedin' })
      if (res?.success && res.data) {
        const dbItems = res.data.map(p => {
          let mappedType = 'Draft'
          if (p.status === 'scheduled') mappedType = 'Scheduled'
          else if (p.status === 'published') mappedType = 'Published'

          return {
            id: p._id,
            title: p.topic || 'Untitled Post Outline',
            content: p.content?.fullText || p.content?.body || '',
            type: mappedType,
            cat: p.type || 'Thought Leadership',
            date: p.scheduledAt ? new Date(p.scheduledAt).toLocaleString() : (p.publishedAt ? new Date(p.publishedAt).toLocaleString() : 'Recent')
          }
        })

        // Merge with static presets
        const filteredTemplates = MOCK_ITEMS.filter(item => item.type === 'Template')
        const filteredDrafts = MOCK_ITEMS.filter(item => item.type === 'Draft')
        
        // If DB has values, merge them
        if (dbItems.length > 0) {
          setItems([...dbItems, ...filteredTemplates])
        } else {
          setItems(MOCK_ITEMS)
        }
      } else {
        setItems(MOCK_ITEMS)
      }
    } catch {
      setItems(MOCK_ITEMS)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLibrary()
  }, [])

  // Action: use outline in composer
  const handleUseOutline = (item) => {
    showToast(`Loading outline for "${item.title}"...`)
    setTimeout(() => {
      navigate('/linkedin/new-post', { state: { content: item.content, title: item.title } })
    }, 800)
  }

  // Filters application
  const filteredItems = items.filter(item => {
    const matchesTab = item.type === activeTab
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || item.content.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCat = catFilter === 'All' ? true : item.cat === catFilter
    return matchesTab && matchesSearch && matchesCat
  })

  // Retrieve unique categories for filter
  const categories = ['All', 'Thought Leadership', 'Industry Insight', 'Personal Post', 'Story Post']

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
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0077b5] text-white">
              <LinkedInIcon className="h-4.5 w-4.5" />
            </span>
            LinkedIn Content Library
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            A unified central repository for drafts, scheduled lists, published indices, and structured creator blueprints.
          </p>
        </div>

        <button
          onClick={() => navigate('/linkedin/new-post')}
          className="flex items-center gap-2 h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer transition shadow-sm shadow-blue-500/10 self-start sm:self-center"
        >
          <Plus className="w-3.5 h-3.5" />
          Create New Post
        </button>
      </div>

      {/* Toolbar controls */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Tab selector */}
          <div className="flex border border-gray-100 rounded-xl p-0.5 bg-gray-50/50 self-start">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3.5 h-8 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeTab === tab ? 'bg-white text-gray-800 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Search, Filter, Sort toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="flex items-center gap-2 max-w-xs w-full border border-gray-100 bg-gray-50/50 px-3.5 py-1.5 rounded-xl focus-within:border-blue-400 focus-within:bg-white focus-within:ring-1 focus-within:ring-blue-400/20 transition">
              <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder={`Search ${activeTab.toLowerCase()}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-0 outline-0 text-xs text-gray-700 placeholder-gray-400 font-medium"
              />
            </div>

            {/* Category dropdown */}
            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              className="h-9 px-3 rounded-xl border border-gray-100 text-xs font-semibold text-gray-600 bg-white outline-none cursor-pointer"
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            {/* Sort dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-9 px-3 rounded-xl border border-gray-100 text-xs font-semibold text-gray-600 bg-white outline-none cursor-pointer"
            >
              <option value="Newest">Newest</option>
              <option value="Oldest">Oldest</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid Deck */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-2 bg-white border border-gray-100 rounded-2xl p-6">
          <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
          <p className="text-xs text-gray-500 font-semibold">Opening central library records...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-2 bg-white border border-gray-100 rounded-2xl p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-50 text-gray-400 mx-auto">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">No content items matching filters</p>
            <p className="text-xs text-gray-400">Add drafts or custom presets to build your repository.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredItems.map(item => (
            <div key={item.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex flex-col justify-between hover:border-gray-200 hover:shadow-md transition duration-200">
              <div className="space-y-3.5">
                <div className="flex justify-between items-start gap-2">
                  <span className="inline-block text-[8px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 uppercase tracking-wider">
                    {item.cat}
                  </span>
                  <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">
                    {item.date}
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-xs font-extrabold text-gray-900 leading-snug">{item.title}</h3>
                  <p className="text-[10px] text-gray-500 font-semibold leading-relaxed whitespace-pre-wrap">{item.content.substring(0, 180)}...</p>
                </div>
              </div>

              <div className="flex justify-end pt-4 mt-2 border-t border-gray-50 shrink-0">
                <button
                  onClick={() => handleUseOutline(item)}
                  className="flex h-7 px-3.5 items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[9px] font-bold cursor-pointer transition shadow-xs"
                >
                  <PlusCircle className="w-3.5 h-3.5" /> Use Blueprint
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
