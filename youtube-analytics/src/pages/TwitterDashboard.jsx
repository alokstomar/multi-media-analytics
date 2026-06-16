import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Clock,
  MessageSquare,
  Sparkles,
  Zap,
  TrendingUp,
  UserCheck,
  CheckCircle,
  Play,
  Trash2,
  ExternalLink,
  Plus
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  getTwitterAccounts,
  getTwitterDashboardStats,
  getTwitterScheduled,
  getPublishedPosts,
  getTwitterRules,
  aiGetViralOpportunities,
  getStudioPosts,
  deleteStudioPost,
  publishTwitterScheduled
} from '../services/api'

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

export default function TwitterDashboard() {
  const navigate = useNavigate()

  const [accounts, setAccounts] = useState([])
  const [drafts, setDrafts] = useState([])
  const [scheduled, setScheduled] = useState([])
  const [published, setPublished] = useState([])
  const [automations, setAutomations] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [stats, setStats] = useState({ totalTweets: 0, scheduledPosts: 0, activeAutomations: 0, forecast: 'High' })

  const loadAllData = async () => {
    try {
      const statsRes = await getTwitterDashboardStats()
      if (statsRes?.success) setStats(statsRes.data)

      const accRes = await getTwitterAccounts()
      if (accRes?.success) setAccounts(accRes.data)

      const schedRes = await getTwitterScheduled()
      if (schedRes?.success) setScheduled(schedRes.data)

      const pubRes = await getPublishedPosts({ platform: 'twitter' })
      if (pubRes?.success) setPublished(pubRes.data)

      const autoRes = await getTwitterRules()
      if (autoRes?.success) setAutomations(autoRes.data)

      const draftsRes = await getStudioPosts({ platform: 'twitter', status: 'draft' })
      if (draftsRes?.success) setDrafts(draftsRes.data)

      const sugRes = await aiGetViralOpportunities('AI')
      if (sugRes?.success && sugRes.data) {
        setSuggestions(sugRes.data.slice(0, 2).map((item, idx) => ({
          id: `su_${idx}`,
          hook: item.title,
          body: item.angle || 'High bookmark potential.',
          category: item.impact || 'Viral Idea'
        })))
      }
    } catch (err) {
      console.error('Failed to load Twitter Dashboard data:', err)
    }
  }

  useEffect(() => {
    loadAllData()
  }, [])

  // Handle post immediately action
  const handlePublishNow = async (id) => {
    try {
      const res = await publishTwitterScheduled(id)
      if (res?.success) {
        await loadAllData()
      }
    } catch (err) {
      alert(`Publishing failed: ${err.message}`)
    }
  }

  // Handle delete draft
  const handleDeleteDraft = async (id) => {
    if (window.confirm('Are you sure you want to delete this draft?')) {
      try {
        const res = await deleteStudioPost(id)
        if (res?.success) {
          setDrafts(drafts.filter(d => d._id !== id))
        }
      } catch (err) {
        console.error(err)
      }
    }
  }


  return (
    <div className="min-h-screen bg-gray-50/50 space-y-8">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-black text-white">
              <TwitterIcon className="h-4 w-4" fill="currentColor" />
            </span>
            X Automation Workspace
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Control center for scheduling, thread composition, and background automation loops.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => navigate('/threads')}
            className="flex items-center gap-2 h-10 px-4 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 text-xs font-semibold cursor-pointer transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Write Thread
          </button>
          <button
            onClick={() => navigate('/new-tweet')}
            className="flex items-center gap-2 h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer transition shadow-sm shadow-blue-500/10"
          >
            <Plus className="w-3.5 h-3.5" />
            Write Tweet
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:scale-[1.01] hover:shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Tweets</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{stats.totalTweets || 0}</p>
              <p className="mt-1 text-xs font-medium text-green-600 flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" /> +12.4% this week
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-inner">
              <TwitterIcon className="h-5 w-5" fill="currentColor" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:scale-[1.01] hover:shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Scheduled Posts</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{stats.scheduledPosts || 0}</p>
              <p className="mt-1 text-xs font-medium text-gray-500">Next: Today at 6:30 PM</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 shadow-inner">
              <Clock className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:scale-[1.01] hover:shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Engagement Forecast</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{stats.forecast || 'High'}</p>
              <p className="mt-1 text-xs font-medium text-green-600 flex items-center gap-0.5">
                +18.2% projected reach
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600 shadow-inner">
              <Sparkles className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:scale-[1.01] hover:shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active Automations</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">
                {stats.activeAutomations || 0} / {automations.length}
              </p>
              <p className="mt-1 text-xs font-medium text-indigo-600">Background tasks live</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-50 text-pink-600 shadow-inner">
              <Zap className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>


      {/* Main Layout Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Columns - 2 Span */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Scheduled & Published Tabs Grid */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              Scheduled Tweets Queue ({scheduled.length})
            </h3>
            
            {scheduled.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">No tweets scheduled. Draft something new to fill up the queue!</p>
            ) : (
              <div className="space-y-3">
                {scheduled.map((item) => (
                  <div key={item._id} className="p-4 bg-gray-50/70 border border-gray-100 rounded-xl flex justify-between gap-4 items-start">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-gray-800 leading-relaxed">{item.content}</p>
                      <span className="inline-block text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                        {new Date(item.scheduledAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handlePublishNow(item._id)}
                        className="flex h-7 px-2.5 items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold cursor-pointer transition"
                      >
                        <Play className="w-2.5 h-2.5 fill-current" />
                        Publish
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Published Today Section */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              Published Today
            </h3>

            <div className="space-y-3">
              {published.length === 0 ? (
                <p className="text-xs text-gray-400 py-4 text-center">No tweets published today.</p>
              ) : (
                published.map((item) => (
                  <div key={item._id} className="p-4 border border-gray-100 rounded-xl space-y-3">
                    <div className="flex justify-between items-start gap-4">
                      <p className="text-xs font-medium text-gray-800 leading-relaxed">{item.content}</p>
                      <span className="text-[10px] font-medium text-gray-400 shrink-0">
                        {new Date(item.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex gap-5 border-t border-gray-50 pt-2 text-[10px] font-semibold text-gray-500">
                      <span className="flex items-center gap-1">📊 {item.responsePayload?.views || '1.2K'} Views</span>
                      <span className="flex items-center gap-1">❤️ {item.responsePayload?.likes || 45} Likes</span>
                      <span className="flex items-center gap-1">🔁 {item.responsePayload?.retweets || 12} Retweets</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Draft Tweets section */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-600" />
                Recent Draft Tweets ({drafts.length})
              </h3>
              <button onClick={() => navigate('/drafts')} className="text-xs font-bold text-blue-600 hover:underline">
                View All
              </button>
            </div>

            {drafts.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">No drafts saved.</p>
            ) : (
              <div className="space-y-3">
                {drafts.map((item) => {
                  const contentText = item.content?.fullText || item.content?.body || item.content;
                  return (
                    <div key={item._id} className="p-4 bg-gray-50/70 border border-gray-100 rounded-xl flex justify-between gap-4 items-center">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-gray-800 truncate">{contentText}</p>
                        <span className="text-[9px] text-gray-400">
                          Updated {new Date(item.updatedAt || item.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => navigate('/new-tweet', { state: { content: contentText } })}
                          className="flex h-7 px-2.5 items-center bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-[10px] font-bold cursor-pointer transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteDraft(item._id)}
                          className="flex h-7 w-7 items-center justify-center text-red-500 hover:bg-red-50 rounded-lg cursor-pointer transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>


        </div>

        {/* Right Columns - 1 Span */}
        <div className="space-y-6">
          
          {/* Connected Accounts Card */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              Connected Accounts
            </h3>

            <div className="space-y-3">
              {accounts.map((acc) => (
                <div key={acc._id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                      {(acc.displayName || acc.username || 'X')[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-800 truncate flex items-center gap-1">
                        {acc.displayName || acc.username}
                        {acc.verified && <CheckCircle className="w-3.5 h-3.5 text-blue-500 fill-blue-500 text-white" />}
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">@{acc.username}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-bold text-gray-700">{acc.followers || '12.5K'}</p>
                    <span className="text-[9px] font-medium text-emerald-600">{acc.connectionStatus || 'connected'}</span>
                  </div>
                </div>
              ))}
            </div>
            
            <button
              onClick={() => navigate('/channels')}
              className="w-full h-9 bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-600 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              Manage Accounts <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          {/* Automation Rules Status Card */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Zap className="w-4 h-4 text-pink-500" />
              Active Automation Rules
            </h3>

            <div className="space-y-3">
              {automations.map((aut) => (
                <div key={aut._id} className="p-3 border border-gray-100 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-gray-800">{aut.name}</p>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      aut.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {aut.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400">Trigger: {aut.trigger}</p>
                </div>
              ))}
            </div>


            <button
              onClick={() => navigate('/automation-rules')}
              className="w-full h-9 bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-600 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-center"
            >
              Configure Automation Rules
            </button>
          </div>

          {/* AI Suggestions & Hooks Card */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-500" />
              AI Suggestions
            </h3>

            <div className="space-y-3">
              {suggestions.map((sug) => (
                <div key={sug.id} className="p-3 bg-blue-50/20 border border-blue-100/50 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                      {sug.category}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-gray-800 italic">"{sug.hook}"</p>
                  <p className="text-[10px] text-gray-500 leading-relaxed">{sug.body}</p>
                  <button
                    onClick={() => navigate('/new-tweet', { state: { content: `${sug.hook} \n\n` } })}
                    className="h-7 w-full border border-blue-200 text-blue-600 hover:bg-blue-50 bg-white rounded-lg text-[10px] font-bold cursor-pointer transition flex items-center justify-center gap-1"
                  >
                    Use as Hook
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
