import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import {
  getResearchReport,
  analyzeResearch,
  applyResearchSuggestion,
  ignoreResearchSuggestion,
} from '../../../services/api'

// ── Hybrid trigger ──────────────────────────────────────────────────────────
// On mount: if working.fullScript.length > 200 and no report yet, fire GET
// (which triggers server-side analysis on cache miss). After first analysis,
// only manual `analyze()` triggers re-runs. When `working` changes such that
// the local hash differs from the cached one, expose `stale: true` so the
// UI can show "Script changed. Re-analyze?".

const WORD_THRESHOLD = 1

function wordCount(text) {
  return text ? text.trim().split(/\s+/).filter(Boolean).length : 0
}

function localHash(working) {
  // Lightweight client-side fingerprint — only used to detect change vs the
  // server's cached hash. The authoritative hash is computed server-side.
  const s = `${working?.fullScript || ''}\n${working?.title || ''}`
  let h = 5381
  for (let i = 0; i < s.length; i += 1) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0
  }
  return String(h)
}

const initialState = {
  status: 'idle',          // 'idle' | 'loading' | 'ready' | 'error'
  report: null,            // ResearchReport doc (raw)
  scriptHash: null,        // hash at the time of last analysis
  limitedVerification: true,
  providerUsed: { ai: 'deepseek', search: 'stub' },
  stale: false,            // true when local working differs from cached hash
  isAnalyzing: false,
  applyingSuggestionId: null,
  error: null,
  autoTriggered: false,    // ensure first-open auto-fire happens only once
}

function reducer(state, action) {
  switch (action.type) {
    case 'RESET':
      return { ...initialState, autoTriggered: state.autoTriggered }
    case 'LOAD_START':
      return { ...state, status: 'loading', isAnalyzing: true, error: null }
    case 'LOAD_SUCCESS': {
      const report = action.report
      return {
        ...state,
        status: 'ready',
        report,
        scriptHash: action.scriptHash,
        limitedVerification: action.limitedVerification,
        providerUsed: action.providerUsed,
        isAnalyzing: false,
        stale: false,
        error: null,
      }
    }
    case 'LOAD_ERROR':
      return { ...state, status: 'error', isAnalyzing: false, error: action.error }
    case 'SET_STALE':
      return { ...state, stale: action.stale }
    case 'APPLY_START':
      return { ...state, applyingSuggestionId: action.suggestionId }
    case 'APPLY_SUCCESS': {
      // Workspace changed — caller refetches the workspace separately. We
      // just refresh the report state from the response and clear applying.
      return {
        ...state,
        report: action.report || state.report,
        applyingSuggestionId: null,
      }
    }
    case 'APPLY_ERROR':
      return { ...state, applyingSuggestionId: null }
    case 'IGNORE_SUCCESS':
      return { ...state, report: action.report || state.report }
    case 'MARK_AUTO_TRIGGERED':
      return { ...state, autoTriggered: true }
    default:
      return state
  }
}

export function useResearchWorkspace({ channelId, ideaId, working, enabled = true }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const fullScript = working?.fullScript || ''
  const enoughContent = wordCount(fullScript) >= WORD_THRESHOLD
  const localHashRef = useRef(localHash(working))
  const lastAnalyzedHashRef = useRef(null)

  // Track hash of working in a ref so we can detect drift from the cached
  // server hash and mark the report stale.
  useEffect(() => {
    localHashRef.current = localHash(working)
    if (!state.report) return
    const drift = localHashRef.current !== lastAnalyzedHashRef.current
    dispatch({ type: 'SET_STALE', stale: drift })
  }, [working, state.report])

  // ── Bootstrap: GET research (auto-triggers server-side analysis on miss) ──
  // `force` is accepted for symmetry with the analyze endpoint but is a
  // no-op on GET — the server decides whether to re-run based on scriptHash.
  const load = useCallback(async () => {
    if (!channelId || !ideaId) return
    dispatch({ type: 'LOAD_START' })
    try {
      const res = await getResearchReport(channelId, ideaId)
      const data = res?.data || {}
      dispatch({
        type: 'LOAD_SUCCESS',
        report: data.report,
        scriptHash: data.scriptHash,
        limitedVerification: data.limitedVerification,
        providerUsed: data.providerUsed || { ai: 'deepseek', search: 'stub' },
      })
      lastAnalyzedHashRef.current = localHashRef.current
    } catch (err) {
      dispatch({ type: 'LOAD_ERROR', error: err })
    }
  }, [channelId, ideaId])

  // First-open auto-trigger: only when script has enough content and we
  // haven't already fired in this session.
  useEffect(() => {
    if (!enabled || !channelId || !ideaId || !enoughContent) return
    if (state.autoTriggered || state.status !== 'idle') return
    dispatch({ type: 'MARK_AUTO_TRIGGERED' })
    load()
  }, [enabled, channelId, ideaId, enoughContent, state.autoTriggered, state.status, load])

  // Manual re-analyze
  const analyze = useCallback(async () => {
    if (!channelId || !ideaId) return
    dispatch({ type: 'LOAD_START' })
    try {
      const res = await analyzeResearch(channelId, ideaId)
      const data = res?.data || {}
      dispatch({
        type: 'LOAD_SUCCESS',
        report: data.report,
        scriptHash: data.scriptHash,
        limitedVerification: data.limitedVerification,
        providerUsed: data.providerUsed || { ai: 'deepseek', search: 'stub' },
      })
      lastAnalyzedHashRef.current = localHashRef.current
    } catch (err) {
      dispatch({ type: 'LOAD_ERROR', error: err })
    }
  }, [channelId, ideaId])

  // Apply a suggestion. Returns the updated workspace so the caller can
  // sync its local state.
  const applySuggestion = useCallback(async (suggestionId) => {
    if (!channelId || !ideaId || !suggestionId) return null
    dispatch({ type: 'APPLY_START', suggestionId })
    try {
      const res = await applyResearchSuggestion(channelId, ideaId, suggestionId)
      const data = res?.data || {}
      dispatch({ type: 'APPLY_SUCCESS', report: data.report })
      return data.workspace || null
    } catch (err) {
      dispatch({ type: 'APPLY_ERROR' })
      throw err
    }
  }, [channelId, ideaId])

  const ignoreSuggestion = useCallback(async (suggestionId) => {
    if (!channelId || !ideaId || !suggestionId) return
    try {
      const res = await ignoreResearchSuggestion(channelId, ideaId, suggestionId)
      const data = res?.data || {}
      dispatch({ type: 'IGNORE_SUCCESS', report: data.report })
    } catch {
      // soft-fail — ignore errors so the UI stays responsive
    }
  }, [channelId, ideaId])

  return useMemo(() => ({
    ...state,
    enoughContent,
    load,
    analyze,
    applySuggestion,
    ignoreSuggestion,
  }), [state, enoughContent, load, analyze, applySuggestion, ignoreSuggestion])
}
