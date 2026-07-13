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

if (IS_LOCAL_DEV) {
  console.log('API Base URL:', api.defaults.baseURL)
}

// Automatically attach active workspace ID to headers
api.interceptors.request.use((config) => {
  const activeWorkspaceId = localStorage.getItem('activeWorkspaceId')
  if (activeWorkspaceId) {
    config.headers['x-workspace-id'] = activeWorkspaceId
  }
  return config
})

// 401 interceptor: when the backend rejects the auth cookie, the in-memory
// user state and any stale localStorage workspaceId are no longer trustworthy.
// Wipe them so the next navigation forces a clean re-login instead of looping
// on requests that keep failing auth.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      try {
        localStorage.removeItem('activeWorkspaceId')
      } catch {}
    }
    return Promise.reject(err)
  },
)

// Cold Azure gpt-5.4 calls reliably take 17-22s. The global 15s timeout is
// correct for non-AI APIs (DB reads, auth, channel CRUD) but aborts every
// cold AI request before Azure responds. Use a per-request override on AI
// endpoints only.
const AI_TIMEOUT = 90000

// Channel connection runs 5 sequential YouTube Data API calls (resolve →
// details → channel lookup → playlist items → video stats) plus the cold-start
// latency of a Vercel function. On a cold function this can push past the
// 15s default and abort with "timeout of 15000ms exceeded" in the browser
// even though the backend would have succeeded. Give this specific endpoint
// headroom; everything else stays on the 15s default.
const CHANNEL_TIMEOUT = 60000

// In-flight deduplication: per-(method, channelId) memoization of pending
// promises. Prevents duplicate GPT calls when multiple components mount at
// the same time or when the user spams retry. Resolved/rejected promises are
// evicted immediately so the next call always hits the network fresh.
const inflight = new Map()
function dedupeAI(key, factory) {
  const existing = inflight.get(key)
  if (existing) return existing
  const p = factory().finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}

// ── Auth ─────────────────────────────────────────────────────────────
export const authSignup = (payload) =>
  api.post('/api/auth/signup', payload).then((r) => r.data)

export const authLogin = (payload) =>
  api.post('/api/auth/login', payload).then((r) => r.data)

export const authLogout = () =>
  api.post('/api/auth/logout').then((r) => r.data)

export const logoutUser = () =>
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
  api.post('/api/channels', { input }, { timeout: CHANNEL_TIMEOUT }).then((r) => r.data)

export const getChannels = () =>
  api.get('/api/channels').then((r) => r.data)

export const getChannel = (id) =>
  api.get(`/api/channels/${id}`).then((r) => r.data)

export const refreshChannel = (id) =>
  api.post(`/api/channels/${id}/refresh`, {}, { timeout: CHANNEL_TIMEOUT }).then((r) => r.data)

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

// ── Settings & Profile ────────────────────────────────────────────────
export const getProfile = () =>
  api.get('/api/settings/profile').then((r) => r.data)

export const updateProfile = (payload) =>
  api.patch('/api/settings/profile', payload).then((r) => r.data)

export const uploadAvatar = (base64) =>
  api.post('/api/settings/avatar', { base64 }).then((r) => r.data)

export const removeAvatarApi = () =>
  api.delete('/api/settings/avatar').then((r) => r.data)

// Active Session tracking & security APIs
export const getSessions = () =>
  api.get('/api/settings/sessions').then((r) => r.data)

export const revokeSessionApi = (sessionId) =>
  api.delete(`/api/settings/sessions/${sessionId}`).then((r) => r.data)

export const revokeAllOtherSessionsApi = () =>
  api.delete('/api/settings/sessions').then((r) => r.data)

export const updatePasswordApi = (payload) =>
  api.post('/api/settings/password', payload).then((r) => r.data)

export const getIntegrations = () =>
  api.get('/api/settings/integrations').then((r) => r.data)

export const updateIntegration = (platform, payload) =>
  api.patch(`/api/settings/integrations/${platform}`, payload).then((r) => r.data)

export const getApiKey = () =>
  api.get('/api/settings/api-key').then((r) => r.data)

export const regenerateApiKey = () =>
  api.post('/api/settings/api-key/regenerate').then((r) => r.data)

// ── Dashboard (all-in-one) ───────────────────────────────────────────
export const getDashboard = (id) =>
  api.get(`/api/dashboard/${id}`).then((r) => r.data)

