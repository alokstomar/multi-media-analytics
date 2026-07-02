import { useCallback, useEffect, useRef, useState } from 'react'
import { generateProductionScript } from '../../services/api'
import { generateVideoIdeas as apiGenerateVideoIdeas } from '../../services/api'
import { isAiUnavailable } from '../content-intelligence/StateShells'

// State machine for the script page.
//   status: 'loading' | 'ready' | 'error'
// On mount: kicks off generateProductionScript(channelId, ideaId).
//   - First hit is usually cold (15-25s); subsequent hits are near-instant
//     because the backend caches via cachedAI('production-script').
//   - Regenerate action bypasses the cache on the server (regenerate=true)
//     and forces a fresh OpenAI call. The dedupe key differs in regen mode
//     so a cached in-flight promise can't mask a regeneration request.
export function useScriptGeneration({ channelId, ideaId, initialIdea = null }) {
  const [status, setStatus] = useState('loading')
  const [script, setScript] = useState(null)
  const [recommendation, setRecommendation] = useState(initialIdea)
  const [generatedAt, setGeneratedAt] = useState(null)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [error, setError] = useState(null)
  const mountedRef = useRef(true)

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])

  const fetchScript = useCallback(async ({ regenerate = false } = {}) => {
    if (!channelId || !ideaId) return
    if (regenerate) setIsRegenerating(true)
    else setStatus('loading')
    setError(null)

    try {
      const res = await generateProductionScript(channelId, ideaId, { regenerate })
      if (!mountedRef.current) return
      const data = res?.data || {}
      setScript(data)
      setGeneratedAt(res?.data?.meta?.requestedAt || new Date().toISOString())
      // Backfill recommendation metadata from the AI response's hero fields
      // if we don't already have it (e.g., direct URL access with no state).
      setRecommendation((prev) => prev ? { ...prev, ...(data.heroTitle ? { title: data.heroTitle } : {}) } : prev)
      setStatus('ready')
    } catch (err) {
      if (!mountedRef.current) return
      setError(err)
      setStatus('error')
    } finally {
      if (mountedRef.current) setIsRegenerating(false)
    }
  }, [channelId, ideaId])

  // Initial script fetch. Runs once per (channelId, ideaId) — recommendation
  // is intentionally omitted from deps because we set it asynchronously below
  // and don't want it to trigger a refetch. setState calls inside fetchScript
  // happen after `await`, not synchronously, so the cascading-render warning
  // does not actually apply.
  useEffect(() => {
    if (!channelId || !ideaId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchScript()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, ideaId])

  // If we lack a recommendation (direct URL access), try to fetch it from
  // the existing ideas cache so the hero renders correctly during load.
  useEffect(() => {
    if (!channelId || !ideaId || recommendation) return
    let cancelled = false
    apiGenerateVideoIdeas(channelId)
      .then((res) => {
        if (cancelled) return
        const match = (res?.data?.ideas || []).find((i) => String(i.id) === String(ideaId))
        if (match && mountedRef.current) setRecommendation(match)
      })
      .catch(() => { /* non-blocking; hero will fall back gracefully */ })
    return () => { cancelled = true }
  }, [channelId, ideaId, recommendation])

  const regenerate = useCallback(() => fetchScript({ regenerate: true }), [fetchScript])
  const retry = useCallback(() => fetchScript(), [fetchScript])

  const isUnavailable = error ? isAiUnavailable(error) : false

  return {
    status,
    script,
    recommendation,
    generatedAt,
    isRegenerating,
    error,
    isUnavailable,
    regenerate,
    retry,
  }
}
