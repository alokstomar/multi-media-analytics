import { useRef, useCallback, useState } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, Sparkles, Loader2 } from 'lucide-react'
import { useScriptWorkspace } from '../components/script-workspace/useScriptWorkspace'
import WorkspaceHeader from '../components/script-workspace/WorkspaceHeader'
import IdeaSummary from '../components/script-workspace/IdeaSummary'
import ScriptEditor from '../components/script-workspace/ScriptEditor'
import StyleMatchPanel from '../components/script-workspace/StyleMatchPanel'
import VideoGenerationPlaceholder from '../components/script-workspace/VideoGenerationPlaceholder'
import ResearchWorkspace from '../components/script-workspace/research/ResearchWorkspace'
import ContentHealthCard from '../components/script-workspace/research/ContentHealthCard'
import { ErrorState } from '../components/content-intelligence/StateShells'

export default function ScriptWorkspace() {
  const { channelId, ideaId } = useParams()
  const location = useLocation()
  const initialIdea = location.state?.idea || null

  const editorRef = useRef(null)

  const {
    status,
    workspace,
    creatorStyle,
    recommendation,
    working,
    styleMatch,
    saveState,
    lastSavedAt,
    error,
    isUnavailable,
    isRegenerating,
    generate,
    editField,
    undo,
    redo,
    transform,
    replaceWorkspace,
    canUndo,
    canRedo,
  } = useScriptWorkspace({ channelId, ideaId, initialIdea })

  const channel = workspace?.channel || {}
  const recForDisplay = recommendation || workspace?.recommendation || initialIdea || {}

  // Latest research report lifted from ResearchWorkspace so ContentHealthCard
  // can read the research score without re-fetching.
  const [researchReport, setResearchReport] = useState(null)

  const handleGenerate = useCallback(({ mode = 'similar', regenerate = false } = {}) => {
    generate({ mode, regenerate }).catch(() => { /* surfaced via state */ })
  }, [generate])

  const handleRescore = useCallback(() => {
    // Phase 2+ will wire this to /style-score. For Phase 1, it's a no-op stub
    // that the StyleMatchPanel renders correctly without.
  }, [])

  // When a research suggestion is applied, the backend returns the updated
  // workspace (with a new version pushed). Adopt it without triggering
  // autosave — the server is already the source of truth.
  const handleSuggestionApplied = useCallback((updatedWorkspace) => {
    replaceWorkspace(updatedWorkspace)
  }, [replaceWorkspace])

  // Jump-to-editor: smooth scroll to the field, native-find the snippet to
  // select it, and apply a temporary violet ring around the field that fades
  // out after ~2 seconds. No backend changes — pure DOM manipulation.
  const handleJumpTo = useCallback((field, snippet) => {
    try {
      const el = document.querySelector(`[data-field="${field}"]`)
      if (!el) return
      if (el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' })

      // Apply temporary violet ring that fades out via transition.
      const prevBoxShadow = el.style.boxShadow
      const prevTransition = el.style.transition
      el.style.transition = 'box-shadow 0.4s ease-in-out'
      el.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.45), 0 0 0 6px rgba(139, 92, 246, 0.15)'

      // Try to select the snippet (native browser find). Selection is visible
      // to the user as the standard text highlight.
      if (snippet && typeof window.find === 'function') {
        setTimeout(() => {
          try { window.find(snippet, false, true, false, true, true, false) } catch { /* no-op */ }
        }, 250)
      }

      // Fade out highlight after 2s, then restore inline styles.
      setTimeout(() => {
        el.style.boxShadow = prevBoxShadow
        setTimeout(() => {
          el.style.transition = prevTransition
        }, 450)
      }, 2000)
    } catch { /* no-op */ }
  }, [])

  // Lifted report state — used by ContentHealthCard.
  const handleReportChange = useCallback((r) => {
    setResearchReport(r)
  }, [])

  return (
    <div className="min-h-screen space-y-6">
      <WorkspaceHeader
        channel={channel}
        saveState={saveState}
        lastSavedAt={lastSavedAt}
        isRegenerating={isRegenerating}
      />

      <AnimatePresence mode="wait">
        {status === 'loading' && (
          <motion.div key="loader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <LoadingShell />
          </motion.div>
        )}

        {status === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border border-gray-100 bg-white p-12"
          >
            {isUnavailable ? (
              <div className="text-center space-y-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500 mx-auto">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-gray-700">AI service temporarily unavailable</p>
                <p className="text-xs text-gray-500">Try again in a few moments.</p>
              </div>
            ) : (
              <ErrorState
                message={error?.response?.data?.error?.message || 'Failed to load workspace'}
              />
            )}
          </motion.div>
        )}

        {(status === 'ready' || status === 'empty') && (
          <motion.div
            key="ready"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="space-y-6"
          >
            {/* Idea Summary */}
            <IdeaSummary
              recommendation={recForDisplay}
              channel={channel}
              styleMatch={styleMatch}
            />

            {/* Empty-state CTA — first visit, no script yet */}
            {status === 'empty' && (
              <EmptyGenerateCard
                isRegenerating={isRegenerating}
                onGenerate={() => handleGenerate({ mode: 'similar' })}
              />
            )}

            {/* Editor + Style Match panel */}
            {status === 'ready' && (
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 items-start">
                <div className="space-y-6">
                  <ScriptEditor
                    ref={editorRef}
                    working={working}
                    onEditField={editField}
                    onUndo={undo}
                    onRedo={redo}
                    onTransform={transform}
                    canUndo={canUndo}
                    canRedo={canRedo}
                    isTransforming={isRegenerating}
                  />
                </div>
                <div className="space-y-6 xl:sticky xl:top-6">
                  <StyleMatchPanel
                    styleMatch={styleMatch}
                    onRescore={handleRescore}
                    isScoring={false}
                  />
                  <CreatorStyleCard creatorStyle={creatorStyle} />
                  <ContentHealthCard
                    styleMatchScore={styleMatch?.overall}
                    researchScore={researchReport?.report?.researchScore?.overall}
                    publishScore={researchReport?.report?.researchScore?.overall}
                  />
                </div>
              </div>
            )}

            {/* Full-width Research Workspace — vertical pipeline below editor */}
            {status === 'ready' && (
              <ResearchWorkspace
                channelId={channelId}
                ideaId={ideaId}
                working={working}
                currentVersion={workspace?.cursor != null ? workspace?.cursor + 1 : (workspace?.versions?.length || null)}
                onSuggestionApplied={handleSuggestionApplied}
                onJumpTo={handleJumpTo}
                onReportChange={handleReportChange}
              />
            )}

            {/* Future modules */}
            <VideoGenerationPlaceholder />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Regen overlay */}
      <AnimatePresence>
        {isRegenerating && status !== 'loading' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-white/70 backdrop-blur-sm flex items-center justify-center"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-100 border-t-violet-600" />
              <p className="text-[12.5px] font-bold text-gray-700">
                {status === 'empty' ? 'Analyzing channel & generating script…' : 'Applying transformation…'}
              </p>
              <p className="text-[11px] text-gray-400">This may take 15-25 seconds</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function LoadingShell() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="rounded-2xl border border-gray-100 bg-white h-40" />
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
        <div className="rounded-2xl border border-gray-100 bg-white h-[600px]" />
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-100 bg-white h-72" />
          <div className="rounded-2xl border border-gray-100 bg-white h-48" />
        </div>
      </div>
    </div>
  )
}

function EmptyGenerateCard({ isRegenerating, onGenerate }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-2xl border border-violet-100 bg-white p-8 lg:p-10"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 12px 32px -8px rgba(139, 92, 246, 0.18)' }}
    >
      <div className="flex flex-col items-center text-center gap-4 max-w-lg mx-auto">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
          <Sparkles className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <h2 className="text-[18px] font-bold text-gray-900 tracking-tight">Ready to write in {`{channel}'s`} voice</h2>
          <p className="text-[13px] text-gray-500 leading-relaxed">
            Click below to analyze the creator's historical content and generate a complete script
            that imitates their style — title, hook, full script, CTA, description, and hashtags.
          </p>
        </div>
        <button
          onClick={onGenerate}
          disabled={isRegenerating}
          className="mt-2 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-violet-700 px-5 py-2.5 text-[13px] font-bold text-white hover:from-violet-700 hover:to-violet-800 transition shadow-lg shadow-violet-500/20 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          {isRegenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing & writing…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate Script
            </>
          )}
        </button>
      </div>
    </motion.div>
  )
}

