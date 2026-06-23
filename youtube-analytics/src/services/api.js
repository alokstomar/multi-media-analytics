import axios from 'axios'

// In production (Vercel), requests go to same origin ("/api/...") and a
// vercel.json rewrite transparently proxies them to the backend so cookies
// stay first-party. In dev, talk to the local backend directly.
//
// Detect "production" via the runtime hostname instead of import.meta.env.PROD
// — Vite 8's static replacement of that flag has been observed baking the dev
// default into production bundles. VITE_API_BASE_URL overrides in either case;
// an explicit empty string is honored (use ??, not ||).
const IS_LOCAL_DEV =
  typeof window !== 'undefined' &&
  (/^localhost(:\d+)?$/.test(window.location.hostname) || window.location.hostname === '127.0.0.1')
const DEFAULT_BASE_URL = IS_LOCAL_DEV ? 'http://localhost:5000' : ''

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? DEFAULT_BASE_URL,
  timeout: 15000,
  withCredentials: true,
})

// Automatically attach active workspace ID to headers
api.interceptors.request.use((config) => {
  const activeWorkspaceId = localStorage.getItem('activeWorkspaceId')
  if (activeWorkspaceId) {
    config.headers['x-workspace-id'] = activeWorkspaceId
  }
  return config
})

// ── Auth ─────────────────────────────────────────────────────────────
export const authSignup = (payload) =>
  api.post('/api/auth/signup', payload).then((r) => r.data)

export const authLogin = (payload) =>
  api.post('/api/auth/login', payload).then((r) => r.data)

export const authLogout = () =>
  api.post('/api/auth/logout').then((r) => r.data)

export const authMe = () =>
  api.get('/api/auth/me').then((r) => r.data)

export const authVerifyEmail = (token) =>
  api.post('/api/auth/verify-email', { token }).then((r) => r.data)

export const authForgotPassword = (email) =>
  api.post('/api/auth/forgot-password', { email }).then((r) => r.data)

export const authResetPassword = (token, password) =>
  api.post('/api/auth/reset-password', { token, password }).then((r) => r.data)

// ── Workspaces ───────────────────────────────────────────────────────
export const getWorkspaces = () =>
  api.get('/api/workspaces').then((r) => r.data)

export const createWorkspace = (payload) =>
  api.post('/api/workspaces', payload).then((r) => r.data)

export const updateWorkspace = (id, payload) =>
  api.put(`/api/workspaces/${id}`, payload).then((r) => r.data)

export const deleteWorkspace = (id) =>
  api.delete(`/api/workspaces/${id}`).then((r) => r.data)

export const switchWorkspace = (workspaceId) =>
  api.post('/api/workspaces/switch', { workspaceId }).then((r) => r.data)

export const getTeam = () =>
  api.get('/api/workspaces/active/team').then((r) => r.data)

export const inviteTeamMember = (payload) =>
  api.post('/api/workspaces/active/team/invite', payload).then((r) => r.data)

export const removeTeamMember = (userId) =>
  api.delete(`/api/workspaces/active/team/members/${userId}`).then((r) => r.data)

export const updateTeamMemberRole = (userId, role) =>
  api.put(`/api/workspaces/active/team/members/${userId}/role`, { role }).then((r) => r.data)

export const acceptInvite = (token) =>
  api.post('/api/workspaces/invites/accept', { token }).then((r) => r.data)

// ── Channels ─────────────────────────────────────────────────────────
export const addChannel = (input) =>
  api.post('/api/channels', { input }).then((r) => r.data)

export const getChannels = () =>
  api.get('/api/channels').then((r) => r.data)

export const getChannel = (id) =>
  api.get(`/api/channels/${id}`).then((r) => r.data)

export const refreshChannel = (id) =>
  api.post(`/api/channels/${id}/refresh`).then((r) => r.data)

export const deleteChannel = (id) =>
  api.delete(`/api/channels/${id}`).then((r) => r.data)

// ── Videos ───────────────────────────────────────────────────────────
export const getVideos = (id, { page = 1, limit = 20 } = {}) =>
  api.get(`/api/channels/${id}/videos`, { params: { page, limit } }).then((r) => r.data)

// ── Comments ─────────────────────────────────────────────────────────
export const getComments = (channelId, { page = 1, limit = 20, refresh = false, sentiment, search, timeRange, maxVideos, maxVolume, language } = {}) =>
  api.get(`/api/channels/${channelId}/comments`, {
    params: { page, limit, refresh, sentiment, search, timeRange, maxVideos, maxVolume, language },
  }).then((r) => r.data)

export const getCommentsSummary = (channelId, { refresh = false, maxVideos, maxVolume } = {}) =>
  api.get(`/api/channels/${channelId}/comments/summary`, {
    params: { refresh, maxVideos, maxVolume },
  }).then((r) => r.data)

