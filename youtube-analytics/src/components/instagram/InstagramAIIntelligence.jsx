import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, RefreshCw, AlertCircle, BrainCircuit } from 'lucide-react'

import { useInstagramAdapter } from '../../platformAdapters/instagramAdapter'
import AccountCarousel from './AccountCarousel'
import AIIntelligenceSkeleton from './AIIntelligenceSkeleton'
import RecommendationsPanel from './RecommendationsPanel'
import BestTimesPanel from './BestTimesPanel'
import CompetitorInsightsPanel from './CompetitorInsightsPanel'
import HashtagSuggestionsPanel from './HashtagSuggestionsPanel'
import ContentIdeasPanel from './ContentIdeasPanel'
import {
  getInstagramRecommendations,
  getInstagramBestTimes,
  getInstagramCompetitors,
  getInstagramHashtags,
  generateInstagramContentIdeas,
} from '../../services/api'

/* Each GET endpoint keeps its own status machine. State shape:
   { status: 'idle'|'loading'|'error'|'idle', data, error, fallback } */
const INITIAL_SLOT = { status: 'idle', data: null, error: '', fallback: false }

function slotReducer(prev, patch) {
  return { ...prev, ...patch }
}

export default function InstagramAIIntelligence() {
  const { accounts = [], selectedAccount, loading: adapterLoading } = useInstagramAdapter()
  const isDemo = !selectedAccount || selectedAccount.id === 'demo_ig'
  const activeAccount = isDemo ? null : selectedAccount
  const accountId = activeAccount?.id || ''

  const [rec, setRec] = useState(INITIAL_SLOT)
  const [best, setBest] = useState(INITIAL_SLOT)
  const [comp, setComp] = useState(INITIAL_SLOT)
  const [tags, setTags] = useState(INITIAL_SLOT)

  // Content ideas is POST-driven — separate machine.
  const [ideas, setIdeas] = useState(INITIAL_SLOT)

  const [refreshing, setRefreshing] = useState(false)
  const [pageError, setPageError] = useState('')
  const [toast, setToast] = useState('')

  // showToast helper — auto-clears after 2s
  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }, [])

  // Loader for one slot. Returns { data, fallback } or throws.
  const loadSlot = useCallback(async (key, fetcher, setter) => {
    setter((prev) => slotReducer(prev, { status: 'loading', error: '' }))
    try {
      const data = await fetcher()
      setter({
        status: 'idle',
            data,
            error: '',
            fallback: !!data?._fallback,
      })
      return { data, fallback: !!data?._fallback }
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        'Request failed'
      setter({ status: 'error', data: null, error: msg, fallback: false })
      return { data: null, fallback: false }
    }
  }, [])

  // Initial / refresh fetch — runs all 5 GET endpoints in parallel.
  const loadAll = useCallback(
    async (showRefreshing = false) => {
      if (!accountId) return
      if (showRefreshing) setRefreshing(true)
      setPageError('')

      const results = await Promise.allSettled([
        loadSlot('recommendations', () => getInstagramRecommendations(accountId), setRec),
        loadSlot('content-ideas', () => generateInstagramContentIdeas({ accountId, prompt: '' }), setIdeas),
        loadSlot('best-times', () => getInstagramBestTimes(accountId), setBest),
        loadSlot('competitors', () => getInstagramCompetitors(accountId), setComp),
        loadSlot('hashtags', () => getInstagramHashtags(accountId), setTags),
      ])

      // If everything failed, surface a single banner. Otherwise let each
      // panel render its own per-endpoint error state.
      const allFailed = results.every((r) => r.status === 'rejected' || (r.status === 'fulfilled' && r.value?.data === null))
      const anyFailed = results.some((r) => r.status === 'rejected' || (r.status === 'fulfilled' && r.value?.data === null))
      if (allFailed) {
        setPageError('AI intelligence is temporarily unavailable. Try refreshing.')
      } else if (anyFailed && showRefreshing) {
        setPageError('Some sections failed to load — partial data shown.')
      }

      if (showRefreshing) setRefreshing(false)
    },
    [accountId, loadSlot]
  )

  // Kick off the parallel load on mount + account change.
  useEffect(() => {
    if (!accounts.length || !accountId) return
    loadAll(false)
  }, [loadAll, accounts.length, accountId])

  // Content ideas generator (POST). Separate from the GET sweep — it's
  // user-triggered and has its own prompt state.
  const handleGenerateIdeas = useCallback(
    async (prompt) => {
      if (!accountId) return
      setIdeas((prev) => slotReducer(prev, { status: 'loading', error: '' }))
      try {
        const data = await generateInstagramContentIdeas({ accountId, prompt })
        setIdeas({
          status: 'idle',
          data,
          error: '',
          fallback: !!data?._fallback,
        })
      } catch (err) {
        const msg =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to generate ideas'
        setIdeas({ status: 'error', data: null, error: msg, fallback: false })
      }
    },
    [accountId]
  )

  const handleRefresh = useCallback(() => {
    loadAll(true)
  }, [loadAll])

  const anyLoading =
    rec.status === 'loading' &&
    best.status === 'loading' &&
    comp.status === 'loading' &&
    tags.status === 'loading'

  const initialLoading = adapterLoading && accounts.length === 0

  return (
    <div className="min-h-screen space-y-6">
      {/* Account carousel */}
      <AccountCarousel />

      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 shadow-sm">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <h1 className="text-[22px] font-bold text-gray-900 tracking-[-0.02em]">
                AI Intelligence
              </h1>
            </div>
            {activeAccount && (
              <>
                <span className="h-5 w-px bg-gray-200" />
                <span className="text-[14px] font-medium text-gray-400">{activeAccount.name}</span>
              </>
            )}
          </div>
          <p className="mt-1 text-[13px] text-gray-400">
            AI-driven recommendations, growth signals, and content ideas for your Instagram presence.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={refreshing || !activeAccount}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-[12px] font-semibold text-gray-600 hover:bg-gray-50 hover:text-gray-800 shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-purple-500' : ''}`} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </motion.div>

      {/* Page-level error banner */}
      <AnimatePresence>
        {pageError && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2.5"
          >
            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-[13px] font-bold text-red-900">Some data failed to load</p>
              <p className="text-[11px] text-red-700 mt-0.5">{pageError}</p>
            </div>
            <button
              onClick={() => setPageError('')}
              className="text-red-600 hover:text-red-800 text-xs font-bold cursor-pointer"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Body */}
      {initialLoading ? (
        <AIIntelligenceSkeleton />
      ) : !activeAccount ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 border border-purple-100 mx-auto mb-4">
            <BrainCircuit className="h-6 w-6 text-purple-300" />
          </div>
          <p className="text-sm font-bold text-gray-700">Connect an Instagram account to unlock AI Intelligence.</p>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            Recommendations, growth opportunities, and content ideas are generated for each connected account.
          </p>
        </div>
      ) : anyLoading && !rec.data ? (
        <AIIntelligenceSkeleton />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <RecommendationsPanel
            data={rec.data}
            status={rec.status}
            error={rec.error}
            fallback={rec.fallback}
            onRetry={() => loadSlot('recommendations', () => getInstagramRecommendations(accountId), setRec)}
          />
          <ContentIdeasPanel
            data={ideas.data}
            status={ideas.status}
            error={ideas.error}
            fallback={ideas.fallback}
            loading={ideas.status === 'loading'}
            onGenerate={handleGenerateIdeas}
            channelId={accountId}
          />
          <BestTimesPanel
            data={best.data}
            status={best.status}
            error={best.error}
            fallback={best.fallback}
          />
          <CompetitorInsightsPanel
            data={comp.data}
            status={comp.status}
            error={comp.error}
            fallback={comp.fallback}
            onRetry={() => loadSlot('competitors', () => getInstagramCompetitors(accountId), setComp)}
          />
          <HashtagSuggestionsPanel
            data={tags.data}
            status={tags.status}
            error={tags.error}
            fallback={tags.fallback}
            onToast={showToast}
            onRetry={() => loadSlot('hashtags', () => getInstagramHashtags(accountId), setTags)}
          />
        </div>
      )}

      {/* Toast (for hashtag copy confirmations) */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className="fixed bottom-6 left-1/2 z-50 rounded-xl bg-gray-900 text-white text-[12px] font-semibold px-4 py-2.5 shadow-lg flex items-center gap-2"
          >
            <Sparkles className="h-3.5 w-3.5 text-purple-300" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
