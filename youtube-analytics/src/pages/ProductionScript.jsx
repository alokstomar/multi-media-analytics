import { useMemo, useRef, useCallback } from 'react'
import { useLocation, useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import ScriptHero from '../components/script/ScriptHero'
import ScriptTimeline from '../components/script/ScriptTimeline'
import ScriptTableOfContents from '../components/script/ScriptTableOfContents'
import ScriptToolbar from '../components/script/ScriptToolbar'
import ScriptGenerationLoader from '../components/script/ScriptGenerationLoader'
import { ErrorState } from '../components/content-intelligence/StateShells'
import { useScriptGeneration } from '../components/script/useScriptGeneration'
import { scriptToPlainText, copyToClipboard } from '../utils/scriptCopy'

function countWords(script) {
  if (!script) return 0
  let text = script.overview || ''
  if (Array.isArray(script.timeline)) {
    text += ' ' + script.timeline
      .map((b) => (typeof b.narration === 'string' ? b.narration : Array.isArray(b.narration) ? b.narration.join(' ') : ''))
      .join(' ')
  }
  return text.split(/\s+/).filter(Boolean).length
}

export default function ProductionScript() {
  const { channelId, ideaId } = useParams()
  const location = useLocation()
  const initialIdea = location.state?.idea || null
  const initialChannel = location.state?.channel || null

  const {
    status, script, recommendation, generatedAt, isRegenerating, isUnavailable, error, regenerate, retry,
  } = useScriptGeneration({ channelId, ideaId, initialIdea })

  const timelineRef = useRef(null)

  const readingTimeMin = useMemo(() => Math.max(1, Math.round(countWords(script) / 200)), [script])

  const handleExpandAll = useCallback(() => timelineRef.current?.expandAll?.(), [])
  const handleCollapseAll = useCallback(() => timelineRef.current?.collapseAll?.(), [])
  const handleJumpTo = useCallback((index) => {
    timelineRef.current?.scrollToIndex?.(index, { behavior: 'smooth', block: 'start' })
  }, [])

  const handleCopyAll = useCallback(async () => {
    if (!script) return false
    return copyToClipboard(scriptToPlainText(script, recommendation || initialIdea || {}))
  }, [script, recommendation, initialIdea])

  const channelName = initialChannel?.title || recommendation?.channelName || 'channel'

  return (
    <div className="min-h-screen">
      {/* Back link */}
      <div className="mb-4">
        <Link
          to="/content-intelligence"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to {channelName}
        </Link>
      </div>

      <AnimatePresence mode="wait">
        {status === 'loading' && (
          <motion.div key="loader" exit={{ opacity: 0 }}>
            <ScriptGenerationLoader isRegenerating={false} />
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
                <button
                  onClick={retry}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : (
              <ErrorState
                message={error?.response?.data?.error?.message || 'Failed to generate script'}
                onRetry={retry}
              />
            )}
          </motion.div>
        )}

        {status === 'ready' && script && (
          <motion.div
            key="ready"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="space-y-6"
          >
            <ScriptToolbar
              onRegenerate={regenerate}
              onCopyAll={handleCopyAll}
              onExpandAll={handleExpandAll}
              onCollapseAll={handleCollapseAll}
              readingTimeMin={readingTimeMin}
              generatedAt={generatedAt}
              isRegenerating={isRegenerating}
              sectionsCount={Array.isArray(script.timeline) ? script.timeline.length : 0}
            />

            <ScriptHero script={script} recommendation={recommendation || initialIdea || {}} />

            {/* Regeneration overlay */}
            <AnimatePresence>
              {isRegenerating && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40 bg-white/70 backdrop-blur-sm flex items-center justify-center"
                >
                  <ScriptGenerationLoader isRegenerating />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Body: timeline + sticky TOC */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-6 items-start">
              <div>
                <ScriptTimeline ref={timelineRef} blocks={script.timeline || []} />
                <ScriptFooter script={script} />
              </div>
              <div className="hidden xl:block">
                <ScriptTableOfContents blocks={script.timeline || []} onJump={handleJumpTo} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Renders everything below the timeline: alternative titles, thumbnails,
// SEO, chapters, CTA, production notes. All optional — only renders keys
// the AI actually returned.
function ScriptFooter({ script }) {
  const sections = []

  if (Array.isArray(script.titles) && script.titles.length > 0) {
    sections.push({
      title: 'Alternative Titles',
      body: (
        <ul className="space-y-1.5">
          {script.titles.map((t, i) => (
            <li key={i} className="text-[13px] text-gray-700 leading-relaxed flex gap-2">
              <span className="text-gray-400 font-mono">{i + 1}.</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      ),
    })
  }

  if (Array.isArray(script.thumbnailIdeas) && script.thumbnailIdeas.length > 0) {
    sections.push({
      title: 'Thumbnail Ideas',
      body: (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {script.thumbnailIdeas.map((t, i) => (
            <div key={i} className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
              {typeof t === 'string' ? (
                <p className="text-[13px] text-gray-700">{t}</p>
              ) : (
                <div className="space-y-1">
                  {t.concept && <p className="text-[13px] font-semibold text-gray-900">{t.concept}</p>}
                  {t.textOverlay && (
                    <p className="text-[11px] text-violet-700 font-semibold uppercase tracking-wider">"{t.textOverlay}"</p>
                  )}
                  {t.emotion && <p className="text-[11px] text-gray-500">Emotion: {t.emotion}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      ),
    })
  }

  if (script.cta) {
    sections.push({
      title: 'Call To Action',
      body: <p className="text-[14px] text-gray-800 leading-relaxed bg-violet-50 border border-violet-100 rounded-xl p-4">{script.cta}</p>,
    })
  }

  if (script.seo && typeof script.seo === 'object' && Object.keys(script.seo).length > 0) {
    sections.push({
      title: 'SEO',
      body: (
        <div className="space-y-3">
          {Array.isArray(script.seo.keywords) && script.seo.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {script.seo.keywords.map((k, i) => (
                <span key={i} className="inline-flex items-center rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 border border-violet-100">
                  {k}
                </span>
              ))}
            </div>
          )}
          {Array.isArray(script.seo.tags) && script.seo.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {script.seo.tags.map((k, i) => (
                <span key={i} className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600">
                  #{k}
                </span>
              ))}
            </div>
          )}
          {script.seo.description && (
            <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-line bg-gray-50 border border-gray-100 rounded-xl p-4">
              {script.seo.description}
            </p>
          )}
        </div>
      ),
    })
  }

  if (Array.isArray(script.chapters) && script.chapters.length > 0) {
    sections.push({
      title: 'Chapters',
      body: (
        <div className="rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
          {script.chapters.map((c, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/50 transition">
              <span className="inline-flex items-center justify-center rounded-md bg-violet-50 text-violet-700 text-[11px] font-bold px-2 py-0.5 font-mono tabular-nums min-w-[58px]">
                {c.timestamp || ''}
              </span>
              <span className="text-[13px] text-gray-800">{c.title || ''}</span>
            </div>
          ))}
        </div>
      ),
    })
  }

  if (Array.isArray(script.productionNotes) && script.productionNotes.length > 0) {
    sections.push({
      title: 'Production Notes',
      body: (
        <ul className="space-y-2">
          {script.productionNotes.map((n, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px] text-gray-700 leading-relaxed">
              <span className="mt-1.5 h-1 w-1 rounded-full bg-violet-400 shrink-0" />
              <span>{typeof n === 'string' ? n : JSON.stringify(n)}</span>
            </li>
          ))}
        </ul>
      ),
    })
  }

  if (sections.length === 0) return null

  return (
    <div className="mt-8 space-y-5">
      {sections.map((s, i) => (
        <motion.section
          key={s.title}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: Math.min(i * 0.05, 0.3) }}
          className="rounded-2xl border border-gray-100 bg-white p-5"
        >
          <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3">{s.title}</h2>
          {s.body}
        </motion.section>
      ))}
    </div>
  )
}
