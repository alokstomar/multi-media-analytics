import { motion } from 'framer-motion'
import {
  ExternalLink, Globe, Calendar, ShieldCheck, Link2, Search,
} from 'lucide-react'

function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

function faviconFor(domain) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`
}

// Future-ready source row. Designed so that when a real search provider is
// wired in (Tavily/Bing/Perplexity), each row already has slots for:
//   - favicon / source icon
//   - title (page title)
//   - publisher domain
//   - published date
//   - credibility badge (currently informational — shows claim count)
//   - "supports claim" link-out
//
// In stub mode (the default), the list is usually empty and the empty-state
// placeholder surfaces the "wire in a search provider" hint.
function SourceRow({ source, index }) {
  const {
    url, title, domain, publishedDate, count = 1,
  } = source

  return (
    <motion.a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.4) }}
      className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-white hover:bg-gray-50/60 hover:border-gray-200 px-3 py-2.5 cursor-pointer group transition"
    >
      {/* Source icon — favicon when available, falls back to globe */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50 border border-gray-100 overflow-hidden">
        <img
          src={faviconFor(domain)}
          alt=""
          className="h-4 w-4"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
            e.currentTarget.parentElement?.classList.add('fallback')
          }}
        />
        <Globe className="h-4 w-4 text-gray-400 hidden fallback:block" />
      </div>

      {/* Source title + publisher + date */}
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-gray-800 truncate group-hover:text-sky-700 leading-snug">
          {title}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5 text-[10.5px] text-gray-500">
          <span className="inline-flex items-center gap-0.5 truncate">
            <Link2 className="h-2.5 w-2.5 opacity-60" />
            <span className="truncate">{domain}</span>
          </span>
          {publishedDate && (
            <>
              <span className="text-gray-300">·</span>
              <span className="inline-flex items-center gap-0.5 shrink-0">
                <Calendar className="h-2.5 w-2.5 opacity-60" />
                {publishedDate}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Credibility badge — informational in stub mode */}
      {count > 1 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 shrink-0">
          <ShieldCheck className="h-2.5 w-2.5" />
          ×{count}
        </span>
      )}

      <ExternalLink className="h-3 w-3 text-gray-400 group-hover:text-sky-600 shrink-0 transition" />
    </motion.a>
  )
}

// Empty-state placeholder. Distinct from the "no sources cited" state — this
// tells the editor the search provider isn't wired up yet, so live ground
// truth is unavailable. Designed to be shown when limitedVerification === true
// and sources are empty.
function NoProviderPlaceholder() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-dashed border-gray-200 bg-gradient-to-br from-gray-50/60 to-white px-4 py-6 text-center"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-gray-100 mx-auto mb-2.5">
        <Search className="h-4 w-4 text-violet-500" />
      </div>
      <p className="text-[12.5px] font-bold text-gray-800">
        Live Source Verification
      </p>
      <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed max-w-sm mx-auto">
        When Bing, Tavily, or another provider is connected, verified
        citations, publishers, credibility indicators, and publication dates
        will automatically appear here.
      </p>
      <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-100 px-2 py-0.5">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
          Awaiting provider
        </span>
      </div>
    </motion.div>
  )
}

// Dedupe sources across claims + suggestions. Each row shows domain + title
// + url + how many claims reference it.
export default function SourcesList({ report = null, limitedVerification = false }) {
  const tally = new Map()
  const collect = (arr) => {
    if (!Array.isArray(arr)) return
    for (const item of arr) {
      const sources = item.sources || []
      for (const s of sources) {
        if (!s?.url) continue
        const existing = tally.get(s.url)
        if (existing) {
          existing.count += 1
        } else {
          tally.set(s.url, {
            url: s.url,
            title: s.title || domainOf(s.url),
            domain: s.domain || domainOf(s.url),
            publishedDate: s.publishedDate || '',
            count: 1,
          })
        }
      }
    }
  }
  collect(report?.report?.claims)
  collect(report?.report?.suggestions)

  const sources = [...tally.values()].sort((a, b) => b.count - a.count)

  if (sources.length === 0) {
    // Stub mode with no sources — show the future-ready placeholder.
    if (limitedVerification) return <NoProviderPlaceholder />

    // Grounded provider returned no sources — gentle empty state.
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-4 text-center">
        <p className="text-[12px] text-gray-500 font-medium">No external sources cited.</p>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {sources.map((s, i) => (
        <SourceRow key={s.url + i} source={s} index={i} />
      ))}
    </div>
  )
}
