/**
 * Instagram content strategy service.
 *
 * Two responsibilities:
 *   1. getBestPostingTimes — deterministic. Aggregates engagement by
 *      day-of-week × hour from the account's recent reels. No AI call,
 *      no failure mode — always returns a meaningful answer (falls back
 *      to industry-typical windows when the reel sample is too small).
 *   2. getContentIdeas — calls provider.generateShortsIdeas (whose prompt
 *      is already Instagram-Reels-aware) and reshapes the response into
 *      our IG content-idea contract.
 */

import { getAIProvider } from '../ai/index.js'

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const HOURS_BUCKET = [6, 9, 12, 15, 18, 21] // display buckets for sparse data

// Industry baseline best-time fallbacks (local time). Used only when there
// isn't enough reel data to compute a real signal.
const FALLBACK_BEST_SLOTS = [
  { day: 'Wednesday', hour: 12, label: '12:00', confidence: 65, avgEngagement: 'Medium' },
  { day: 'Thursday',  hour: 18, label: '18:00', confidence: 70, avgEngagement: 'High' },
  { day: 'Friday',    hour: 21, label: '21:00', confidence: 68, avgEngagement: 'High' },
]

/**
 * Compute best posting slots from reels.
 *
 * For each (day-of-week, hour) bucket we sum the engagement rate of every
 * reel published in that bucket, then rank. engagementRate ≈
 * (likes+comments) / max(views, 1). Returns the top 5 slots sorted by
 * total engagement.
 */
export function getBestPostingTimes(ctx) {
  const { account, recentReels } = ctx

  // Bucket reels by (day, hour)
  const buckets = new Map() // key: `${dow}|${hour}` → { sum, count, samples }
  for (const reel of recentReels) {
    if (!reel.publishDate) continue
    const d = new Date(reel.publishDate)
    if (isNaN(d.getTime())) continue
    const dow = d.getDay()
    const hour = d.getHours()
    const key = `${dow}|${hour}`
    const views = reel.views || 0
    const engagementRate = views > 0
      ? ((reel.likes || 0) + (reel.comments || 0)) / views
      : 0

    const prev = buckets.get(key) || { sum: 0, count: 0, samples: [] }
    prev.sum += engagementRate
    prev.count += 1
    prev.samples.push({ views, likes: reel.likes || 0, comments: reel.comments || 0 })
    buckets.set(key, prev)
  }

  let ranked = [...buckets.entries()]
    .map(([key, val]) => {
      const [dow, hour] = key.split('|').map(Number)
      const avgRate = val.count > 0 ? val.sum / val.count : 0
      // Confidence: how robust is this slot's signal? More samples = higher.
      const confidence = Math.min(95, 35 + val.count * 12)
      return {
        day: DOW[dow] || 'Unknown',
        hour,
        label: `${hour.toString().padStart(2, '0')}:00`,
        confidence,
        sampleCount: val.count,
        avgEngagement: rateLabel(avgRate),
        _rate: avgRate,
      }
    })
    .sort((a, b) => b._rate - a._rate || b.sampleCount - a.sampleCount)
    .slice(0, 5)
    .map(({ _rate, ...rest }) => rest)

  // If we have no real signal, hand back the industry-typical baseline.
  const totalSamples = recentReels.filter((r) => r.publishDate).length
  if (totalSamples < 3 || ranked.length === 0) {
    ranked = FALLBACK_BEST_SLOTS
  } else if (ranked.length < 3) {
    // Top up with industry slots if we don't have 3 computed slots.
    const have = new Set(ranked.map((r) => `${r.day}|${r.hour}`))
    for (const slot of FALLBACK_BEST_SLOTS) {
      if (ranked.length >= 3) break
      const key = `${slot.day}|${slot.hour}`
      if (!have.has(key)) ranked.push(slot)
    }
  }

  return {
    bestSlots: ranked,
    distributionByHour: computeHourDistribution(recentReels),
    distributionByDay: computeDayDistribution(recentReels),
    timezone: 'local',
    meta: {
      accountUsername: account.username,
      sampleSize: totalSamples,
      generatedAt: new Date().toISOString(),
    },
    _fallback: totalSamples < 3,
  }
}

function rateLabel(rate) {
  // engagementRate is a fraction (likes+comments)/views. Typical IG: 3-8%.
  if (rate >= 0.08) return 'Very High'
  if (rate >= 0.05) return 'High'
  if (rate >= 0.03) return 'Medium'
  if (rate > 0) return 'Low'
  return 'Unknown'
}

