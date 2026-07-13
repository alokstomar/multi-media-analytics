import { motion } from 'framer-motion'
import { Dna, Info } from 'lucide-react'
import { clickbaitBand, tintClass } from './thumbnailUtils'

// Thumbnail DNA Card — surfaces the channel's learned visual style profile.
// Read-only; refresh happens via POST /thumbnail-profile (rarely needed since
// the generate flow builds/refreshes DNA automatically).
//
// DNA shape (from analyzeThumbnailStyle AI method):
//   profile: { summary, colors, typography, layout, branding, elements,
//              emotion[], clickbaitIntensity, ctrStyle, visualHierarchy,
//              consistencyScore }

function DNAChip({ label, value }) {
  if (value == null || value === '') return null
  const display = typeof value === 'boolean'
    ? (value ? 'Yes' : 'No')
    : String(value).replace(/-/g, ' ')
  return (
    <div className="rounded-lg bg-gray-50 border border-gray-100 px-2.5 py-1.5">
      <p className="text-[9.5px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-[11.5px] font-semibold text-gray-700 capitalize mt-0.5 truncate">{display}</p>
    </div>
  )
}

export default function ThumbnailDNACard({ profile }) {
  if (!profile || typeof profile !== 'object' || Object.keys(profile).length === 0) {
    return null
  }

  const cbBand = clickbaitBand(profile.clickbaitIntensity)
  const consistency = profile.consistencyScore

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-xl border border-gray-100 bg-white p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-50 text-violet-600">
            <Dna className="h-3.5 w-3.5" />
          </div>
          <h4 className="text-[12px] font-bold text-gray-900">Thumbnail DNA</h4>
        </div>
        <div className="flex items-center gap-1.5">
          {cbBand && (
            <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider ${tintClass(cbBand.tint)}`}>
              {cbBand.label}
            </span>
          )}
          {consistency != null && (
            <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[9.5px] font-bold text-gray-600 tabular-nums">
              Consistency {Math.round(consistency)}
            </span>
          )}
        </div>
      </div>

      {profile.summary && (
        <p className="text-[11.5px] text-gray-700 leading-relaxed mb-3">{profile.summary}</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {profile.ctrStyle && <DNAChip label="CTR Style" value={profile.ctrStyle} />}
        {profile.visualHierarchy && <DNAChip label="Hierarchy" value={profile.visualHierarchy} />}
        {profile.typography?.style && <DNAChip label="Type Style" value={profile.typography.style} />}
        {profile.typography?.size && <DNAChip label="Type Size" value={profile.typography.size} />}
        {profile.layout?.composition && <DNAChip label="Composition" value={profile.layout.composition} />}
        {profile.layout?.visualClutter && <DNAChip label="Density" value={profile.layout.visualClutter} />}
      </div>

      {/* Color palette — swatches if present */}
      {Array.isArray(profile.colors?.primary) && profile.colors.primary.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Primary Colors</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {profile.colors.primary.map((c, i) => (
              <ColorSwatch key={`${c}-${i}`} color={c} />
            ))}
            {Array.isArray(profile.colors.accent) && profile.colors.accent.map((c, i) => (
              <ColorSwatch key={`accent-${c}-${i}`} color={c} label="accent" />
            ))}
          </div>
        </div>
      )}

      {/* Emotion chips */}
      {Array.isArray(profile.emotion) && profile.emotion.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Emotional Triggers</p>
          <div className="flex items-center gap-1 flex-wrap">
            {profile.emotion.slice(0, 6).map((e, i) => (
              <span
                key={`${e}-${i}`}
                className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 border border-violet-100"
              >
                {e}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-start gap-1.5 pt-3 mt-3 border-t border-gray-100">
        <Info className="h-3 w-3 text-gray-400 shrink-0 mt-0.5" />
        <p className="text-[10px] text-gray-400 leading-relaxed">
          DNA is inferred from your channel's metadata, titles, and performance. Phase 3.2+ will enrich this with real image analysis.
        </p>
      </div>
    </motion.div>
  )
}

function ColorSwatch({ color, label }) {
  // Try to render actual color if it's a hex value; otherwise just show the name.
  const isHex = /^#[0-9a-fA-F]{3,8}$/.test(color)
  return (
    <div
      className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white pl-1 pr-2 py-0.5"
      title={label ? `${label}: ${color}` : color}
    >
      <span
        className="inline-block h-3 w-3 rounded-full border border-black/10"
        style={isHex ? { backgroundColor: color } : { backgroundColor: colorByName(color) }}
      />
      <span className="text-[10px] font-semibold text-gray-600">{color}</span>
    </div>
  )
}

// Best-effort color lookup for named colors. Returns a hex fallback.
function colorByName(name) {
  const map = {
    red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308',
    black: '#111827', white: '#f9fafb', pink: '#ec4899', purple: '#a855f7',
    orange: '#f97316', gold: '#d4af37', gray: '#6b7280', grey: '#6b7280',
    teal: '#14b8a6', cyan: '#06b6d4', indigo: '#6366f1', violet: '#8b5cf6',
    crimson: '#dc143c', navy: '#1e3a8a', maroon: '#7f1d1d', lime: '#84cc16',
  }
  const key = String(name).toLowerCase().trim()
  return map[key] || '#e5e7eb'
}
