import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import {
  getThumbnailWorkspace,
  generateThumbnailStrategy,
  saveThumbnailStrategy,
  undoThumbnailStrategy,
  redoThumbnailStrategy,
  scoreThumbnailSimilarity,
} from '../../../services/api'
import { isAiUnavailable } from '../../content-intelligence/StateShells'

// ── Thumbnail Workspace state machine ───────────────────────────────────────
// Mirrors useScriptWorkspace's pattern: local reducer for instant UI feedback,
// debounced autosave for prompt edits, server-authoritative undo/redo.
//
// working = { title, concepts[], prompt, similarity }
// The prompt is the primary editable surface — concepts are AI-generated and
// read-only (regenerate to change them). Title mirrors the recommendation and
// is also editable but rarely touched.

const EMPTY_WORKING = { title: '', concepts: [], prompt: '', similarity: {} }

const initialState = {
  status: 'idle',            // 'idle' | 'loading' | 'ready' | 'error' | 'empty'
  strategy: null,            // ThumbnailStrategy doc (raw)
  thumbnailProfile: null,    // ThumbnailProfile doc (DNA)
  working: EMPTY_WORKING,
  saveState: 'idle',         // 'idle' | 'saving' | 'saved' | 'error'
  lastSavedAt: null,
  isGenerating: false,       // true during generate/regenerate
  isRescoring: false,        // true during similarity rescore
  error: null,
  isUnavailable: false,
  hasScript: false,          // whether the parent Script Workspace has a script
}

function reducer(state, action) {
  switch (action.type) {
    case 'RESET':
      return { ...initialState }
    case 'BOOT_START':
      return { ...state, status: 'loading' }
    case 'BOOT_LOADED': {
      const strat = action.strategy
      const hasWorking = Boolean(strat?.working?.prompt?.trim()) || (strat?.working?.concepts?.length || 0) > 0
      return {
        ...state,
        status: hasWorking ? 'ready' : 'empty',
        strategy: strat,
        thumbnailProfile: action.thumbnailProfile,
        working: strat?.working || EMPTY_WORKING,
        lastSavedAt: strat?.lastSavedAt || null,
        hasScript: action.hasScript,
      }
    }
    case 'BOOT_ERROR':
      return { ...state, status: 'error', error: action.error, isUnavailable: isAiUnavailable(action.error) }
    case 'SET_HAS_SCRIPT':
      return { ...state, hasScript: action.hasScript }
    case 'GENERATE_START':
      return { ...state, isGenerating: true, error: null }
    case 'GENERATE_SUCCESS': {
      const strat = action.strategy
      return {
        ...state,
        status: 'ready',
        isGenerating: false,
        strategy: strat,
        thumbnailProfile: action.thumbnailProfile || state.thumbnailProfile,
        working: strat?.working || state.working,
        lastSavedAt: strat?.lastSavedAt || new Date().toISOString(),
      }
    }
    case 'GENERATE_ERROR':
      return { ...state, isGenerating: false, error: action.error, isUnavailable: isAiUnavailable(action.error) }
    case 'EDIT_PROMPT':
      return { ...state, working: { ...state.working, prompt: action.value }, saveState: 'saving' }
    case 'SET_WORKING':
      return { ...state, working: action.working, saveState: 'saving' }
    case 'SAVE_SUCCESS':
      return {
        ...state,
        strategy: action.strategy || state.strategy,
        saveState: 'saved',
        lastSavedAt: new Date().toISOString(),
      }
    case 'SAVE_ERROR':
      return { ...state, saveState: 'error' }
    case 'UNDO_REDO_SUCCESS': {
      const strat = action.strategy
      return {
        ...state,
        strategy: strat,
        working: strat?.working || state.working,
        saveState: 'idle',
        lastSavedAt: strat?.lastSavedAt || new Date().toISOString(),
      }
    }
    case 'RESCORE_START':
      return { ...state, isRescoring: true }
    case 'RESCORE_SUCCESS': {
      const strat = action.strategy
      return {
        ...state,
        isRescoring: false,
        strategy: strat,
        working: strat?.working || state.working,
        lastSavedAt: strat?.lastSavedAt || new Date().toISOString(),
      }
    }
    case 'RESCORE_ERROR':
      return { ...state, isRescoring: false }
    default:
      return state
  }
}