function computeHourDistribution(reels) {
  const dist = HOURS_BUCKET.reduce((acc, h) => ({ ...acc, [h]: 0 }), {})
  for (const r of reels) {
    if (!r.publishDate) continue
    const d = new Date(r.publishDate)
    if (isNaN(d.getTime())) continue
    const h = d.getHours()
    // Bucket to nearest display hour
    const nearest = HOURS_BUCKET.reduce((best, b) =>
      Math.abs(b - h) < Math.abs(best - h) ? b : best
    )
    dist[nearest] += 1
  }
  return Object.entries(dist).map(([hour, count]) => ({
    hour: `${hour.padStart(2, '0')}:00`,
    count,
  }))
}

function computeDayDistribution(reels) {
  const dist = DOW.reduce((acc, d) => ({ ...acc, [d]: 0 }), {})
  for (const r of reels) {
    if (!r.publishDate) continue
    const d = new Date(r.publishDate)
    if (isNaN(d.getTime())) continue
    dist[DOW[d.getDay()]] += 1
  }
  return Object.entries(dist).map(([day, count]) => ({ day, count }))
}

// =====================================================
// Content ideas (uses provider.generateShortsIdeas)
// =====================================================

/** Build a YT-shaped context from IG reels — same trick as recommendations. */
function buildShortsContext(ctx, userInput) {
  const { account, recentReels } = ctx
  const topReels = [...recentReels]
    .sort((a, b) => (b.views || 0) - (a.views || 0))
    .slice(0, 10)
    .map((r) => ({
      title: (r.caption || '').slice(0, 100) || '(untitled reel)',
      views: r.views || 0,
    }))

  return {
    channelId: account.accountId,
    channel: {
      title: account.username,
      handle: `@${account.username}`,
      description: account.bio || account.category || '',
      subscribers: account.followers || 0,
      totalVideos: account.postsCount || 0,
    },
    videos: topReels,
    userInput: userInput || '',
  }
}

export async function getContentIdeas(ctx, userInput = '') {
  const { account, recentReels } = ctx

  // Need at least 1 reel for the AI to ground the suggestions. With zero
  // context we serve the deterministic fallback so the UI still renders.
  if (recentReels.length < 1) {
    return { result: fallbackContentIdeas(ctx, userInput), fallback: true }
  }

  try {
    const provider = getAIProvider()
    const raw = await provider.generateShortsIdeas(buildShortsContext(ctx, userInput), {
      channelId: account.accountId,
      feature: 'ig-content-ideas',
    })

    const ideas = Array.isArray(raw?.ideas) ? raw.ideas : []
    if (!ideas.length) {
      return { result: fallbackContentIdeas(ctx, userInput), fallback: true }
    }

    return {
      result: {
        ideas: ideas.map((idea, i) => ({
          id: idea.id || i + 1,
          title: idea.title || `Reel concept ${i + 1}`,
          hook: idea.hook || '',
          first3s: idea.first3s || '',
          cta: idea.cta || '',
          retention: idea.retention || '',
          viralScore: typeof idea.viralScore === 'number' ? idea.viralScore : null,
          trendStrength: typeof idea.trendStrength === 'number' ? idea.trendStrength : null,
        })),
        meta: {
          accountUsername: account.username,
          prompt: userInput || '',
          generatedAt: new Date().toISOString(),
        },
      },
    }
  } catch (err) {
    console.warn('[IG AI] content-ideas fell back:', err.message)
    return { result: fallbackContentIdeas(ctx, userInput), fallback: true }
  }
}

function fallbackContentIdeas(ctx, userInput) {
  const { account } = ctx
  const prompt = userInput?.trim()
  const themed = prompt ? ` about "${prompt.slice(0, 60)}"` : ''

  return {
    ideas: [
      {
        id: 1,
        title: `3 myths${themed} debunked in 30 seconds`,
        hook: 'Most people get this wrong…',
        first3s: 'Open with a counter-intuitive claim + on-screen text overlay',
        cta: 'Follow for part 2',
        retention: '82%',
        viralScore: 68,
        trendStrength: 55,
      },
      {
        id: 2,
        title: `Behind-the-scenes: how I make${themed}`,
        hook: "Here's what nobody shows you…",
        first3s: 'Quick cuts of the process with a trending audio drop',
        cta: 'Save this for later',
        retention: '78%',
        viralScore: 62,
        trendStrength: 60,
      },
      {
        id: 3,
        title: `POV: you just discovered${themed || ' this niche'}`,
        hook: 'POV: …',
        first3s: 'Single locked-off shot, text overlay appears at 0.5s',
        cta: 'Share with someone who needs this',
        retention: '85%',
        viralScore: 74,
        trendStrength: 65,
      },
    ],
    meta: {
      accountUsername: account.username,
      prompt: userInput || '',
      generatedAt: new Date().toISOString(),
    },
  }
}