// ── Comparison ───────────────────────────────────────────────────────
export const compareChannels = (channelIds) =>
  api.post('/api/compare', { channelIds }).then((r) => r.data)

// ── Content Intelligence (AI stubs) ──────────────────────────────────
export const analyzeTitle = (payload) =>
  api.post('/api/intelligence/analyze/title', payload, { timeout: AI_TIMEOUT }).then((r) => r.data)

export const analyzeThumbnail = (payload) =>
  api.post('/api/intelligence/analyze/thumbnail', payload, {
    timeout: 90000,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }).then((r) => r.data)

export const analyzeScript = (payload) =>
  api.post('/api/intelligence/analyze/script', payload, { timeout: AI_TIMEOUT }).then((r) => r.data)

export const simulatePerformance = (formData) =>
  api.post(
    '/api/intelligence/performance/simulate',
    formData,
    {
      timeout: 90000,
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }
  ).then(r => r.data)

export const generateVideoIdeas = (channelId, payload = {}) =>
  dedupeAI(`video-ideas:${channelId}`, () =>
    api.post(`/api/intelligence/${channelId}/ideas`, payload, { timeout: AI_TIMEOUT }).then((r) => r.data))

export const generateShortsIdeas = (channelId, payload = {}) =>
  dedupeAI(`shorts-ideas:${channelId}`, () =>
    api.post(`/api/intelligence/${channelId}/shorts-ideas`, payload, { timeout: AI_TIMEOUT }).then((r) => r.data))

// Production script: ideaId is in the URL path (REST-style — the
// recommendation is the resource). Body only carries the optional
// recommendation fallback for direct-URL access without a prior ideas fetch.
// ?regenerate=1 bypasses cache read on the server so the user gets a freshly
// generated script. The dedupe key differs in regen mode to prevent a cached
// in-flight promise from masking a new regeneration call.
export const generateProductionScript = (channelId, ideaId, { regenerate = false, recommendation = null } = {}) =>
  dedupeAI(
    `production-script:${channelId}:${ideaId}${regenerate ? ':regen' : ''}`,
    () => api
      .post(
        `/api/intelligence/${channelId}/production-script/${ideaId}${regenerate ? '?regenerate=1' : ''}`,
        { recommendation },
        { timeout: AI_TIMEOUT },
      )
      .then((r) => r.data),
  )

// ── Script Workspace 2.0 ────────────────────────────────────────────────
// Channel-aware AI content studio. Server-side persistence with version
// history (undo/redo). Every non-mutation uses dedupeAI; mutations bypass
// dedupe (each call must reach the server).

export const getScriptWorkspace = (channelId, ideaId) =>
  dedupeAI(`script-workspace:get:${channelId}:${ideaId}`, () =>
    api.get(`/api/intelligence/${channelId}/script-workspace/${ideaId}`, { timeout: AI_TIMEOUT }).then((r) => r.data))

export const generateStyledScript = (channelId, ideaId, { mode = 'similar', regenerate = false, recommendation = null } = {}) =>
  dedupeAI(
    `script-workspace:gen:${channelId}:${ideaId}:${mode}${regenerate ? ':regen' : ''}`,
    () => api
      .post(
        `/api/intelligence/${channelId}/script-workspace/${ideaId}/generate`,
        { mode, regenerate, recommendation },
        { timeout: AI_TIMEOUT },
      )
      .then((r) => r.data),
  )

// Save bypasses dedupe — every keystroke/save must hit the server.
export const saveScriptWorkspace = (channelId, ideaId, { working, source = 'user-edit', action = null, commit = false, styleMatch = null } = {}) =>
  api
    .post(
      `/api/intelligence/${channelId}/script-workspace/${ideaId}/save`,
      { working, source, action, commit, styleMatch },
      { timeout: AI_TIMEOUT },
    )
    .then((r) => r.data)

export const undoScriptWorkspace = (channelId, ideaId) =>
  dedupeAI(`script-workspace:undo:${channelId}:${ideaId}`, () =>
    api.post(`/api/intelligence/${channelId}/script-workspace/${ideaId}/undo`, {}, { timeout: AI_TIMEOUT }).then((r) => r.data))

export const redoScriptWorkspace = (channelId, ideaId) =>
  dedupeAI(`script-workspace:redo:${channelId}:${ideaId}`, () =>
    api.post(`/api/intelligence/${channelId}/script-workspace/${ideaId}/redo`, {}, { timeout: AI_TIMEOUT }).then((r) => r.data))