export const refreshComments = (channelId, { maxVideos, maxVolume } = {}) =>
  api.post(`/api/channels/${channelId}/comments/refresh`, { maxVideos, maxVolume }).then((r) => r.data)

export const getPortfolioComments = (channelIds, { page = 1, limit = 20, refresh = false, sentiment, search, timeRange, maxVideos, maxVolume, language } = {}) =>
  api.get('/api/comments/portfolio', {
    params: {
      channelIds: channelIds.join(','),
      page,
      limit,
      refresh,
      sentiment,
      search,
      timeRange,
      maxVideos,
      maxVolume,
      language,
    },
  }).then((r) => r.data)

export const getPortfolioCommentsSummary = (channelIds, { refresh = false, maxVideos, maxVolume } = {}) =>
  api.get('/api/comments/portfolio/summary', {
    params: { channelIds: channelIds.join(','), refresh, maxVideos, maxVolume },
  }).then((r) => r.data)

// ── Analytics ────────────────────────────────────────────────────────
export const getAnalytics = (id) =>
  api.get(`/api/analytics/${id}`).then((r) => r.data)

export const getInsights = (id) =>
  api.get(`/api/analytics/${id}/insights`).then((r) => r.data)

// ── Dashboard (all-in-one) ───────────────────────────────────────────
export const getDashboard = (id) =>
  api.get(`/api/dashboard/${id}`).then((r) => r.data)

// ── Comparison ───────────────────────────────────────────────────────
export const compareChannels = (channelIds) =>
  api.post('/api/compare', { channelIds }).then((r) => r.data)

// ── Content Intelligence (AI stubs) ──────────────────────────────────
export const analyzeTitle = (payload) =>
  api.post('/api/intelligence/analyze/title', payload).then((r) => r.data)

export const analyzeThumbnail = (payload) =>
  api.post('/api/intelligence/analyze/thumbnail', payload).then((r) => r.data)

export const analyzeScript = (payload) =>
  api.post('/api/intelligence/analyze/script', payload).then((r) => r.data)

export const generateVideoIdeas = (channelId, payload = {}) =>
  api.post(`/api/intelligence/${channelId}/ideas`, payload).then((r) => r.data)

export const generateShortsIdeas = (channelId, payload = {}) =>
  api.post(`/api/intelligence/${channelId}/shorts-ideas`, payload).then((r) => r.data)

export const getContentGaps = (channelId, payload = {}) =>
  api.post(`/api/intelligence/${channelId}/content-gaps`, payload).then((r) => r.data)

export const getStrategistTips = (channelId, payload = {}) =>
  api.post(`/api/intelligence/${channelId}/strategist`, payload).then((r) => r.data)

export const summarizeAlerts = (channelId, payload = {}) =>
  api.post(`/api/intelligence/${channelId}/alerts-summary`, payload).then((r) => r.data)

export const predictPerformance = (channelId, payload = {}) =>
  api.post(`/api/intelligence/${channelId}/predict-performance`, payload).then((r) => r.data)

// Portfolio Intelligence
export const getPortfolioSummary = (channelIds) =>
  api.post('/api/portfolio/intelligence/summary', { channelIds }).then((r) => r.data)

export const getPortfolioAudienceOverlap = (channelIds) =>
  api.post('/api/portfolio/intelligence/audience-overlap', { channelIds }).then((r) => r.data)

export const getPortfolioCrossPromotion = (channelIds) =>
  api.post('/api/portfolio/intelligence/cross-promotion', { channelIds }).then((r) => r.data)

export const getPortfolioContentGaps = (channelIds) =>
  api.post('/api/portfolio/intelligence/content-gaps', { channelIds }).then((r) => r.data)

export const getPortfolioCannibalization = (channelIds) =>
  api.post('/api/portfolio/intelligence/cannibalization', { channelIds }).then((r) => r.data)

export const getPortfolioStrategist = (channelIds) =>
  api.post('/api/portfolio/intelligence/strategist', { channelIds }).then((r) => r.data)

// ── Content Studio ────────────────────────────────────────────────────
export const generateLinkedInPost = (payload) =>
  api.post('/api/studio/generate/linkedin', payload).then((r) => r.data)

export const generateTwitterPost = (payload) =>
  api.post('/api/studio/generate/twitter', payload).then((r) => r.data)

export const generateInstagramContent = (payload) =>
  api.post('/api/studio/generate/instagram', payload).then((r) => r.data)

export const generateThreadsPost = (payload) =>
  api.post('/api/studio/generate/threads', payload).then((r) => r.data)

export const repurposeContent = (payload) =>
  api.post('/api/studio/generate/repurpose', payload).then((r) => r.data)

export const improveContent = (payload) =>
  api.post('/api/studio/generate/improve', payload).then((r) => r.data)

