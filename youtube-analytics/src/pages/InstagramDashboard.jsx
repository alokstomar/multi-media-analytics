/**
 * @deprecated Phase 2 (Instagram platform-switcher migration) — this page is
 * no longer routed. The Instagram Dashboard is now rendered by the dedicated
 * `components/instagram/InstagramDashboardOverview.jsx`, invoked as an
 * early-return branch from `pages/Dashboard.jsx` when
 * `selectedPlatform === 'instagram'`.
 *
 * This file is retained intentionally for rollback / reference. Do not add
 * new features here. Any changes should go in the new component or the
 * `useInstagramAdapter` adapter.
 */

import { useState, useEffect } from 'react'
import {
  Users,
  Video,
  MessageSquare,
  Sparkles,
  RefreshCw,
  Search,
  AlertCircle,
  TrendingUp,
  Heart,
  Eye,
  Play,
  Zap,
  Lock
} from 'lucide-react'
import {
  getInstagramProfile,
  getInstagramReels,
  getInstagramProfileAnalytics,
  getInstagramComments,
  syncInstagram,
  triggerInstagramAIRecommendations
} from '../services/api'

export default function InstagramDashboard() {
  const [usernameInput, setUsernameInput] = useState('mock_instagram_creator')
  const [activeUsername, setActiveUsername] = useState('mock_instagram_creator')
  const [activeTab, setActiveTab] = useState('overview') // overview, reels, comments, intelligence

  // Core data states
  const [profile, setProfile] = useState(null)
  const [reels, setReels] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [aiRecs, setAiRecs] = useState(null)
  
  // Selected Reel for comments view
  const [selectedReelId, setSelectedReelId] = useState('')
  const [comments, setComments] = useState([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all')

  // Status states
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState('')

  // Sync / fetch all core data
  const fetchData = async (username, force = false) => {
    console.log('[InstagramDashboard] Username submitted:', username, 'forceSync:', force)
    setLoading(true)
    setError('')
    try {
      // 1. Fetch Profile
      const profRes = await getInstagramProfile(username, force)
      console.log('[InstagramDashboard] Profile API response:', profRes)
      setProfile(profRes.data)

      // 2. Fetch Reels
      const reelsRes = await getInstagramReels(username, force)
      console.log('[InstagramDashboard] Reels API response:', reelsRes)
      setReels(reelsRes.data)
      if (reelsRes.data?.length > 0) {
        setSelectedReelId(reelsRes.data[0].reelId)
      }

      // 3. Fetch Analytics snapshot
      const analyticsRes = await getInstagramProfileAnalytics(username, force)
      console.log('[InstagramDashboard] Analytics API response:', analyticsRes)
      setAnalytics(analyticsRes.data)

      // Reset AI recommendations on switching users
      setAiRecs(null)
    } catch (err) {
      console.error('[InstagramDashboard] API Error:', err)
      setError(err.response?.data?.message || 'Failed to fetch Instagram analytics. Make sure backend is running.')
    } finally {
      setLoading(false)
    }
  }

  // Load comments for the selected Reel
  const fetchCommentsForReel = async (reelId) => {
    if (!reelId) return
    setCommentsLoading(true)
    try {
      const res = await getInstagramComments(reelId)
      setComments(res.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setCommentsLoading(false)
    }
  }

  useEffect(() => {
    fetchData(activeUsername)
  }, [activeUsername])

  useEffect(() => {
    if (selectedReelId) {
      fetchCommentsForReel(selectedReelId)
    }
  }, [selectedReelId])

  // Temporary logging for dashboard state updates
  useEffect(() => {
    console.log('[InstagramDashboard] State updated - Profile:', profile)
  }, [profile])

  useEffect(() => {
    console.log('[InstagramDashboard] State updated - Reels:', reels)
  }, [reels])

  useEffect(() => {
    console.log('[InstagramDashboard] State updated - Analytics:', analytics)
  }, [analytics])

  useEffect(() => {
    console.log('[InstagramDashboard] State updated - Comments:', comments)
  }, [comments])

  useEffect(() => {
    console.log('[InstagramDashboard] State updated - AI Recommendations:', aiRecs)
  }, [aiRecs])

  // Trigger manual full data sync
  const handleManualSync = async () => {
    setSyncing(true)
    setError('')
    try {
      await syncInstagram(activeUsername)
      await fetchData(activeUsername, true)
    } catch (err) {
      setError('Sync failed: ' + (err.response?.data?.message || err.message))
    } finally {
      setSyncing(false)
    }
  }

  // Trigger manual AI Recommendations generation
  const handleTriggerAI = async () => {
    setAiLoading(true)
    try {
      const res = await triggerInstagramAIRecommendations(activeUsername)
      setAiRecs(res.data)
    } catch (err) {
      setError('AI recommendation compilation failed: ' + (err.response?.data?.message || err.message))
    } finally {
      setAiLoading(false)
    }
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    if (usernameInput.trim()) {
      setActiveUsername(usernameInput.trim())
    }
  }

  // Stat formatting helpers
  const formatNumber = (num) => {
    if (!num) return '0'
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toLocaleString()
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & User input controller */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-white/60 backdrop-blur-xl border border-gray-100 rounded-2xl shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-pink-500 text-white shadow-sm">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
            </span>
            Instagram Intelligence
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Analyze profile statistics, Reels, comments sentiment, and trigger AI suggestions.
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="text"
              placeholder="Enter Instagram username..."
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              className="w-56 pl-10 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 transition-all shadow-inner"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition shadow-sm cursor-pointer"
          >
            Analyze
          </button>
          <button
            type="button"
            onClick={handleManualSync}
            disabled={syncing || loading}
            className="p-2 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition cursor-pointer flex items-center justify-center"
            title="Sync all profile and media data"
          >
            <RefreshCw className={`h-4.5 w-4.5 ${syncing ? 'animate-spin text-pink-500' : ''}`} />
          </button>
        </form>
      </div>

      {/* Error fallback alert */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50/80 border border-red-100 rounded-xl text-red-700">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {loading ? (
        /* SKELETON LOADING STATE */
        <div className="space-y-6 animate-pulse">
          <div className="h-32 bg-gray-200 rounded-2xl" />
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl" />
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded-2xl" />
        </div>
      ) : (!profile || profile.isMock) ? (
        /* EMPTY STATE */
        <div className="text-center py-20 bg-white/60 border border-gray-100 rounded-2xl shadow-sm max-w-xl mx-auto space-y-4">
          <div className="h-16 w-16 bg-pink-50 text-pink-500 rounded-full flex items-center justify-center mx-auto text-xl font-bold shadow-inner">
            📸
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">No analytics available</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
              Real Instagram provider data is not available. Please verify your API configuration.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* PROFILE CARD */}
          <div className="relative p-6 bg-white/60 border border-gray-100 rounded-2xl shadow-sm flex flex-col md:flex-row items-center md:items-start gap-6">
            <img
              src={profile.profilePic || `https://ui-avatars.com/api/?name=${profile.username}&background=FF007F&color=fff&size=150`}
              alt={profile.username}
              className="h-20 w-20 rounded-2xl object-cover border border-gray-100 shadow-md shrink-0 bg-pink-100"
            />
            <div className="flex-1 text-center md:text-left min-w-0">
              <div className="flex flex-col md:flex-row md:items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">@{profile.username}</h2>
                {profile.verified && (
                  <span className="self-center inline-flex items-center justify-center text-[10px] font-bold text-white bg-blue-500 px-1.5 py-0.5 rounded-full shadow-sm">
                    Verified
                  </span>
                )}
                <span className="self-center inline-flex items-center gap-1 text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  Provider: {profile.provider || 'mock'} ({profile.providerVersion || 'v1'})
                </span>
              </div>
              <p className="text-sm font-semibold text-gray-800 mt-1">{profile.fullName}</p>
              <p className="text-sm text-gray-500 mt-1.5 leading-relaxed max-w-2xl">{profile.bio}</p>
              <p className="text-[10px] text-gray-400 mt-3">
                Last synced at: {new Date(profile.syncedAt).toLocaleString()}
              </p>
            </div>
          </div>

          {/* OVERVIEW STATS CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-white/60 border border-gray-100 rounded-2xl shadow-sm">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">Followers</span>
              <span className="text-2xl font-bold text-gray-900 block mt-1">{formatNumber(profile.followers)}</span>
            </div>
            <div className="p-4 bg-white/60 border border-gray-100 rounded-2xl shadow-sm">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">Following</span>
              <span className="text-2xl font-bold text-gray-900 block mt-1">{formatNumber(profile.following)}</span>
            </div>
            <div className="p-4 bg-white/60 border border-gray-100 rounded-2xl shadow-sm">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">Total Posts</span>
              <span className="text-2xl font-bold text-gray-900 block mt-1">{formatNumber(profile.postsCount)}</span>
            </div>
            <div className="p-4 bg-white/60 border border-gray-100 rounded-2xl shadow-sm">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">Engagement Rate</span>
              <span className="text-2xl font-bold text-pink-600 block mt-1">
                {analytics ? `${analytics.engagementRate.toFixed(2)}%` : '—'}
              </span>
            </div>
          </div>

          {/* TABS SELECTOR */}
          <div className="border-b border-gray-100 flex gap-6">
            {[
              { id: 'overview', label: 'Overview', icon: Users },
              { id: 'reels', label: 'Reels Analytics', icon: Video },
              { id: 'comments', label: 'Comments Intelligence', icon: MessageSquare },
              { id: 'intelligence', label: 'AI Recommendations', icon: Sparkles }
            ].map((tab) => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 pb-3.5 text-sm font-semibold border-b-2 cursor-pointer transition-all duration-200 ${
                    active
                      ? 'border-pink-500 text-pink-600'
                      : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <Icon className="h-4.5 w-4.5" />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* TABS CONTENTS */}
          <div className="min-h-[250px]">
            {/* 1. OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Historical snapshot details */}
                <div className="lg:col-span-2 p-6 bg-white/60 border border-gray-100 rounded-2xl shadow-sm space-y-6">
                  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-pink-500" />
                    Engagement Benchmarks
                  </h3>
                  {analytics ? (
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl">
                        <span className="text-xs text-gray-400 block">Avg Reel Views</span>
                        <span className="text-lg font-bold text-gray-800 mt-1 block">{formatNumber(analytics.averageViews)}</span>
                      </div>
                      <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl">
                        <span className="text-xs text-gray-400 block">Avg Likes</span>
                        <span className="text-lg font-bold text-gray-800 mt-1 block">{formatNumber(analytics.averageLikes)}</span>
                      </div>
                      <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl">
                        <span className="text-xs text-gray-400 block">Avg Comments</span>
                        <span className="text-lg font-bold text-gray-800 mt-1 block">{formatNumber(analytics.averageComments)}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">No snapshot calculated yet.</p>
                  )}

                  <div className="p-4 bg-pink-50/50 border border-pink-100 rounded-xl">
                    <p className="text-xs text-pink-700 leading-relaxed">
                      💡 <strong>Strategic Insight:</strong> Your reels achieve an engagement rate of <strong>{analytics?.engagementRate}%</strong>. Creators in the tech and build niche target a baseline of 2.5%, showing that your profile performs above market average.
                    </p>
                  </div>
                </div>

                {/* Account Details Sidebar */}
                <div className="p-6 bg-white/60 border border-gray-100 rounded-2xl shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-gray-800">Integration Configuration</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-400">Data Source</span>
                      <span className="font-semibold text-gray-700 uppercase">{profile.provider || 'mock'}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-400">API Version</span>
                      <span className="font-semibold text-gray-700">{profile.providerVersion || 'v1'}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-400">Cache Policy</span>
                      <span className="font-semibold text-gray-700">Redis / Memory Fallback</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-400">Workspace Id</span>
                      <span className="font-semibold text-gray-700 truncate max-w-28 text-right" title={profile.workspaceId}>
                        {profile.workspaceId}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. REELS TAB */}
            {activeTab === 'reels' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-gray-800">
                    Latest Posts & Reels ({Math.min(10, reels.length)} of {reels.length})
                  </h3>
                </div>

                {reels.length === 0 ? (
                  <p className="text-sm text-gray-400 py-8 text-center bg-gray-50 rounded-xl">No Reels detected for this profile.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...reels]
                      .sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate))
                      .slice(0, 10)
                      .map((reel) => (
                        <div key={reel.reelId} className="bg-white/60 border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between hover:scale-[1.01] transition-all">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">
                                  <Video className="h-3 w-3" /> ID: {reel.reelId}
                                </span>
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-pink-50 text-pink-600 px-2 py-0.5 rounded-full">
                                  {reel.mediaType || 'Video'}
                                </span>
                              </div>
                              <span className="text-[10px] text-gray-400">
                                {new Date(reel.publishDate).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 line-clamp-3 leading-relaxed font-medium italic">
                              "{reel.caption}"
                            </p>
                          </div>

                          <div className="pt-4 border-t border-gray-50 grid grid-cols-3 gap-2 text-center">
                            <div className="space-y-0.5">
                              <span className="text-[10px] text-gray-400 block">Views</span>
                              <span className="text-sm font-bold text-gray-900 flex items-center justify-center gap-1">
                                <Play className="h-3.5 w-3.5 text-gray-400 fill-current" />
                                {formatNumber(reel.views)}
                              </span>
                            </div>
                            <div className="space-y-0.5">
                              <span className="text-[10px] text-gray-400 block">Likes</span>
                              <span className="text-sm font-bold text-gray-900 flex items-center justify-center gap-1">
                                <Heart className="h-3.5 w-3.5 text-red-500 fill-current" />
                                {formatNumber(reel.likes)}
                              </span>
                            </div>
                            <div className="space-y-0.5">
                              <span className="text-[10px] text-gray-400 block">Comments</span>
                              <span className="text-sm font-bold text-gray-900 flex items-center justify-center gap-1">
                                <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
                                {formatNumber(reel.comments)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* 3. COMMENTS INTEL TAB */}
            {activeTab === 'comments' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Reels list selector sidebar */}
                <div className="p-4 bg-white/60 border border-gray-100 rounded-2xl shadow-sm space-y-3">
                  <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Select Reel</h4>
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {reels.map((r) => (
                      <button
                        key={r.reelId}
                        onClick={() => {
                          setSelectedReelId(r.reelId)
                          setSelectedCategoryFilter('all')
                        }}
                        className={`w-full text-left p-3 rounded-xl text-xs transition border flex flex-col gap-1.5 ${
                          selectedReelId === r.reelId
                            ? 'bg-pink-50/50 border-pink-100 text-pink-700'
                            : 'bg-white/40 border-gray-100 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span className="font-semibold block truncate leading-none">Reel {r.reelId}</span>
                        <span className="line-clamp-2 italic text-gray-400">"{r.caption}"</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Comments List */}
                <div className="lg:col-span-2 p-6 bg-white/60 border border-gray-100 rounded-2xl shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                    <h4 className="text-sm font-bold text-gray-800">
                      Audience Comments for Reel: <span className="text-pink-500 font-mono">{selectedReelId}</span>
                    </h4>
                  </div>

                  {/* Comments Category Filters */}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: 'all', label: 'All' },
                      { id: 'positive', label: 'Positive' },
                      { id: 'negative', label: 'Negative' },
                      { id: 'question', label: 'Questions' },
                      { id: 'content_request', label: 'Content Requests' }
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setSelectedCategoryFilter(f.id)}
                        className={`px-3 py-1 rounded-xl text-[11px] font-semibold border transition cursor-pointer ${
                          selectedCategoryFilter === f.id
                            ? 'bg-pink-500 text-white border-pink-500 shadow-sm'
                            : 'bg-white border-gray-100 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {commentsLoading ? (
                    <div className="py-20 text-center">
                      <div className="w-8 h-8 border-2 border-pink-500/20 border-t-pink-500 rounded-full animate-spin mx-auto mb-2" />
                      <p className="text-xs text-gray-400">Loading comments...</p>
                    </div>
                  ) : comments.length === 0 ? (
                    <p className="text-sm text-gray-400 py-16 text-center">No comments available for this Reel.</p>
                  ) : (
                    <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2">
                      {comments
                        .filter((c) => {
                          if (selectedCategoryFilter === 'all') return true
                          return c.category === selectedCategoryFilter
                        })
                        .map((c) => (
                          <div key={c.commentId} className="p-3 bg-gray-50 border border-gray-100 rounded-xl space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-semibold text-gray-700">@{c.author}</span>
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                                c.category === 'question'
                                  ? 'bg-blue-50 text-blue-700 border-blue-100'
                                  : c.category === 'content_request'
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                                  : c.category === 'positive'
                                  ? 'bg-green-50 text-green-700 border-green-100'
                                  : c.category === 'negative'
                                  ? 'bg-red-50 text-red-700 border-red-100'
                                  : 'bg-gray-50 text-gray-500 border-gray-100'
                              }`}>
                                {c.category === 'content_request' ? 'Content Request' : c.category}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">"{c.text}"</p>
                          </div>
                        ))}
                      {comments.filter((c) => {
                        if (selectedCategoryFilter === 'all') return true
                        return c.category === selectedCategoryFilter
                      }).length === 0 && (
                        <p className="text-xs text-gray-400 py-8 text-center bg-gray-50 rounded-xl">
                          No comments categorized under '{selectedCategoryFilter}' for this Reel.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4. AI INTELLIGENCE RECOMMENDATIONS TAB */}
            {activeTab === 'intelligence' && (
              <div className="space-y-6">
                {/* Manual AI Audit controller banner */}
                <div className="p-6 bg-gradient-to-r from-gray-900 to-neutral-800 text-white rounded-2xl shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="space-y-1.5 text-center md:text-left">
                    <h3 className="text-base font-bold flex items-center justify-center md:justify-start gap-2">
                      <Sparkles className="h-4.5 w-4.5 text-yellow-400 fill-current animate-pulse" />
                      Manual Creator AI Recommendations
                    </h3>
                    <p className="text-xs text-gray-300 max-w-xl leading-relaxed">
                      Sync profile statistics and invoke our OpenAI analysis model to discover content gaps, sentiment trends, competitor advantages, and ideas for your next Reels.
                    </p>
                  </div>
                  <button
                    onClick={handleTriggerAI}
                    disabled={aiLoading}
                    className="w-full md:w-auto px-5 py-3 bg-white text-gray-900 rounded-xl text-xs font-bold hover:bg-gray-50 transition shrink-0 flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
                  >
                    {aiLoading ? (
                      <div className="w-3.5 h-3.5 border-2 border-gray-900/20 border-t-gray-900 rounded-full animate-spin" />
                    ) : (
                      <Zap className="h-3.5 w-3.5 fill-current text-yellow-500" />
                    )}
                    Generate recommendations
                  </button>
                </div>

                {!aiRecs ? (
                  /* Initial state before manual triggering */
                  <div className="text-center py-16 bg-white/60 border border-gray-100 rounded-2xl shadow-sm space-y-3">
                    <div className="h-12 w-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mx-auto">
                      <Lock className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-800">Recommendations Locked</h4>
                      <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                        Click the 'Generate recommendations' button above to perform manual AI analysis on your profile.
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Recommendations list displaying the 5 items */
                  <div className="space-y-6 animate-fadeIn">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      
                      {/* Sentiment Summary */}
                      <div className="p-5 bg-white/60 border border-gray-100 rounded-2xl shadow-sm space-y-3">
                        <span className="text-xs font-bold text-pink-600 uppercase tracking-wider block">1. Sentiment Summary</span>
                        <p className="text-sm text-gray-700 leading-relaxed font-medium">
                          {aiRecs.sentimentAnalysis.summary}
                        </p>
                        <div className="pt-2 flex items-center gap-4">
                          <span className="text-xs text-gray-500 font-semibold">Audience Ratio:</span>
                          <div className="flex gap-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-green-50 text-green-700 border border-green-100 rounded-full">
                              {aiRecs.sentimentAnalysis.ratio.positive}% Positive
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-50 text-gray-500 border border-gray-100 rounded-full">
                              {aiRecs.sentimentAnalysis.ratio.neutral}% Neutral
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-red-50 text-red-700 border border-red-100 rounded-full">
                              {aiRecs.sentimentAnalysis.ratio.negative}% Critical
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Content Gap Analysis */}
                      <div className="p-5 bg-white/60 border border-gray-100 rounded-2xl shadow-sm space-y-3">
                        <span className="text-xs font-bold text-pink-600 uppercase tracking-wider block">2. Content Gap Analysis</span>
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {aiRecs.contentGapAnalysis.gapDescription}
                        </p>
                        <div className="pt-1.5 space-y-1">
                          <span className="text-[11px] font-bold text-gray-400 block uppercase">High Opportunity Topics:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {aiRecs.contentGapAnalysis.topicsToTarget.map((t, idx) => (
                              <span key={idx} className="text-[10px] font-semibold bg-pink-50 text-pink-600 px-2 py-0.5 rounded-lg">
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Competitor Analysis */}
                      <div className="p-5 bg-white/60 border border-gray-100 rounded-2xl shadow-sm space-y-3">
                        <span className="text-xs font-bold text-pink-600 uppercase tracking-wider block">3. Competitor Analysis</span>
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {aiRecs.competitorAnalysis.competitorPerformance}
                        </p>
                        <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl">
                          <span className="text-[10px] font-bold text-gray-500 block uppercase">Recommended Edge:</span>
                          <span className="text-xs font-medium text-gray-700 mt-1 block">{aiRecs.competitorAnalysis.recommendedEdge}</span>
                        </div>
                      </div>

                      {/* Viral Pattern Detection */}
                      <div className="p-5 bg-white/60 border border-gray-100 rounded-2xl shadow-sm space-y-3">
                        <span className="text-xs font-bold text-pink-600 uppercase tracking-wider block">4. Viral Pattern Detection</span>
                        <div className="space-y-2">
                          <span className="text-xs font-bold text-gray-400 block uppercase">Top Performing Hook Factors:</span>
                          <ul className="space-y-1.5">
                            {aiRecs.viralPatternDetection.topFactors.map((f, idx) => (
                              <li key={idx} className="text-xs text-gray-600 flex items-start gap-2">
                                <span className="text-green-500 shrink-0">✓</span> {f}
                              </li>
                            ))}
                          </ul>
                          <div className="pt-2 text-xs">
                            <span className="text-gray-400">Pacing Blueprint:</span>
                            <span className="font-semibold text-gray-700 ml-1.5">{aiRecs.viralPatternDetection.recommendedPacing}</span>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Next Reels Recommendations */}
                    <div className="p-6 bg-white/60 border border-gray-100 rounded-2xl shadow-sm space-y-4">
                      <span className="text-xs font-bold text-pink-600 uppercase tracking-wider block">5. Next Reel Recommendations (Content Blueprints)</span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {aiRecs.nextReelRecommendations.map((rec, idx) => (
                          <div key={idx} className="p-4 bg-gray-50/50 border border-gray-100 rounded-xl space-y-3 flex flex-col justify-between">
                            <div className="space-y-1.5">
                              <span className="text-xs font-bold text-gray-800 block">Idea {idx+1}: {rec.title}</span>
                              <p className="text-xs text-gray-500 leading-relaxed">
                                <strong>Hook:</strong> "{rec.hook}"
                              </p>
                              <p className="text-xs text-gray-600 leading-relaxed bg-white border border-gray-100 p-2.5 rounded-lg italic">
                                "{rec.description}"
                              </p>
                            </div>
                            <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-[10px]">
                              <span className="text-gray-400">Estimated Engagement Rate:</span>
                              <span className="font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                                {rec.estimatedEngagement}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