export const transformScript = (channelId, ideaId, { action, script = null }) =>
  dedupeAI(
    `script-workspace:transform:${channelId}:${ideaId}:${action}`,
    () => api
      .post(
        `/api/intelligence/${channelId}/script-workspace/${ideaId}/transform`,
        { action, script },
        { timeout: AI_TIMEOUT },
      )
      .then((r) => r.data),
  )

export const scoreScriptStyle = (channelId, ideaId, { script = null } = {}) =>
  dedupeAI(
    `script-workspace:stylescore:${channelId}:${ideaId}:${(script?.fullScript || '').length}`,
    () => api
      .post(
        `/api/intelligence/${channelId}/script-workspace/${ideaId}/style-score`,
        { script },
        { timeout: AI_TIMEOUT },
      )
      .then((r) => r.data),
  )

export const analyzeCreatorStyle = (channelId, { regenerate = false } = {}) =>
  dedupeAI(
    `creator-style:${channelId}${regenerate ? ':regen' : ''}`,
    () => api
      .post(
        `/api/intelligence/${channelId}/creator-style`,
        { regenerate },
        { timeout: AI_TIMEOUT },
      )
      .then((r) => r.data),
  )

// ── Research Workspace (Phase 2) ─────────────────────────────────────────
// Provider-agnostic fact-checking & suggestion engine. GET returns the
// cached report if the scriptHash matches; otherwise it triggers analysis.
// Analyze bypasses dedupe (each request must reach the server fresh).
export const getResearchReport = (channelId, ideaId) =>
  dedupeAI(`research:get:${channelId}:${ideaId}`, () =>
    api.get(`/api/intelligence/${channelId}/script-workspace/${ideaId}/research`, { timeout: AI_TIMEOUT }).then((r) => r.data))

export const analyzeResearch = (channelId, ideaId) =>
  api
    .post(
      `/api/intelligence/${channelId}/script-workspace/${ideaId}/research/analyze`,
      {},
      { timeout: AI_TIMEOUT },
    )
    .then((r) => r.data)

export const applyResearchSuggestion = (channelId, ideaId, suggestionId) =>
  api
    .post(
      `/api/intelligence/${channelId}/script-workspace/${ideaId}/research/suggestions/${suggestionId}/apply`,
      {},
      { timeout: AI_TIMEOUT },
    )
    .then((r) => r.data)

export const ignoreResearchSuggestion = (channelId, ideaId, suggestionId) =>
  api
    .post(
      `/api/intelligence/${channelId}/script-workspace/${ideaId}/research/suggestions/${suggestionId}/ignore`,
      {},
      { timeout: AI_TIMEOUT },
    )
    .then((r) => r.data)

// ── Thumbnail Intelligence (Phase 3.1) ─────────────────────────────────────
// Versioned workspace for thumbnail concepts + editable prompt + similarity
// analysis. Grounded in the channel's Thumbnail DNA profile and the current
// script. NO image generation in this phase — "Generate Thumbnail" is disabled.
export const getThumbnailWorkspace = (channelId, ideaId) =>
  dedupeAI(`thumbnail-workspace:get:${channelId}:${ideaId}`, () =>
    api.get(`/api/intelligence/${channelId}/thumbnail-workspace/${ideaId}`, { timeout: AI_TIMEOUT }).then((r) => r.data))

export const generateThumbnailStrategy = (channelId, ideaId, { regenerate = false, recommendation = null, script = null } = {}) =>
  dedupeAI(
    `thumbnail-workspace:gen:${channelId}:${ideaId}${regenerate ? ':regen' : ''}`,
    () => api
      .post(
        `/api/intelligence/${channelId}/thumbnail-workspace/${ideaId}/generate`,
        { regenerate, recommendation, script },
        { timeout: AI_TIMEOUT },
      )
      .then((r) => r.data),
  )

// Save bypasses dedupe — every save must hit the server.
export const saveThumbnailStrategy = (channelId, ideaId, { working, source = 'user-edit', action = null, commit = false } = {}) =>
  api
    .post(
      `/api/intelligence/${channelId}/thumbnail-workspace/${ideaId}/save`,
      { working, source, action, commit },
      { timeout: AI_TIMEOUT },
    )
    .then((r) => r.data)

