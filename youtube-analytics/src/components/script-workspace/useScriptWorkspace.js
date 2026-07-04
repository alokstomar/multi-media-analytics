import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import {
  getScriptWorkspace,
  generateStyledScript,
  saveScriptWorkspace,
  undoScriptWorkspace,
  redoScriptWorkspace,
  transformScript,
} from '../../services/api'
import { isAiUnavailable } from '../content-intelligence/StateShells'

// ── Editor state machine ────────────────────────────────────────────────────
// Working state is a local reducer so the editor feels instant on every
// keystroke. We sync to the server via debounced autosave. The server is the
// source of truth for undo/redo (so other tabs/sessions stay consistent) —
// when the user clicks Undo/Redo we hit the server and adopt its response.
const EMPTY_WORKING = { title: '', hook: '', fullScript: '', cta: '', description: '', hashtags: [] }

const initialState = {
  status: 'loading',          // 'loading' | 'ready' | 'error' | 'empty'
  workspaceId: null,
  workspace: null,
  creatorStyle: null,
  recommendation: null,
  working: EMPTY_WORKING,
  styleMatch: null,
  saveState: 'idle',          // 'idle' | 'saving' | 'saved' | 'error'
  lastSavedAt: null,
  error: null,
  isUnavailable: false,
  isRegenerating: false,
}

function reducer(state, action) {
  switch (action.type) {
    case 'BOOT_RESET':
      return { ...initialState }
    case 'BOOT_LOADED': {
      const ws = action.workspace
      const hasScript = Boolean(ws?.working?.fullScript?.trim())
      return {
        ...state,
        status: hasScript ? 'ready' : 'empty',
        workspaceId: ws?._id || null,
        workspace: ws,
        creatorStyle: action.creatorStyle || null,
        recommendation: ws?.recommendation || action.recommendation || null,
        working: ws?.working || EMPTY_WORKING,
        styleMatch: ws?.styleMatch || null,
        lastSavedAt: ws?.lastSavedAt || null,
      }
    }
    case 'BOOT_ERROR':
      return { ...state, status: 'error', error: action.error, isUnavailable: isAiUnavailable(action.error) }
    case 'GENERATE_START':
      return { ...state, status: state.status === 'ready' ? 'ready' : 'loading', isRegenerating: true }
    case 'GENERATE_SUCCESS': {
      const ws = action.workspace
      return {
        ...state,
        status: 'ready',
        isRegenerating: false,
        workspaceId: ws?._id || state.workspaceId,
        workspace: ws,
        creatorStyle: action.creatorStyle || state.creatorStyle,
        working: ws?.working || state.working,
        styleMatch: ws?.styleMatch || action.styleMatch || state.styleMatch,
        lastSavedAt: ws?.lastSavedAt || new Date().toISOString(),
      }
    }
    case 'GENERATE_ERROR':
      return { ...state, isRegenerating: false, error: action.error, isUnavailable: isAiUnavailable(action.error) }
    case 'EDIT_FIELD': {
      // Optimistic local update — server autosave is debounced.
      const nextWorking = { ...state.working, [action.field]: action.value }
      return { ...state, working: nextWorking, saveState: 'saving' }
    }
    case 'SET_WORKING':
      return { ...state, working: action.working, saveState: 'saving' }
    case 'SAVE_SUCCESS':
      return {
        ...state,
        workspace: action.workspace || state.workspace,
        workspaceId: action.workspace?._id || state.workspaceId,
        saveState: 'saved',
        lastSavedAt: new Date().toISOString(),
      }
    case 'SAVE_ERROR':
      return { ...state, saveState: 'error' }
    case 'UNDO_REDO_SUCCESS': {
      const ws = action.workspace
      return {
        ...state,
        workspace: ws,
        workspaceId: ws?._id || state.workspaceId,
        working: ws?.working || state.working,
        saveState: 'idle',
        lastSavedAt: ws?.lastSavedAt || new Date().toISOString(),
      }
    }
    case 'REPLACE_WORKSPACE': {
      // Used when another module (e.g. Research Workspace Apply) updated the
      // workspace server-side and we want to adopt the new state without
      // triggering autosave (which would double-save).
      const ws = action.workspace
      return {
        ...state,
        workspace: ws,
        workspaceId: ws?._id || state.workspaceId,
        working: ws?.working || state.working,
        saveState: 'idle',
        lastSavedAt: ws?.lastSavedAt || new Date().toISOString(),
      }
    }
    case 'TRANSFORM_SUCCESS': {
      const ws = action.workspace
      return {
        ...state,
        workspace: ws,
        working: ws?.working || state.working,
        saveState: 'idle',
        lastSavedAt: ws?.lastSavedAt || new Date().toISOString(),
      }
    }
    case 'SET_STYLE_MATCH':
      return { ...state, styleMatch: action.styleMatch }
    default:
      return state
  }
}

