import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Globe,
  Clock,
  Send,
  Plus,
  Users,
  CheckCircle,
  TrendingUp,
  Sparkles,
  Activity,
  Award,
  Calendar,
  MessageSquare,
  ChevronRight,
  RefreshCw,
  FileText,
  Sliders
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getStudioPosts, getConnectedAccounts } from '../services/api'

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

const MOCK_RECENT = [
  { id: 'l1', content: 'Building a leveraged social engine is not about automated spam. It is about syndicating data blueprints into visual checklists. 📊👇', type: 'Thought Leadership', stats: { likes: 245, comments: 42, reposts: 18 }, postedAt: 'Yesterday' },
  { id: 'l2', content: 'Our engineering team just pushed Phase 3 AI capabilities live to production! Here is the full case study on how we reduced Vite Rollups to 1.9s:', type: 'Industry Insight', stats: { likes: 489, comments: 84, reposts: 32 }, postedAt: '2 days ago' }
]

const MOCK_SCHEDULED = [
  { id: 'ls1', content: '5 frameworks to structure high-converting LinkedIn carousel hooks in 2026. 🧵👇', type: 'Personal Post', time: 'Tomorrow at 09:00 AM' },
  { id: 'ls2', content: 'Why traditional B2B SaaS marketing is completely broken. (The compounding playbooks we are using instead):', type: 'Story Post', time: 'Wed at 02:00 PM' }
]