export const undoThumbnailStrategy = (channelId, ideaId) =>
  dedupeAI(`thumbnail-workspace:undo:${channelId}:${ideaId}`, () =>
    api.post(`/api/intelligence/${channelId}/thumbnail-workspace/${ideaId}/undo`, {}, { timeout: AI_TIMEOUT }).then((r) => r.data))

export const redoThumbnailStrategy = (channelId, ideaId) =>
  dedupeAI(`thumbnail-workspace:redo:${channelId}:${ideaId}`, () =>
    api.post(`/api/intelligence/${channelId}/thumbnail-workspace/${ideaId}/redo`, {}, { timeout: AI_TIMEOUT }).then((r) => r.data))

export const scoreThumbnailSimilarity = (channelId, ideaId, { strategy = null } = {}) =>
  dedupeAI(
    `thumbnail-workspace:score:${channelId}:${ideaId}:${(strategy?.prompt || '').length}`,
    () => api
      .post(
        `/api/intelligence/${channelId}/thumbnail-workspace/${ideaId}/similarity-score`,
        { strategy },
        { timeout: AI_TIMEOUT },
      )
      .then((r) => r.data),
  )

export const analyzeThumbnailProfile = (channelId, { regenerate = false } = {}) =>
  dedupeAI(
    `thumbnail-profile:${channelId}${regenerate ? ':regen' : ''}`,
    () => api
      .post(
        `/api/intelligence/${channelId}/thumbnail-profile`,
        { regenerate },
        { timeout: AI_TIMEOUT },
      )
      .then((r) => r.data),
  )

export const getContentGaps = (channelId, payload = {}) =>
  dedupeAI(`content-gaps:${channelId}`, () =>
    api.post(`/api/intelligence/${channelId}/content-gaps`, payload, { timeout: AI_TIMEOUT }).then((r) => r.data))

export const getCompetitorOpportunities = (channelId) =>
  dedupeAI(`competitor-opportunities:${channelId}`, () =>
    api.get(`/api/intelligence/competitor-opportunities`, { params: { channelId }, timeout: AI_TIMEOUT }).then((r) => r.data))

export const getStrategistTips = (channelId, payload = {}) =>
  dedupeAI(`strategist-tips:${channelId}`, () =>
    api.post(`/api/intelligence/${channelId}/strategist`, payload, { timeout: AI_TIMEOUT }).then((r) => r.data))

export const summarizeAlerts = (channelId, payload = {}) =>
  dedupeAI(`alerts-summary:${channelId}`, () =>
    api.post(`/api/intelligence/${channelId}/alerts-summary`, payload, { timeout: AI_TIMEOUT }).then((r) => r.data))

export const predictPerformance = (channelId, payload = {}) =>
  dedupeAI(`predict-performance:${channelId}`, () =>
    api.post(`/api/intelligence/${channelId}/predict-performance`, payload, { timeout: AI_TIMEOUT }).then((r) => r.data))

// Portfolio Intelligence
const portfolioKey = (channelIds) => [...channelIds].sort().join('|')

export const getPortfolioSummary = (channelIds) =>
  dedupeAI(`portfolio-summary:${portfolioKey(channelIds)}`, () =>
    api.post('/api/portfolio/intelligence/summary', { channelIds }, { timeout: AI_TIMEOUT }).then((r) => r.data))

export const getPortfolioAudienceOverlap = (channelIds) =>
  dedupeAI(`portfolio-audience-overlap:${portfolioKey(channelIds)}`, () =>
    api.post('/api/portfolio/intelligence/audience-overlap', { channelIds }, { timeout: AI_TIMEOUT }).then((r) => r.data))

export const getPortfolioCrossPromotion = (channelIds) =>
  dedupeAI(`portfolio-cross-promotion:${portfolioKey(channelIds)}`, () =>
    api.post('/api/portfolio/intelligence/cross-promotion', { channelIds }, { timeout: AI_TIMEOUT }).then((r) => r.data))

export const getPortfolioContentGaps = (channelIds) =>
  dedupeAI(`portfolio-content-gaps:${portfolioKey(channelIds)}`, () =>
    api.post('/api/portfolio/intelligence/content-gaps', { channelIds }, { timeout: AI_TIMEOUT }).then((r) => r.data))

export const getPortfolioCannibalization = (channelIds) =>
  dedupeAI(`portfolio-cannibalization:${portfolioKey(channelIds)}`, () =>
    api.post('/api/portfolio/intelligence/cannibalization', { channelIds }, { timeout: AI_TIMEOUT }).then((r) => r.data))

