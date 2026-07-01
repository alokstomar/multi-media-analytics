import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Hash, Copy, Check, AlertTriangle, Inbox, Sparkles } from 'lucide-react'

/* Hashtag grouping rules:
   - caption-derived (proven on this account) → Primary
   - high-volume trend tags → Secondary
   - everything else → Niche */
function groupHashtags(hashtags) {
  const primary = []
  const secondary = []
  const niche = []
  for (const h of hashtags) {
    if (h.source === 'caption' || h.recommended) {
      primary.push(h)
    } else if (h.volume === 'High' || (typeof h.volume === 'number' && h.volume > 50)) {
      secondary.push(h)
    } else {
      niche.push(h)
    }
  }
  return { primary, secondary, niche }
}

const GROUPS = [
  { key: 'primary', label: 'Primary', desc: 'Proven on your account', color: 'violet' },
  { key: 'secondary', label: 'Secondary', desc: 'High-volume trends', color: 'pink' },
  { key: 'niche', label: 'Niche', desc: 'Targeted reach', color: 'blue' },
]

function CopyButton({ text, onCopy, label }) {
  const [copied, setCopied] = useState(false)
  const handle = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      onCopy()
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked — silently fail */
    }
  }, [text, onCopy])
  return (
    <button
      onClick={handle}
      className="flex items-center gap-1 text-[10px] font-bold text-gray-500 hover:text-violet-700 transition cursor-pointer"
      title={`Copy ${label}`}
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-emerald-600" />
          <span className="text-emerald-600">Copied</span>
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          <span>Copy</span>
        </>
      )}
    </button>
  )
}

function Shell({ kind, message }) {
  if (kind === 'loading') {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-100 bg-gray-50/50 p-3 animate-pulse">
            <div className="h-2.5 w-24 bg-gray-200 rounded mb-2" />
            <div className="flex gap-1.5 flex-wrap">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="h-5 w-16 bg-gray-100 rounded-full" />
              ))}
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
        <p className="text-xs font-bold text-red-700">{message || 'Failed to load hashtags'}</p>
      </div>
    )
  }
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4 text-center">
      <Inbox className="h-4 w-4 text-gray-400 mx-auto mb-1" />
      <p className="text-xs font-bold text-gray-600">No hashtag suggestions available</p>
    </div>
  )
}

export default function HashtagSuggestionsPanel({ data, status, error, fallback, onToast }) {
  const hashtags = Array.isArray(data?.hashtags) ? data.hashtags : []
  const groups = useMemo(() => groupHashtags(hashtags), [hashtags])
  const showShell = status === 'loading' || status === 'error' || (status === 'idle' && !hashtags.length)

  const handleCopyAll = useCallback(async () => {
    try {
      const text = hashtags.map((h) => `#${h.tag}`).join(' ')
      await navigator.clipboard.writeText(text)
      onToast?.('Copied all hashtags')
    } catch {
      onToast?.('Copy failed — clipboard blocked')
    }
  }, [hashtags, onToast])

  return (
    <div
      className="rounded-[20px] border border-gray-100 bg-white p-5.5 space-y-4"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-50 text-pink-600">
          <Hash className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <h3 className="text-[15px] font-bold text-gray-900 tracking-tight leading-snug">
            Hashtag Suggestions
          </h3>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">
            Caption-proven + trending
          </p>
        </div>
        {hashtags.length > 0 && (
          <CopyButton text={hashtags.map((h) => `#${h.tag}`).join(' ')} onCopy={() => onToast?.('Copied all hashtags')} label="all hashtags" />
        )}
        {fallback && (
          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            Offline
          </span>
        )}
      </div>

      {showShell ? (
        <Shell kind={status === 'idle' ? 'empty' : status} message={error} />
      ) : (
        <div className="space-y-3.5">
          {GROUPS.map((group) => {
            const tags = groups[group.key]
            if (!tags.length) return null
            return (
              <motion.div
                key={group.key}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-gray-900 uppercase tracking-wider">
                      {group.label}
                    </p>
                    <p className="text-[10px] text-gray-500">{group.desc}</p>
                  </div>
                  <CopyButton
                    text={tags.map((h) => `#${h.tag}`).join(' ')}
                    onCopy={() => onToast?.(`Copied ${group.label.toLowerCase()} hashtags`)}
                    label={`${group.label.toLowerCase()} group`}
                  />
                </div>
                <AnimatePresence initial={false}>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {tags.map((h, i) => (
                      <motion.button
                        key={`${h.tag}-${i}`}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.2) }}
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(`#${h.tag}`)
                            onToast?.(`Copied #${h.tag}`)
                          } catch {
                            onToast?.('Copy failed')
                          }
                        }}
                        title="Click to copy"
                        className={`group inline-flex items-center gap-0.5 px-2 py-1 rounded-full text-[11px] font-bold border transition cursor-pointer ${
                          group.key === 'primary'
                            ? 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100'
                            : group.key === 'secondary'
                            ? 'bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100'
                            : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                        }`}
                      >
                        <span className="opacity-50">#</span>
                        <span>{h.tag}</span>
                        <Copy className="h-2.5 w-2.5 opacity-0 group-hover:opacity-60 transition" />
                      </motion.button>
                    ))}
                  </div>
                </AnimatePresence>
              </motion.div>
            )
          })}

          {data?.sourceBreakdown && (
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-[10px] text-gray-500 leading-relaxed font-semibold flex items-start gap-1.5">
              <Sparkles className="h-3 w-3 text-pink-500 mt-0.5 shrink-0" />
              <span>
                Source: {data.sourceBreakdown.fromCaptions || 0} from your captions ·{' '}
                {data.sourceBreakdown.fromTrends || 0} from trending topics
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