// ── Hook ────────────────────────────────────────────────────────────────────
export function useScriptWorkspace({ channelId, ideaId, initialIdea = null }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const autosaveTimerRef = useRef(null)
  const lastSavedWorkingRef = useRef(null)

  // ── Bootstrap: GET /script-workspace/:ideaId ──────────────────────────────
  useEffect(() => {
    if (!channelId || !ideaId) return
    let cancelled = false
    dispatch({ type: 'BOOT_RESET' })
    getScriptWorkspace(channelId, ideaId)
      .then((res) => {
        if (cancelled) return
        const data = res?.data || {}
        dispatch({
          type: 'BOOT_LOADED',
          workspace: data.workspace,
          creatorStyle: data.creatorStyle,
          recommendation: initialIdea,
        })
        // Track the last-saved working state so autosave only fires on real diffs.
        lastSavedWorkingRef.current = JSON.stringify(data.workspace?.working || EMPTY_WORKING)
      })
      .catch((err) => {
        if (!cancelled) dispatch({ type: 'BOOT_ERROR', error: err })
      })
    return () => { cancelled = true }
  }, [channelId, ideaId, initialIdea])

  // ── Generate (initial or regenerate) ───────────────────────────────────────
  const generate = useCallback(async ({ mode = 'similar', regenerate = false } = {}) => {
    if (!channelId || !ideaId) return
    dispatch({ type: 'GENERATE_START' })
    try {
      const res = await generateStyledScript(channelId, ideaId, {
        mode,
        regenerate,
        recommendation: initialIdea,
      })
      const data = res?.data || {}
      dispatch({
        type: 'GENERATE_SUCCESS',
        workspace: data.workspace,
        creatorStyle: data.creatorStyle,
        styleMatch: data.styleMatch,
      })
      lastSavedWorkingRef.current = JSON.stringify(data.workspace?.working || EMPTY_WORKING)
    } catch (err) {
      dispatch({ type: 'GENERATE_ERROR', error: err })
      throw err
    }
  }, [channelId, ideaId, initialIdea])

  // ── Field edit with debounced autosave ─────────────────────────────────────
  const editField = useCallback((field, value) => {
    dispatch({ type: 'EDIT_FIELD', field, value })
  }, [])

  // Autosave: 800ms after the last edit, if working differs from last saved.
  useEffect(() => {
    if (!channelId || !ideaId || !state.workspaceId) return
    if (state.status !== 'ready') return
    if (state.saveState !== 'saving') return

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = setTimeout(async () => {
      const snapshot = JSON.stringify(state.working)
      if (snapshot === lastSavedWorkingRef.current) return
      try {
        const res = await saveScriptWorkspace(channelId, ideaId, {
          working: state.working,
          source: 'user-edit',
          commit: false,
        })
        const data = res?.data || {}
        lastSavedWorkingRef.current = snapshot
        dispatch({ type: 'SAVE_SUCCESS', workspace: data.workspace })
      } catch (err) {
        dispatch({ type: 'SAVE_ERROR' })
      }
    }, 800)

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    }
  }, [state.working, state.workspaceId, state.status, state.saveState, channelId, ideaId])

  // ── Undo / Redo ────────────────────────────────────────────────────────────
  const undo = useCallback(async () => {
    if (!channelId || !ideaId) return
    try {
      const res = await undoScriptWorkspace(channelId, ideaId)
      const data = res?.data || {}
      dispatch({ type: 'UNDO_REDO_SUCCESS', workspace: data.workspace })
      lastSavedWorkingRef.current = JSON.stringify(data.workspace?.working || EMPTY_WORKING)
    } catch (err) {
      dispatch({ type: 'SAVE_ERROR' })
    }
  }, [channelId, ideaId])

  const redo = useCallback(async () => {
    if (!channelId || !ideaId) return
    try {
      const res = await redoScriptWorkspace(channelId, ideaId)
      const data = res?.data || {}
      dispatch({ type: 'UNDO_REDO_SUCCESS', workspace: data.workspace })
      lastSavedWorkingRef.current = JSON.stringify(data.workspace?.working || EMPTY_WORKING)
    } catch (err) {
      dispatch({ type: 'SAVE_ERROR' })
    }
  }, [channelId, ideaId])

  // ── Transform (shorter, longer, viral, etc.) ──────────────────────────────
  const transform = useCallback(async (action) => {
    if (!channelId || !ideaId) return
    dispatch({ type: 'GENERATE_START' })
    try {
      const res = await transformScript(channelId, ideaId, { action })
      const data = res?.data || {}
      dispatch({ type: 'TRANSFORM_SUCCESS', workspace: data.workspace })
      lastSavedWorkingRef.current = JSON.stringify(data.workspace?.working || EMPTY_WORKING)
    } catch (err) {
      dispatch({ type: 'GENERATE_ERROR', error: err })
      throw err
    }
  }, [channelId, ideaId])

  // ── Replace workspace (used by Research Workspace Apply) ─────────────────
  // Adopts a server-returned workspace without triggering autosave. Used
  // when another module updated the workspace server-side (e.g. a research
  // suggestion was applied → new version pushed).
  const replaceWorkspace = useCallback((workspace) => {
    if (!workspace) return
    dispatch({ type: 'REPLACE_WORKSPACE', workspace })
    lastSavedWorkingRef.current = JSON.stringify(workspace?.working || EMPTY_WORKING)
  }, [])

  // ── Derived ───────────────────────────────────────────────────────────────
  const canUndo = (state.workspace?.versions?.length || 0) > 1 && (state.workspace?.cursor || 0) > 0
  const canRedo = (state.workspace?.cursor || 0) < (state.workspace?.versions?.length || 0) - 1

  return useMemo(() => ({
    ...state,
    generate,
    editField,
    undo,
    redo,
    transform,
    replaceWorkspace,
    canUndo,
    canRedo,
  }), [state, generate, editField, undo, redo, transform, replaceWorkspace, canUndo, canRedo])
}