export default function LinkedInDashboard() {
  const navigate = useNavigate()
  const [recentPosts, setRecentPosts] = useState(MOCK_RECENT)
  const [scheduledPosts, setScheduledPosts] = useState(MOCK_SCHEDULED)
  const [accountsCount, setAccountsCount] = useState(1)
  const [loading, setLoading] = useState(false)
  const [successToast, setSuccessToast] = useState('')

  const showToast = (msg) => {
    setSuccessToast(msg)
    setTimeout(() => setSuccessToast(''), 3000)
  }

  // Load from DB
  useEffect(() => {
    let active = true
    const loadDBStats = async () => {
      try {
        const [postsRes, accsRes] = await Promise.all([
          getStudioPosts({ platform: 'linkedin' }),
          getConnectedAccounts('linkedin')
        ])
        
        if (active) {
          if (accsRes?.success && accsRes.data?.length > 0) {
            setAccountsCount(accsRes.data.length)
          }
          if (postsRes?.success && postsRes.data?.length > 0) {
            // Populate scheduled list from DB if items exist
            const dbSched = postsRes.data
              .filter(p => p.status === 'scheduled')
              .map(p => ({
                id: p._id,
                content: p.content?.fullText || p.content?.body || 'LinkedIn Draft Post',
                type: p.type || 'Thought Leadership',
                time: p.scheduledAt ? new Date(p.scheduledAt).toLocaleString() : 'Pending schedule'
              }))
            if (dbSched.length > 0) setScheduledPosts(dbSched)
          }
        }
      } catch (err) {
        console.error(err)
      }
    }
    loadDBStats()
    return () => { active = false }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50/50 space-y-8 pb-12">
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
            LinkedIn Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Analyze professional impressions, draft thought-leadership updates, and organize your publication schedule.
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

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Connected Accounts</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{accountsCount}</p>
              <p className="mt-1 text-xs font-medium text-blue-600">Active LinkedIn Profiles</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-inner">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Scheduled Posts</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{scheduledPosts.length}</p>
              <p className="mt-1 text-xs font-medium text-emerald-600 flex items-center gap-0.5">
                <Clock className="w-3 h-3" /> Queued dispatches
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 shadow-inner">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Published (Month)</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">12</p>
              <p className="mt-1 text-xs font-medium text-indigo-600">Active pacing index</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 shadow-inner">
              <Send className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Engagement Forecast</p>
              <p className="mt-1.5 text-2xl font-bold text-purple-600">92%</p>
              <p className="mt-1 text-xs font-medium text-purple-600 flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" /> Excellent algorithm score
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 shadow-inner">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Lead Potential Score</p>
              <p className="mt-1.5 text-2xl font-bold text-pink-600">94%</p>
              <p className="mt-1 text-xs font-medium text-pink-600 flex items-center gap-0.5">
                <Award className="w-3 h-3" /> Outstanding conversions
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-50 text-pink-600 shadow-inner">
              <Award className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Main split dashboard view */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        
        {/* Left main: Recent & Scheduled Posts (3 columns wide) */}
        <div className="xl:col-span-3 space-y-6">
          
          {/* Scheduled Posts Workspace */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-500" />
                Upcoming Scheduled Updates
              </h3>
              <button
                onClick={() => navigate('/linkedin/content-library')}
                className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer flex items-center gap-0.5"
              >
                Content Library <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {scheduledPosts.length === 0 ? (
              <div className="py-12 text-center text-gray-400 space-y-1.5 border border-dashed border-gray-100 rounded-xl bg-gray-50/10">
                <FileText className="w-6 h-6 mx-auto text-gray-300 animate-pulse" />
                <p className="text-[10px] font-semibold text-gray-700">No scheduled LinkedIn updates queued</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {scheduledPosts.map(sp => (
                  <div key={sp.id} className="p-4 bg-gray-50/50 border border-gray-100 rounded-xl space-y-3 flex flex-col justify-between hover:border-gray-200 transition">
                    <div className="space-y-2">
                      <span className="inline-block text-[8px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 uppercase tracking-wider">{sp.type}</span>
                      <p className="text-xs font-semibold text-gray-800 leading-relaxed truncate">{sp.content}</p>
                    </div>
                    <div className="flex justify-between items-center text-[8px] text-gray-400 pt-2 border-t border-gray-100/50">
                      <span className="font-semibold text-gray-500">{sp.time}</span>
                      <button onClick={() => navigate('/linkedin/new-post')} className="text-blue-600 hover:underline">Edit</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Published Posts Table */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[#0077b5]" />
              Recent Publications & Analytics
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    <th className="pb-3.5 pl-2">Post Outline</th>
                    <th className="pb-3.5">Category Type</th>
                    <th className="pb-3.5">Likes</th>
                    <th className="pb-3.5">Comments</th>
                    <th className="pb-3.5">Reposts</th>
                    <th className="pb-3.5 pr-2 text-right">Published</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-xs font-semibold text-gray-700">
                  {recentPosts.map((post) => (
                    <tr key={post.id} className="hover:bg-gray-50/30 transition">
                      <td className="py-4 pl-2 font-bold text-gray-900 max-w-[280px] truncate">
                        {post.content}
                      </td>
                      <td className="py-4">
                        <span className="text-[9px] font-bold text-blue-600 bg-blue-50/40 px-2 py-0.5 rounded">
                          {post.type}
                        </span>
                      </td>
                      <td className="py-4 font-bold text-gray-800">{post.stats.likes}</td>
                      <td className="py-4 font-bold text-gray-800">{post.stats.comments}</td>
                      <td className="py-4 font-bold text-gray-800">{post.stats.reposts}</td>
                      <td className="py-4 pr-2 text-right text-gray-400 font-medium">{post.postedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right main: Recommendations & Health (1 column wide) */}
        <div className="space-y-6">
          
          {/* AI recommendations */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
              AI Insights
            </h3>

            <div className="space-y-3.5">
              <div className="p-3.5 bg-blue-50/20 border border-blue-100/50 rounded-xl space-y-1">
                <span className="text-[8px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-wider">Best posting window</span>
                <p className="text-xs font-bold text-gray-800 mt-1">Tuesdays @ 10:00 AM</p>
                <p className="text-[9px] text-gray-500 font-medium">Optimal mid-morning professional B2B timeline feeds.</p>
              </div>

              <div className="p-3.5 bg-blue-50/20 border border-blue-100/50 rounded-xl space-y-1">
                <span className="text-[8px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-wider">Growth recommendation</span>
                <p className="text-xs font-bold text-gray-800 mt-1">Include visual roadmaps</p>
                <p className="text-[9px] text-gray-500 font-medium">Step-by-step frameworks achieve 3.2x higher bookmarks.</p>
              </div>
            </div>
          </div>

          {/* Account Health card */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-emerald-500" />
              Account Health Index
            </h3>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-[10px] font-bold text-gray-500">
                <span>Profile SSI Score</span>
                <span className="text-emerald-600">82 / 100</span>
              </div>
              <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '82%' }} />
              </div>
              <p className="text-[9px] text-gray-400 leading-relaxed font-medium pt-1">Your Social Selling Index (SSI) is in the top 3% of your industry sector. Keep engaging regularly!</p>
            </div>
          </div>

        </div>

      </div>

    </div>
  )
}
