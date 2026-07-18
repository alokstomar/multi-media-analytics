import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Film, Wand2, RotateCw, Play, TrendingUp, AlertTriangle, Inbox } from 'lucide-react'

const VIRAL_COLOR = (score) => {
  if (typeof score !== 'number') return 'text-gray-500 bg-gray-50'
  if (score >= 75) return 'text-emerald-700 bg-emerald-50'
  if (score >= 60) return 'text-blue-700 bg-blue-50'
  if (score >= 40) return 'text-amber-700 bg-amber-50'
  return 'text-red-700 bg-red-50'
}

const SAMPLE_PROMPTS = [
  'A day in my life as a creator',
  '3 myths in my niche',
  'Behind the scenes of my last project',
  'POV: my audience finds my content',
]

function Shell({ kind, message }) {
  if (kind === 'loading') {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 animate-pulse">
            <div className="h-3 w-2/3 bg-gray-200 rounded mb-2" />
            <div className="space-y-1.5">
              <div className="h-2.5 bg-gray-100 rounded w-full" />
              <div className="h-2.5 bg-gray-100 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }
  if (kind === 'error') {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50/50 p-4 text-center">
        <AlertTriangle className="h-4 w-4 text-red-500 mx-auto mb-1.5" />
        <p className="text-xs font-bold text-red-700">{message || 'Failed to generate ideas'}</p>
      </div>
    )
  }
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4 text-center">
      <Inbox className="h-4 w-4 text-gray-400 mx-auto mb-1" />
      <p className="text-xs font-bold text-gray-600">No ideas generated yet</p>
      <p className="text-[11px] text-gray-500 mt-0.5">Type a topic above and hit Generate.</p>
    </div>
  )
}

export default function ContentIdeasPanel({
  data,
  status,
  error,
  onGenerate,
  loading,
  fallback,
  channelId,
}) {
  const [prompt, setPrompt] = useState('')
  const ideas = Array.isArray(data?.ideas) ? data.ideas : []
  const showShell =
    status === 'loading' ||
    status === 'error' ||
    (status === 'idle' && !ideas.length)

  const handleGenerate = useCallback(() => {
    onGenerate?.(prompt.trim())
  }, [prompt, onGenerate])

  return (
    <div
      className="rounded-[20px] border border-gray-100 bg-white p-5.5 space-y-4"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
          <Film className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <h3 className="text-[15px] font-bold text-gray-900 tracking-tight leading-snug">
            Reel Content Ideas
          </h3>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">
            AI-generated concepts for your next reel
          </p>
        </div>
        {ideas.length > 0 && (
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="flex items-center gap-1 text-[10px] font-bold text-gray-500 hover:text-purple-700 disabled:opacity-50 transition cursor-pointer"
          >
            <RotateCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Regenerate
          </button>
        )}
        {fallback && (
          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            Offline
          </span>
        )}
      </div>

      {/* Prompt input */}
      <div className="space-y-2">
        <div className="flex gap-2 items-stretch">
          <div className="flex-1 relative">
            <Wand2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !loading) handleGenerate()
              }}
              placeholder="Describe a topic, theme, or vibe for your next reel…"
              disabled={loading}
              className="w-full pl-9 pr-3 py-2.5 text-[12.5px] rounded-xl border border-gray-200 bg-white focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition disabled:opacity-60"
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="flex items-center gap-1.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-[12px] font-bold hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm cursor-pointer whitespace-nowrap"
          >
            {loading ? (
              <>
                <RotateCw className="h-3.5 w-3.5 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Wand2 className="h-3.5 w-3.5" />
                Generate
              </>
            )}
          </button>
        </div>
        {/* Sample prompts */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mr-1">
            Try:
          </span>
          {SAMPLE_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => setPrompt(p)}
              disabled={loading}
              className="text-[10px] font-semibold text-gray-500 hover:text-purple-700 bg-gray-50 hover:bg-purple-50 px-2 py-0.5 rounded-full border border-gray-100 transition cursor-pointer disabled:opacity-50"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Output */}
      {showShell ? (
        <Shell kind={status === 'idle' ? 'empty' : status} message={error} />
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {ideas.map((idea, i) => {
              const fmt = ['Reel', 'Talking head', 'POV', 'Tutorial', 'Listicle', 'POV', 'Story'][i % 7]
              return (
                <motion.div
                  key={idea.id || i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.07, 0.3) }}
                  className="rounded-2xl border border-gray-100 bg-white p-4 hover:border-purple-200 hover:bg-purple-50/30 transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-[12.5px] font-bold text-gray-900 leading-snug flex-1">
                      {idea.title}
                    </p>
                    {typeof idea.viralScore === 'number' && (
                      <div className="text-right shrink-0">
                        <p className={`text-[14px] font-bold tabular-nums leading-none px-1.5 py-0.5 rounded-md ${VIRAL_COLOR(idea.viralScore)}`}>
                          {idea.viralScore}
                        </p>
                        <p className="text-[8px] uppercase font-bold text-gray-400 tracking-wider mt-0.5">viral</p>
                      </div>
                    )}
                  </div>

                  {idea.hook && (
                    <div className="rounded-lg bg-purple-50/50 border border-purple-100 px-2.5 py-1.5 mb-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-purple-700 mb-0.5">Hook (0-3s)</p>
                      <p className="text-[11.5px] text-purple-900 italic">“{idea.hook}”</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Format</p>
                      <p className="text-gray-700 font-semibold">{fmt}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Estimated reach</p>
                      <p className="text-gray-700 font-semibold">{idea.retention ? `~${idea.retention} retention` : 'High'}</p>
                    </div>
                  </div>

                  {idea.first3s && (
                    <p className="text-[11px] text-gray-600 leading-relaxed mt-2.5 pt-2 border-t border-gray-100">
                      <strong className="text-gray-800">First 3 seconds: </strong>{idea.first3s}
                    </p>
                  )}
                  {idea.cta && (
                    <p className="text-[10.5px] text-gray-500 leading-relaxed mt-1.5 flex items-start gap-1">
                      <Play className="h-2.5 w-2.5 mt-0.5 shrink-0 text-purple-400" />
                      <span><strong>CTA:</strong> {idea.cta}</span>
                    </p>
                  )}

                  {typeof idea.trendStrength === 'number' && (
                    <div className="mt-2.5 pt-2 border-t border-gray-100">
                      <div className="flex items-center justify-between text-[10px] font-bold mb-1">
                        <span className="text-gray-500 flex items-center gap-1">
                          <TrendingUp className="h-3 w-3 text-purple-400" />
                          Trend strength
                        </span>
                        <span className="text-gray-700">{idea.trendStrength}/100</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${idea.trendStrength}%` }}
                          transition={{ duration: 0.5, delay: 0.2 }}
                          className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                        />
                      </div>
                    </div>
                  )}

                  {channelId && (
                    <div className="mt-3 pt-2 border-t border-gray-100/70 flex justify-end">
                      <Link
                        to={`/script/${channelId}/${idea.id}`}
                        state={{ idea }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 hover:text-purple-800 text-[11px] font-bold transition shadow-sm cursor-pointer border border-purple-100/50"
                      >
                        <Wand2 className="h-3.5 w-3.5 text-purple-500" />
                        Script Workspace
                      </Link>
                    </div>
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
