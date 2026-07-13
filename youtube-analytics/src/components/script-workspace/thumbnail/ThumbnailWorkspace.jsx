import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Image as ImageIcon, RefreshCw, Loader2, AlertCircle, ChevronDown,
  Sparkles, Wand2, Lock,
} from 'lucide-react'
import { useThumbnailWorkspace } from './useThumbnailWorkspace'
import {
  readCollapseState, writeCollapseState, LOADING_STAGES,
} from './thumbnailUtils'
import ThumbnailDNACard from './ThumbnailDNACard'
import ThumbnailConcepts from './ThumbnailConcepts'
import ThumbnailPromptCard from './ThumbnailPromptCard'
import ThumbnailSimilarityCard from './ThumbnailSimilarityCard'
import ThumbnailHistoryStrip from './ThumbnailHistoryStrip'

// Collapsed header chips — same pattern as ResearchWorkspace's CollapsedSummary.
function CollapsedSummary({ working, isGenerating }) {
  const conceptCount = working?.concepts?.length || 0
  const overall = working?.similarity?.overall
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {conceptCount > 0 && (
        <span className="inline-flex items-center gap-1 rounded-md border border-gray-100 bg-gray-50 px-1.5 py-0.5 text-[10px] font-bold text-gray-700 tabular-nums">
          {conceptCount} concept{conceptCount === 1 ? '' : 's'}
        </span>
      )}
      {overall != null && (
        <span className="inline-flex items-center gap-1 rounded-md border border-violet-100 bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-700 tabular-nums">
          DNA Match <span className="text-violet-900">{Math.round(overall)}</span>
        </span>
      )}
      {isGenerating && (
        <span className="inline-flex items-center gap-1 rounded-md border border-amber-100 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
          Generating…
        </span>
      )}
    </div>
  )
}