export const getPortfolioStrategist = (channelIds) =>
  dedupeAI(`portfolio-strategist:${portfolioKey(channelIds)}`, () =>
    api.post('/api/portfolio/intelligence/strategist', { channelIds }, { timeout: AI_TIMEOUT }).then((r) => r.data))

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
// Username-based onboarding — accounts are added by handle, no OAuth.
export const getInstagramAccounts = () =>
  api.get('/api/instagram/accounts').then((r) => r.data)

export const addInstagramAccount = (username) =>
  api.post(`/api/instagram/accounts/${username}`).then((r) => r.data)

export const deleteInstagramAccount = (username) =>
  api.delete(`/api/instagram/accounts/${username}`).then((r) => r.data)

export const refreshInstagramAccount = (username) =>
  api.post(`/api/instagram/accounts/${username}/sync`, {}, { timeout: CHANNEL_TIMEOUT }).then((r) => r.data)

export const getInstagramSyncStatus = (username) =>
  api.get(`/api/instagram/accounts/${username}/status`).then((r) => r.data)

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

// ── Instagram Alerts (Phase 8) ─────────────────────────────────────────
export const getInstagramAlerts = ({ accountId, filter, limit } = {}) =>
  api
    .get('/api/instagram/alerts', { params: { accountId, filter, limit } })
    .then((r) => r.data?.data || { alerts: [], total: 0, counts: { total: 0, critical: 0, unread: 0, viral: 0 } })

export const refreshInstagramAlerts = ({ accountId } = {}) =>
  api
    .post('/api/instagram/alerts/refresh', { accountId })
    .then((r) => r.data?.data || {})

export const markInstagramAlertRead = (id) =>
  api.post(`/api/instagram/alerts/${id}/read`).then((r) => r.data?.data)

export const markAllInstagramAlertsRead = ({ accountId } = {}) =>
  api
    .post('/api/instagram/alerts/read-all', { accountId })
    .then((r) => r.data?.data || { modifiedCount: 0 })

// ── Instagram AI Intelligence (Phase 9) ───────────────────────────────
// All routes sit under /api/instagram/intelligence and use the long AI
// timeout — cold provider calls can legitimately take 15-25s.
export const getInstagramRecommendations = (accountId) =>
  api
    .get('/api/instagram/intelligence/recommendations', {
      params: { accountId },
      timeout: AI_TIMEOUT,
    })
    .then((r) => r.data?.data || { recommendations: [], meta: {} })

export const getInstagramBestTimes = (accountId) =>
  api
    .get('/api/instagram/intelligence/best-times', {
      params: { accountId },
      timeout: AI_TIMEOUT,
    })
    .then((r) => r.data?.data || { bestSlots: [], distributionByHour: [], distributionByDay: [] })

export const getInstagramGrowthOpportunities = (accountId) =>
  api
    .get('/api/instagram/intelligence/growth-opportunities', {
      params: { accountId },
      timeout: AI_TIMEOUT,
    })
    .then((r) => r.data?.data || { opportunities: [], unansweredQuestions: [] })

export const getInstagramCompetitors = (accountId) =>
  api
    .get('/api/instagram/intelligence/competitors', {
      params: { accountId },
      timeout: AI_TIMEOUT,
    })
    .then((r) => r.data?.data || { opportunities: [], competitors: [] })

export const getInstagramHashtags = (accountId) =>
  api
    .get('/api/instagram/intelligence/hashtags', {
      params: { accountId },
      timeout: AI_TIMEOUT,
    })
    .then((r) => r.data?.data || { hashtags: [], sourceBreakdown: {} })

export const generateInstagramContentIdeas = (payload) =>
  api
    .post('/api/instagram/intelligence/content-ideas', payload, { timeout: AI_TIMEOUT })
    .then((r) => r.data?.data || { ideas: [] })

export const getAIUsageStats = () =>
  api.get('/api/settings/ai-usage').then((r) => r.data)

export const updateAIBudgets = (payload) =>
  api.patch('/api/settings/ai-usage/budgets', payload).then((r) => r.data)

export const getAIUsageHistory = () =>
  api.get('/api/settings/ai-usage/history').then((r) => r.data)

export const getQueueMetrics = () =>
  api.get('/api/studio/queue/metrics').then((r) => r.data)

export default api