export const getStudioPosts = (params = {}) =>
  api.get('/api/studio/posts', { params }).then((r) => r.data)

export const createStudioPost = (payload) =>
  api.post('/api/studio/posts', payload).then((r) => r.data)

export const updateStudioPost = (id, payload) =>
  api.put(`/api/studio/posts/${id}`, payload).then((r) => r.data)

export const deleteStudioPost = (id) =>
  api.delete(`/api/studio/posts/${id}`).then((r) => r.data)

export const publishStudioPost = (id) =>
  api.post(`/api/studio/posts/${id}/publish`).then((r) => r.data)

export const scheduleStudioPost = (id, scheduledAt) =>
  api.post(`/api/studio/posts/${id}/schedule`, { scheduledAt }).then((r) => r.data)

export const getCalendarEvents = (start, end) =>
  api.get('/api/studio/posts/calendar', { params: { start, end } }).then((r) => r.data)

export const getConnectedAccounts = (platform) =>
  api.get('/api/studio/accounts', { params: { platform } }).then((r) => r.data)

export const connectAccount = (payload) =>
  api.post('/api/studio/accounts', payload).then((r) => r.data)

export const disconnectAccount = (id) =>
  api.delete(`/api/studio/accounts/${id}`).then((r) => r.data)

// ── Instagram ────────────────────────────────────────────────────────
export const getInstagramAccounts = () =>
  api.get('/api/instagram/accounts').then((r) => r.data)

export const addInstagramAccount = (payload) =>
  api.post('/api/instagram', payload).then((r) => r.data)

export const deleteInstagramAccount = (id) =>
  api.delete(`/api/instagram/accounts/${id}`).then((r) => r.data)

export const getInstagramAnalytics = (id) =>
  api.get(`/api/instagram/${id}/analytics`).then((r) => r.data)

export const getInstagramPosts = (id, { type = 'All' } = {}) =>
  api.get(`/api/instagram/${id}/posts`, { params: { type } }).then((r) => r.data)

export const getInstagramAuthUrl = () =>
  api.get('/api/instagram/auth/url').then((r) => r.data)

export const refreshInstagramToken = (id) =>
  api.post('/api/instagram/auth/refresh', { accountId: id }).then((r) => r.data)

export const getInstagramOAuthHealth = () =>
  api.get('/api/instagram/oauth/health').then((r) => r.data)

// ── X AI Growth Engine ─────────────────────────────────────────────────
export const aiGenerateTweet = (payload) =>
  api.post('/api/studio/ai/generate-tweet', payload).then((r) => r.data)

export const aiGenerateThread = (payload) =>
  api.post('/api/studio/ai/generate-thread', payload).then((r) => r.data)

export const aiAnalyzeTweet = (payload) =>
  api.post('/api/studio/ai/analyze-tweet', payload).then((r) => r.data)

export const aiGetTrendingTopics = (category) =>
  api.get('/api/studio/ai/trending-topics', { params: { category } }).then((r) => r.data)

export const aiGetViralOpportunities = (category) =>
  api.get('/api/studio/ai/viral-opportunities', { params: { category } }).then((r) => r.data)

// ── LinkedIn Phase 3 AI Growth Engine ────────────────────────────────
export const aiGenerateLinkedinPost = (payload) =>
  api.post('/api/studio/linkedin/ai/generate-post', payload).then((r) => r.data)

export const aiGenerateLinkedinThoughtLeadership = (payload) =>
  api.post('/api/studio/linkedin/ai/thought-leadership', payload).then((r) => r.data)

export const aiAnalyzeLinkedinPost = (payload) =>
  api.post('/api/studio/linkedin/ai/analyze-post', payload).then((r) => r.data)

export const aiGetLinkedinContentIdeas = (category) =>
  api.get('/api/studio/linkedin/ai/content-ideas', { params: { category } }).then((r) => r.data)

export const aiDiscoverLinkedinTrends = (category) =>
  api.get('/api/studio/linkedin/ai/discover-trends', { params: { category } }).then((r) => r.data)

export const aiRepurposeLinkedinContent = (payload) =>
  api.post('/api/studio/linkedin/ai/repurpose', payload).then((r) => r.data)

// ── Twitter/X OAuth ───────────────────────────────────────────────────
export const getTwitterAuthUrl = () =>
  api.get('/api/twitter/auth/url').then((r) => r.data)

export const getTwitterAccounts = () =>
  api.get('/api/twitter/accounts').then((r) => r.data)

export const disconnectTwitterAccount = (id) =>
  api.delete(`/api/twitter/accounts/${id}`).then((r) => r.data)

export const refreshTwitterToken = (id) =>
  api.post('/api/twitter/auth/refresh', { accountId: id }).then((r) => r.data)

export const getTwitterOAuthHealth = () =>
  api.get('/api/twitter/oauth/health').then((r) => r.data)

