// YouTube transcript fetcher + per-video cache.
//
// Tier-1 data source for `analyzeCreatorStyle`. The Video schema has
// `transcript`, `transcriptSource`, `transcriptFetchedAt` fields; this module
// populates them. Soft refresh window of 14 days — `ensureTranscriptsForVideos`
// skips any video whose transcript was fetched recently.
//
// Failure handling is non-fatal everywhere. If transcripts are unavailable
// (no captions, network errors, package upstream breaks), `analyzeCreatorStyle`
// falls through to titles + descriptions with `_speechDataConfidence` calibrated.

import Video from '../models/Video.js'

let lib = null
let libLoadErr = null
try {
  lib = await import('youtube-transcript')
} catch (err) {
  libLoadErr = err
  console.warn('[Transcript] youtube-transcript package failed to load:', err.message)
}

const REFRESH_TTL_MS = 14 * 24 * 60 * 60 * 1000 // 14 days
const MAX_TRANSCRIPT_CHARS = 10000
const FETCH_TIMEOUT_MS = 12000
const RETRY_BACKOFF_MS = 2000

// Strip non-speech markers that show up in auto-generated captions.
// [Music], [Applause], [Laughter], >> speaker markers, * emphases.
function cleanTranscript(raw) {
  if (typeof raw !== 'string') return ''
  const stripped = raw
    .replace(/\[(Music|Applause|Laughter|Cheering|Crowd|Noise|Silence|Applause.)\]/gi, ' ')
    .replace(/^\s*>>\s*/gm, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return stripped.slice(0, MAX_TRANSCRIPT_CHARS)
}

// Classify caption track as manual / auto / unknown. The library returns
// `isTranslatable` on manual tracks and `kind: 'asr'` on auto-generated.
function classifySource(seg) {
  if (!seg || typeof seg !== 'object') return 'unknown'
  if (seg.kind === 'asr') return 'auto'
  // The library doesn't always surface `kind`; fall back to checking label.
  const label = String(seg.label || seg.name || '').toLowerCase()
  if (label.includes('auto') || label.includes('generated')) return 'auto'
  if (seg.isTranslatable || label) return 'manual'
  return 'unknown'
}

// Fetch a single video transcript with one retry on transient failure.
// Returns `{ transcript, source, fetchedAt }` or `null` if no captions.
//
// Language handling: we do NOT hardcode a language. The creator's primary
// caption language is the right one — for an English creator that's `en`,
// for a Hindi creator that's `hi`, for Hinglish creators it's often `hi`
// with English technical terms mixed in. Hardcoding `en` silently fails
// for every non-English creator. We let the library pick the default
// track (which is what YouTube serves on the watch page).
export async function fetchTranscript(videoId, { timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  if (!lib) throw libLoadErr || new Error('youtube-transcript not loaded')
  if (!videoId || typeof videoId !== 'string') {
    throw new Error('videoId is required')
  }

  let lastErr = null
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // No `lang` filter — accept whatever caption track YouTube serves
      // first. This is the creator's primary caption language.
      const segments = await lib.YoutubeTranscript.fetchTranscript(videoId)
      if (!Array.isArray(segments) || segments.length === 0) {
        return null
      }
      const text = segments.map((s) => s?.text || '').join(' ').trim()
      if (!text) return null
      const source = classifySource(segments[0])
      return {
        transcript: cleanTranscript(text),
        source,
        fetchedAt: new Date(),
      }
    } catch (err) {
      lastErr = err
      const name = err?.name || err?.constructor?.name || ''
      // Hard "not available" variants — don't retry.
      if (
        name === 'YoutubeTranscriptDisabledError'
        || name === 'YoutubeTranscriptNotAvailableError'
        || name === 'YoutubeTranscriptNotAvailableLanguageError'
        || name === 'YoutubeTranscriptVideoUnavailableError'
      ) {
        return null
      }
      // Transient — wait and retry once.
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS))
        continue
      }
    }
  }
  throw lastErr || new Error('transcript fetch failed')
}

// Batch entry point: ensure every video has a fresh transcript cached.
// Skips videos fetched within REFRESH_TTL_MS. Persists new transcripts to
// Video docs via updateOne. Runs `concurrency` fetches in parallel via a
// hand-rolled Promise pool.
export async function ensureTranscriptsForVideos(videos, { concurrency = 4 } = {}) {
  if (!Array.isArray(videos) || videos.length === 0) {
    return { fetched: 0, cached: 0, skipped: 0, failed: 0 }
  }
  if (!lib) {
    console.warn('[Transcript] skipping batch — package not loaded:', libLoadErr?.message)
    return { fetched: 0, cached: 0, skipped: 0, failed: 0, error: 'package unavailable' }
  }

  const now = Date.now()
  const queue = videos
    .filter((v) => v && v.videoId)
    .map((v) => ({
      videoId: v.videoId,
      transcriptFetchedAt: v.transcriptFetchedAt ? new Date(v.transcriptFetchedAt).getTime() : null,
    }))

  const stats = { fetched: 0, cached: 0, skipped: 0, failed: 0 }
  let cursor = 0

  async function worker() {
    while (cursor < queue.length) {
      const job = queue[cursor++]
      // Fresh-enough cache — skip the network entirely.
      if (job.transcriptFetchedAt && now - job.transcriptFetchedAt < REFRESH_TTL_MS) {
        stats.cached += 1
        continue
      }

      try {
        const result = await fetchTranscript(job.videoId)
        if (result === null) {
          // No captions available — record the negative so we don't retry
          // every cold build. transcript stays null.
          await Video.updateOne(
            { videoId: job.videoId },
            { $set: { transcriptFetchedAt: new Date(), transcriptSource: null, transcript: null } },
          )
          stats.skipped += 1
        } else {
          await Video.updateOne(
            { videoId: job.videoId },
            { $set: { transcript: result.transcript, transcriptSource: result.source, transcriptFetchedAt: result.fetchedAt } },
          )
          stats.fetched += 1
        }
      } catch (err) {
        stats.failed += 1
        console.warn(`[Transcript] fetch failed for ${job.videoId}:`, err?.message || err)
      }

      // Cheap jitter — avoid hammering timedtext in tight succession.
      await new Promise((r) => setTimeout(r, 250))
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, () => worker())
  await Promise.all(workers)

  console.log(`[Transcript] batch done — fetched ${stats.fetched} / cached ${stats.cached} / skipped ${stats.skipped} / failed ${stats.failed}`)
  return stats
}