// hasScriptRef: parent lets us know whether the Script Workspace has a script.
// If not, we render an "Empty — write a script first" state instead of the
// generate CTA.
export function useThumbnailWorkspace({ channelId, ideaId, scriptAvailable }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const autosaveTimerRef = useRef(null)
  const lastSavedWorkingRef = useRef(null)

  // Track scriptAvailable changes from the parent (Script Workspace state).
  useEffect(() => {
    dispatch({ type: 'SET_HAS_SCRIPT', hasScript: Boolean(scriptAvailable) })
  }, [scriptAvailable])

  // ── Bootstrap: GET thumbnail-workspace/:ideaId ─────────────────────────
  useEffect(() => {
    if (!channelId || !ideaId) return
    let cancelled = false
    dispatch({ type: 'BOOT_START' })
    getThumbnailWorkspace(channelId, ideaId)
      .then((res) => {
        if (cancelled) return
        const data = res?.data || {}
        dispatch({
          type: 'BOOT_LOADED',
          strategy: data.strategy,
          thumbnailProfile: data.thumbnailProfile,
          hasScript: Boolean(scriptAvailable),
        })
        lastSavedWorkingRef.current = JSON.stringify(data.strategy?.working || EMPTY_WORKING)
      })
      .catch((err) => {
        if (!cancelled) dispatch({ type: 'BOOT_ERROR', error: err })
      })
    return () => { cancelled = true }
  }, [channelId, ideaId, scriptAvailable])

  // ── Generate (initial or regenerate) ────────────────────────────────────
  const generate = useCallback(async ({ regenerate = false } = {}) => {
    if (!channelId || !ideaId) return
    dispatch({ type: 'GENERATE_START' })
    try {
      const res = await generateThumbnailStrategy(channelId, ideaId, { regenerate })
      const data = res?.data || {}
      dispatch({
        type: 'GENERATE_SUCCESS',
        strategy: data.strategy,
        thumbnailProfile: data.thumbnailProfile,
      })
      lastSavedWorkingRef.current = JSON.stringify(data.strategy?.working || EMPTY_WORKING)
    } catch (err) {
      dispatch({ type: 'GENERATE_ERROR', error: err })
      throw err
    }
  }, [channelId, ideaId])

  // ── Prompt edit with debounced autosave ────────────────────────────────
  const editPrompt = useCallback((value) => {
    dispatch({ type: 'EDIT_PROMPT', value })
  }, [])

  useEffect(() => {
    if (!channelId || !ideaId || !state.strategy?._id) return
    if (state.status !== 'ready') return
    if (state.saveState !== 'saving') return

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = setTimeout(async () => {
      const snapshot = JSON.stringify(state.working)
      if (snapshot === lastSavedWorkingRef.current) return
      try {
        const res = await saveThumbnailStrategy(channelId, ideaId, {
          working: state.working,
          source: 'user-edit',
          commit: false,
        })
        const data = res?.data || {}
        lastSavedWorkingRef.current = snapshot
        dispatch({ type: 'SAVE_SUCCESS', strategy: data.strategy })
      } catch {
        dispatch({ type: 'SAVE_ERROR' })
      }
    }, 800)

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    }
  }, [state.working, state.strategy?._id, state.status, state.saveState, channelId, ideaId])

  // ── Undo / Redo ──────────────────────────────────────────────────────────
  const undo = useCallback(async () => {
    if (!channelId || !ideaId) return
    try {
      const res = await undoThumbnailStrategy(channelId, ideaId)
      const data = res?.data || {}
      dispatch({ type: 'UNDO_REDO_SUCCESS', strategy: data.strategy })
      lastSavedWorkingRef.current = JSON.stringify(data.strategy?.working || EMPTY_WORKING)
    } catch {
      dispatch({ type: 'SAVE_ERROR' })
    }
  }, [channelId, ideaId])

  const redo = useCallback(async () => {
    if (!channelId || !ideaId) return
    try {
      const res = await redoThumbnailStrategy(channelId, ideaId)
      const data = res?.data || {}
      dispatch({ type: 'UNDO_REDO_SUCCESS', strategy: data.strategy })
      lastSavedWorkingRef.current = JSON.stringify(data.strategy?.working || EMPTY_WORKING)
    } catch {
      dispatch({ type: 'SAVE_ERROR' })
    }
  }, [channelId, ideaId])

  // ── Rescore similarity (cheap pass) ─────────────────────────────────────
  const rescore = useCallback(async () => {
    if (!channelId || !ideaId) return
    dispatch({ type: 'RESCORE_START' })
    try {
      const res = await scoreThumbnailSimilarity(channelId, ideaId, { strategy: state.working })
      const data = res?.data || {}
      dispatch({ type: 'RESCORE_SUCCESS', strategy: data.strategy })
      lastSavedWorkingRef.current = JSON.stringify(data.strategy?.working || EMPTY_WORKING)
    } catch {
      dispatch({ type: 'RESCORE_ERROR' })
    }
  }, [channelId, ideaId, state.working])

  // ── Derived ─────────────────────────────────────────────────────────────
  const versions = state.strategy?.versions || []
  const cursor = state.strategy?.cursor || 0
  const canUndo = versions.length > 1 && cursor > 0
  const canRedo = cursor < versions.length - 1

  return useMemo(() => ({
    ...state,
    generate,
    editPrompt,
    undo,
    redo,
    rescore,
    canUndo,
    canRedo,
  }), [state, generate, editPrompt, undo, redo, rescore, canUndo, canRedo])
}
