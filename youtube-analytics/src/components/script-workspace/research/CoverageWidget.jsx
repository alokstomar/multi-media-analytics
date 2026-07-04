import { motion } from 'framer-motion'
import {
  Radar, Globe, FileSearch, Building2, Calendar, Search,
} from 'lucide-react'
import { deriveCoverage } from './researchUtils'

// Visual progress widget showing what fraction of the script's claims have
// been externally cited, plus future-ready slots for sources-checked /
// publishers / latest-source-date that light up when a real search provider
// is wired in.
//
// In stub mode (no provider), surfaces "AI-only verification" honestly.
function coverageTone(pct) {
  if (pct >= 70) return { bar: 'bg-emerald-500', text: 'text-emerald-700', hint: 'Strong source coverage.' }
  if (pct >= 35) return { bar: 'bg-amber-500',   text: 'text-amber-700',   hint: 'Partial coverage — some claims lack sources.' }
  if (pct > 0)   return { bar: 'bg-red-500',     text: 'text-red-700',     hint: 'Limited coverage — verify before publishing.' }
  return { bar: 'bg-gray-300', text: 'text-gray-600', hint: 'No external sources cited yet.' }
}

// Collects publisher domains + latest publish date across all sources in
// the report. Returns empty when no sources exist (stub mode).
function deriveSourceStats(report) {
  const sources = []
  const collect = (arr) => {
    if (!Array.isArray(arr)) return
    for (const item of arr) {
      for (const s of item.sources || []) {
        if (s?.url) sources.push(s)
      }
    }
  }
  collect(report?.report?.claims)
  collect(report?.report?.suggestions)
  if (sources.length === 0) return { sourcesChecked: 0, publishers: 0, latestDate: null }

  const domains = new Set()
  let latest = null
  for (const s of sources) {
    try {
      domains.add(new URL(s.url).hostname.replace(/^www\./, ''))
    } catch { /* ignore */ }
    if (s.publishedDate) {
      const d = new Date(s.publishedDate)
      if (!isNaN(d.getTime()) && (!latest || d > latest)) latest = d
    }
  }
  return {
    sourcesChecked: sources.length,
    publishers: domains.size,
    latestDate: latest ? latest.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : null,
  }
}

function MiniStat({ Icon, label, value, tint = 'text-gray-700' }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <Icon className={`h-3 w-3 ${tint} shrink-0`} />
      <div className="min-w-0">
        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider truncate">{label}</p>
        <p className={`text-[11px] font-bold tabular-nums truncate ${tint}`}>{value}</p>
      </div>
    </div>
  )
}

export default function CoverageWidget({ report, limitedVerification = false }) {
  const pct = deriveCoverage(report)
  const tone = coverageTone(pct)
  const stats = deriveSourceStats(report)

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-xl border border-gray-100 bg-white px-3 py-2.5"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Radar className="h-3.5 w-3.5 text-sky-600" />
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Research Coverage</p>
        </div>
        <span className={`text-[13px] font-bold tabular-nums ${tone.text}`}>{pct}%</span>
      </div>

      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={`h-full rounded-full ${tone.bar}`}
        />
      </div>

      {limitedVerification ? (
        // Stub-mode messaging — no live web search connected.
        <div className="mt-2.5 rounded-lg border border-amber-100 bg-amber-50/40 px-2.5 py-1.5">
          <div className="flex items-center gap-1.5">
            <Search className="h-3 w-3 text-amber-600 shrink-0" />
            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
              AI-only verification
            </p>
          </div>
          <p className="text-[10.5px] text-amber-800/80 leading-snug mt-0.5">
            No live web search connected. Wire in Bing, Tavily, or another provider for grounded citations.
          </p>
        </div>
      ) : (
        // Grounded-mode slots — light up with real data when a provider exists.
        <div className="mt-2.5 grid grid-cols-3 gap-2">
          <MiniStat
            Icon={FileSearch}
            label="Sources Checked"
            value={stats.sourcesChecked || '—'}
            tint="text-sky-700"
          />
          <MiniStat
            Icon={Building2}
            label="Publishers"
            value={stats.publishers || '—'}
            tint="text-violet-700"
          />
          <MiniStat
            Icon={Calendar}
            label="Latest Source"
            value={stats.latestDate || '—'}
            tint="text-emerald-700"
          />
        </div>
      )}

      <p className="text-[10.5px] text-gray-500 mt-1.5 leading-snug flex items-center gap-1">
        <Globe className="h-3 w-3 shrink-0 opacity-60" />
        {pct > 0
          ? `${pct}% of factual content has at least one external citation.`
          : 'Opinion statements are skipped; nothing requires a citation yet.'}
      </p>
    </motion.div>
  )
}