function CreatorStyleCard({ creatorStyle }) {
  const profile = creatorStyle?.profile
  if (!profile) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-2xl border border-gray-100 bg-white p-5"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)' }}
      >
        <h3 className="text-[13.5px] font-bold text-gray-900 mb-2">Creator Style Profile</h3>
        <p className="text-[11.5px] text-gray-500 leading-relaxed">
          Profile builds automatically when you generate a script. It captures the creator's voice,
          hook style, vocabulary, and retention patterns.
        </p>
      </motion.section>
    )
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-gray-100 bg-white p-5 space-y-3"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-[13.5px] font-bold text-gray-900">Creator Style Profile</h3>
        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[9.5px] font-bold text-emerald-700 border border-emerald-100 uppercase tracking-wider">
          Learned
        </span>
      </div>
      {profile.summary && (
        <p className="text-[12px] text-gray-700 leading-relaxed">{profile.summary}</p>
      )}
      <div className="grid grid-cols-2 gap-2 pt-1">
        {profile.hookStyle && (
          <StyleChip label="Hook" value={profile.hookStyle} />
        )}
        {profile.ctaStyle && (
          <StyleChip label="CTA" value={profile.ctaStyle} />
        )}
        {profile.writingTone && (
          <StyleChip label="Tone" value={profile.writingTone} />
        )}
        {profile.titleStyle && (
          <StyleChip label="Titles" value={profile.titleStyle} />
        )}
      </div>
      {Array.isArray(profile.vocabulary?.signatureWords) && profile.vocabulary.signatureWords.length > 0 && (
        <div className="pt-1">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Signature Words</p>
          <div className="flex flex-wrap gap-1">
            {profile.vocabulary.signatureWords.slice(0, 8).map((w) => (
              <span
                key={w}
                className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10.5px] font-semibold text-violet-700 border border-violet-100"
              >
                {w}
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.section>
  )
}

function StyleChip({ label, value }) {
  if (!value) return null
  const display = String(value).replace(/-/g, ' ')
  return (
    <div className="rounded-lg bg-gray-50 border border-gray-100 px-2.5 py-1.5">
      <p className="text-[9.5px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-[11.5px] font-semibold text-gray-700 capitalize mt-0.5 truncate">{display}</p>
    </div>
  )
}