export default function ThumbnailWorkspace({ channelId, ideaId, scriptAvailable }) {
  const {
    status,
    strategy,
    thumbnailProfile,
    working,
    saveState,
    lastSavedAt,
    isGenerating,
    isRescoring,
    error,
    isUnavailable,
    hasScript,
    generate,
    editPrompt,
    undo,
    redo,
    rescore,
    canUndo,
    canRedo,
  } = useThumbnailWorkspace({ channelId, ideaId, scriptAvailable })

  const [collapsed, setCollapsed] = useState(() => readCollapseState())
  const [loadingStageIdx, setLoadingStageIdx] = useState(0)

  useEffect(() => { writeCollapseState(collapsed) }, [collapsed])

  // Cycle loading messages while generating.
  useEffect(() => {
    if (!isGenerating) {
      setLoadingStageIdx(0)
      return
    }
    const id = setInterval(() => {
      setLoadingStageIdx((i) => (i + 1) % LOADING_STAGES.length)
    }, 2200)
    return () => clearInterval(id)
  }, [isGenerating])

  const hasStrategy = status === 'ready' && (working?.concepts?.length || 0) > 0 && Boolean(working?.prompt?.trim())
  const showEmpty = !hasStrategy && status !== 'loading' && !isGenerating
  const overall = working?.similarity?.overall

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-gray-100 bg-white overflow-hidden"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-gray-100 bg-gray-50/50">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-2 min-w-0 cursor-pointer group"
          aria-expanded={!collapsed}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
            <ImageIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0 text-left">
            <h3 className="text-[13.5px] font-bold text-gray-900 truncate group-hover:text-gray-700">
              Thumbnail Intelligence
            </h3>
            <p className="text-[10.5px] text-gray-500 leading-none mt-0.5 truncate">
              Concepts, prompt & DNA similarity
            </p>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-gray-400 shrink-0 transition-transform ${collapsed ? '' : 'rotate-180'}`}
          />
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {collapsed && (hasStrategy || isGenerating) && (
            <CollapsedSummary working={working} isGenerating={isGenerating} />
          )}
          {hasStrategy && (
            <button
              onClick={() => generate({ regenerate: true })}
              disabled={isGenerating}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[10.5px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              title="Regenerate concepts & prompt"
            >
              {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              <span className="hidden sm:inline">{isGenerating ? 'Generating…' : 'Regenerate'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Expanded content */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="p-4 sm:p-5 space-y-4">
              {/* Hard error */}
              {status === 'error' && (
                <div className="rounded-xl border border-red-100 bg-red-50/60 p-4 text-center">
                  <AlertCircle className="h-5 w-5 text-red-500 mx-auto mb-2" />
                  <p className="text-[12px] font-semibold text-red-700">
                    {isUnavailable ? 'AI service temporarily unavailable.' : 'Thumbnail strategy failed to load.'}
                  </p>
                  <p className="text-[11px] text-red-600/80 mt-0.5">
                    {error?.response?.data?.error?.message || error?.message || 'Try again in a moment.'}
                  </p>
                </div>
              )}

              {/* Empty — no script yet */}
              {showEmpty && !hasScript && status !== 'error' && (
                <EmptyThumbnailState
                  variant="no-script"
                />
              )}

              {/* Empty — script exists but no strategy generated yet */}
              {showEmpty && hasScript && status !== 'error' && (
                <EmptyThumbnailState
                  variant="no-strategy"
                  onGenerate={() => generate({ regenerate: false })}
                  isGenerating={isGenerating}
                />
              )}

              {/* Loading shell (first time only) */}
              {(status === 'loading' || isGenerating) && !hasStrategy && status !== 'error' && (
                <LoadingShell stageLabel={LOADING_STAGES[loadingStageIdx]} />
              )}

              {/* Ready — full strategy UI */}
              {hasStrategy && (
                <>
                  {/* DNA card */}
                  <ThumbnailDNACard profile={thumbnailProfile?.profile} />

                  {/* Concepts */}
                  <ThumbnailConcepts concepts={working.concepts} />

                  {/* Editable prompt */}
                  <ThumbnailPromptCard
                    prompt={working.prompt}
                    onEdit={editPrompt}
                    saveState={saveState}
                    lastSavedAt={lastSavedAt}
                  />

                  {/* Similarity breakdown + rescore */}
                  <ThumbnailSimilarityCard
                    similarity={working.similarity}
                    onRescore={rescore}
                    isRescoring={isRescoring}
                  />

                  {/* Undo / Redo + version history strip */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={undo}
                        disabled={!canUndo}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[10.5px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                      >
                        Undo
                      </button>
                      <button
                        onClick={redo}
                        disabled={!canRedo}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[10.5px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                      >
                        Redo
                      </button>
                    </div>
                    <ThumbnailHistoryStrip strategy={strategy} />
                  </div>

                  {/* Disabled "Generate Thumbnail" — placeholder for Phase 3.2 */}
                  <Phase32Placeholder />
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  )
}

function LoadingShell({ stageLabel }) {
  return (
    <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-6">
      <div className="flex items-center gap-3 mb-4">
        <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
        <p className="text-[12px] font-bold text-violet-700">{stageLabel || 'Working…'}</p>
      </div>
      <div className="space-y-2.5 animate-pulse">
        <div className="h-3 bg-violet-100 rounded w-3/4" />
        <div className="h-3 bg-violet-100 rounded w-1/2" />
        <div className="h-16 bg-violet-100 rounded mt-3" />
        <div className="h-16 bg-violet-100 rounded" />
      </div>
    </div>
  )
}

function EmptyThumbnailState({ variant, onGenerate, isGenerating }) {
  if (variant === 'no-script') {
    return (
      <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-6 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-400 mx-auto mb-3">
          <ImageIcon className="h-5 w-5" />
        </div>
        <p className="text-[12.5px] font-semibold text-gray-700">Generate a script first</p>
        <p className="text-[11px] text-gray-500 mt-0.5 max-w-sm mx-auto">
          Thumbnail concepts are grounded in your script. Write or generate a script in the editor above to unlock thumbnail intelligence.
        </p>
      </div>
    )
  }

  // no-strategy
  return (
    <div
      className="rounded-xl border border-violet-100 bg-white p-6"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 8px 24px -6px rgba(139, 92, 246, 0.12)' }}
    >
      <div className="flex flex-col items-center text-center gap-3 max-w-md mx-auto">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
          <Wand2 className="h-6 w-6" />
        </div>
        <div className="space-y-1.5">
          <h4 className="text-[14px] font-bold text-gray-900">Design thumbnails in your style</h4>
          <p className="text-[11.5px] text-gray-500 leading-relaxed">
            We'll analyze your channel's visual DNA and generate 3-5 thumbnail concepts, an editable prompt, and a similarity score for each.
          </p>
        </div>
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className="mt-1 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-violet-700 px-4 py-2 text-[12px] font-bold text-white hover:from-violet-700 hover:to-violet-800 transition shadow-md shadow-violet-500/20 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Analyzing & designing…
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              Generate Thumbnail Strategy
            </>
          )}
        </button>
        <p className="text-[10.5px] text-gray-400">Takes 15-25 seconds</p>
      </div>
    </div>
  )
}

function Phase32Placeholder() {
  return (
    <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50/30 px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-violet-500">
            <Lock className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[12px] font-bold text-gray-700">Generate Thumbnail Image</p>
              <span className="inline-flex items-center rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold text-violet-700 border border-violet-200 uppercase tracking-wider">
                Coming Soon · Phase 3.2
              </span>
            </div>
            <p className="text-[10.5px] text-gray-500 mt-0.5 truncate">
              The prompt above is ready — image generation lands in the next phase.
            </p>
          </div>
        </div>
        <button
          disabled
          className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-[10.5px] font-bold text-gray-400 cursor-not-allowed"
          title="Image generation arrives in Phase 3.2"
        >
          <ImageIcon className="h-3 w-3" />
          Generate
        </button>
      </div>
    </div>
  )
}