// ── LinkedIn OAuth ───────────────────────────────────────────────────
export const getLinkedInAuthUrl = () =>
  api.get('/api/linkedin/auth/url').then((r) => r.data)

export const getLinkedInAccounts = () =>
  api.get('/api/linkedin/accounts').then((r) => r.data)

export const disconnectLinkedInAccount = (id) =>
  api.delete(`/api/linkedin/accounts/${id}`).then((r) => r.data)

export const refreshLinkedInToken = (id) =>
  api.post('/api/linkedin/auth/refresh', { accountId: id }).then((r) => r.data)

export const getLinkedInOAuthHealth = () =>
  api.get('/api/linkedin/oauth/health').then((r) => r.data)

export const getPublishedPosts = (params = {}) =>
  api.get('/api/studio/posts/published', { params }).then((r) => r.data)

// ── Twitter Phase 2 Automation Endpoints ──────────────────────────────
export const getTwitterScheduled = () =>
  api.get('/api/studio/twitter/scheduled').then((r) => r.data)

export const createTwitterScheduled = (payload) =>
  api.post('/api/studio/twitter/scheduled', payload).then((r) => r.data)

export const updateTwitterScheduled = (id, payload) =>
  api.put(`/api/studio/twitter/scheduled/${id}`, payload).then((r) => r.data)

export const cancelTwitterScheduled = (id) =>
  api.post(`/api/studio/twitter/scheduled/${id}/cancel`).then((r) => r.data)

export const publishTwitterScheduled = (id) =>
  api.post(`/api/studio/twitter/scheduled/${id}/publish`).then((r) => r.data)

export const deleteTwitterScheduled = (id) =>
  api.delete(`/api/studio/twitter/scheduled/${id}`).then((r) => r.data)

export const getTwitterQueue = () =>
  api.get('/api/studio/twitter/queue').then((r) => r.data)

export const retryTwitterQueueJob = (id) =>
  api.post(`/api/studio/twitter/queue/${id}/retry`).then((r) => r.data)

export const getTwitterQueueStats = () =>
  api.get('/api/studio/twitter/queue/stats').then((r) => r.data)

export const getTwitterRules = () =>
  api.get('/api/studio/twitter/rules').then((r) => r.data)

export const createTwitterRule = (payload) =>
  api.post('/api/studio/twitter/rules', payload).then((r) => r.data)

export const updateTwitterRule = (id, payload) =>
  api.put(`/api/studio/twitter/rules/${id}`, payload).then((r) => r.data)

export const deleteTwitterRule = (id) =>
  api.delete(`/api/studio/twitter/rules/${id}`).then((r) => r.data)

export const toggleTwitterRule = (id) =>
  api.patch(`/api/studio/twitter/rules/${id}/toggle`).then((r) => r.data)

export const executeTwitterRule = (id) =>
  api.post(`/api/studio/twitter/rules/${id}/execute`).then((r) => r.data)

export const getTwitterDashboardStats = () =>
  api.get('/api/studio/twitter/dashboard-stats').then((r) => r.data)

export const getTwitterBestTimes = () =>
  api.get('/api/studio/twitter/best-times').then((r) => r.data)

export const getSchedulerJobs = (params = {}) =>
  api.get('/api/scheduler/jobs', { params }).then((r) => r.data)

export const retrySchedulerJob = (jobId) =>
  api.post('/api/scheduler/retry', { jobId }).then((r) => r.data)

export const cancelSchedulerPost = (jobId) =>
  api.post('/api/scheduler/cancel', { jobId }).then((r) => r.data)

// ── Instagram Analytics Framework ─────────────────────────────────────
export const syncInstagram = (username) =>
  api.post(`/api/instagram/sync/${username}`).then((r) => r.data)

export const syncInstagramBulk = (usernames) =>
  api.post('/api/instagram/sync-bulk', { usernames }).then((r) => r.data)

export const getInstagramProfile = (username, force = false) =>
  api.get(`/api/instagram/profile/${username}`, { params: { force } }).then((r) => r.data)

export const getInstagramReels = (username, force = false) =>
  api.get(`/api/instagram/reels/${username}`, { params: { force } }).then((r) => r.data)

export const getInstagramComments = (reelId, force = false) =>
  api.get(`/api/instagram/comments/${reelId}`, { params: { force } }).then((r) => r.data)

export const getInstagramProfileAnalytics = (username, force = false) =>
  api.get(`/api/instagram/analytics/${username}`, { params: { force } }).then((r) => r.data)

export const triggerInstagramAIRecommendations = (username) =>
  api.post(`/api/instagram/recommendations/${username}`).then((r) => r.data)

export const getAIUsageStats = () =>
  api.get('/api/studio/ai/usage-stats').then((r) => r.data)

export const getQueueMetrics = () =>
  api.get('/api/studio/queue/metrics').then((r) => r.data)

export default api




