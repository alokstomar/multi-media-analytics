/**
 * Instagram growth service — growth opportunities + hashtag suggestions.
 *
 *   getGrowthOpportunities → provider.getContentGaps with IG-shaped data
 *   getHashtagSuggestions  → blend of (a) provider.findTrendingTopics for
 *                            the account's category and (b) deterministic
 *                            hashtags extracted from the account's own
 *                            top-performing reel captions.
 *
 * Both functions return `{ result, fallback? }` and never throw — the
 * orchestrator's computeFn contract.
 */

import { getAIProvider } from '../ai/index.js'

// =====================================================
// Growth opportunities (provider.getContentGaps)
// =====================================================

export async function getGrowthOpportunities(ctx) {
  const { account, recentReels, recentComments } = ctx

  if (recentReels.length < 1) {
    return { result: fallbackGrowthOpportunities(ctx), fallback: true }
  }

  try {
    const provider = getAIProvider()
    const raw = await provider.getContentGaps(
      buildGrowthPayload(ctx),
      { channelId: account.accountId, feature: 'ig-growth' }
    )

    const gaps = Array.isArray(raw?.gaps) ? raw.gaps : []
    if (!gaps.length) {
      return { result: fallbackGrowthOpportunities(ctx), fallback: true }
    }

    return {
      result: {
        opportunities: gaps.map((g, i) => ({
          id: g.id || i + 1,
          title: deYouTube(g.title || g.gap || ''),
          rationale: deYouTube(g.rationale || g.reason || g.description || ''),
          demand: g.demand || g.searchVolume || 'Medium',
          competition: g.competition || 'Medium',
          opportunityScore: typeof g.opportunityScore === 'number'
            ? g.opportunityScore
            : (typeof g.opportunity === 'number' ? g.opportunity : null),
          tags: Array.isArray(g.tags) ? g.tags : [],
        })),
        unansweredQuestions: extractQuestions(recentComments),
        meta: {
          accountUsername: account.username,
          generatedAt: new Date().toISOString(),
        },
      },
    }
  } catch (err) {
    console.warn('[IG AI] growth opportunities fell back:', err.message)
    return { result: fallbackGrowthOpportunities(ctx), fallback: true }
  }
}

function buildGrowthPayload(ctx) {
  const { account, recentReels, recentComments } = ctx
  return {
    channelId: account.accountId,
    channel: {
      title: account.username,
      handle: `@${account.username}`,
      description: account.bio || account.category || '',
      subscribers: account.followers || 0,
      totalVideos: account.postsCount || 0,
    },
    videos: recentReels.map((r) => ({
      title: (r.caption || '').slice(0, 100) || '(untitled reel)',
      views: r.views || 0,
      likes: r.likes || 0,
      comments: r.comments || 0,
    })),
    // Pass comments through so the provider can spot audience questions
    // and content requests. The YT provider tolerates this extra field.
    comments: (recentComments || []).slice(0, 50).map((c) => ({
      text: (c.text || '').slice(0, 200),
      sentiment: c.sentiment || 'neutral',
      category: c.category || 'neutral',
    })),
    competitors: [],
  }
}

/** Pull real audience questions from the comment stream — these are the
 *  purest signal for "content gaps" the audience is literally asking for. */
function extractQuestions(comments) {
  if (!Array.isArray(comments)) return []
  const questions = []
  for (const c of comments) {
    const text = (c.text || '').trim()
    if (/\?\s*$/.test(text) || /^(how|what|why|when|where|which|can you|do you)\b/i.test(text)) {
      questions.push({ text: text.slice(0, 160), author: c.author || 'Anonymous' })
    }
    if (questions.length >= 8) break
  }
  return questions
}

function fallbackGrowthOpportunities(ctx) {
  const { account, recentComments } = ctx
  return {
    opportunities: [
      {
        id: 1,
        title: 'Create a tutorial series for your most-asked topic',
        rationale: 'Tutorial content has strong save/share behavior and pulls new followers.',
        demand: 'High',
        competition: 'Medium',
        opportunityScore: 72,
        tags: ['series', 'tutorial'],
      },
      {
        id: 2,
        title: 'Repurpose your top reel into a carousel',
        rationale: 'Carousels get re-served to the same viewer multiple times — free impressions.',
        demand: 'Medium',
        competition: 'Low',
        opportunityScore: 65,
        tags: ['carousel', 'repurpose'],
      },
      {
        id: 3,
        title: 'Run a 7-day Reels challenge around your niche',
        rationale: 'Challenges create habit and give the algorithm a sustained posting signal.',
        demand: 'Medium',
        competition: 'Low',
        opportunityScore: 60,
        tags: ['challenge', 'cadence'],
      },
    ],
    unansweredQuestions: extractQuestions(recentComments),
    meta: {
      accountUsername: account.username,
      generatedAt: new Date().toISOString(),
    },
  }
}

// =====================================================
// Hashtag suggestions (provider.findTrendingTopics + caption extraction)
// =====================================================

const STOPWORD_HASHTAGS = new Set([
  'reels', 'reel', 'instagood', 'instadaily', 'like', 'follow', 'love',
  'instagram', 'viral', 'explore', 'fyp', 'foryou',
])

export async function getHashtagSuggestions(ctx) {
  const { account, recentReels } = ctx
  const category = account.category || ''

  // Deterministic part — hashtags pulled from the account's own captions.
  const captionTags = extractHashtagsFromReels(recentReels)

  let aiTags = []
  if (recentReels.length >= 1) {
    try {
      const provider = getAIProvider()
      const raw = await provider.findTrendingTopics(category || 'general')
      const topics = Array.isArray(raw?.topics) ? raw.topics : []
      aiTags = topics.slice(0, 12).map((t) => normalizeTopic(t))
    } catch (err) {
      console.warn('[IG AI] hashtags AI call fell back:', err.message)
      // No rethrow — we still have deterministic caption tags.
    }
  }

  // Merge & rank: caption-extracted tags rank higher (proven on this account).
  const merged = mergeAndRank(captionTags, aiTags)
  if (!merged.length) {
    return {
      result: fallbackHashtags(ctx),
      fallback: true,
    }
  }

  return {
    result: {
      hashtags: merged.slice(0, 20),
      sourceBreakdown: {
        fromCaptions: captionTags.length,
        fromTrends: aiTags.length,
      },
      meta: {
        accountUsername: account.username,
        category: category || 'General',
        generatedAt: new Date().toISOString(),
      },
    },
  }
}

function extractHashtagsFromReels(reels) {
  const counts = new Map()
  for (const reel of reels) {
    const caption = reel.caption || ''
    const matches = caption.match(/#[\w]+/g) || []
    for (const raw of matches) {
      const tag = raw.slice(1).toLowerCase()
      if (STOPWORD_HASHTAGS.has(tag)) continue
      if (tag.length < 3) continue
      counts.set(tag, (counts.get(tag) || 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count, source: 'caption' }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)
}

function normalizeTopic(topic) {
  if (typeof topic === 'string') {
    return {
      tag: topic.replace(/^#/, '').replace(/\s+/g, '').toLowerCase(),
      source: 'trend',
    }
  }
  if (topic && typeof topic === 'object') {
    const tag = (topic.tag || topic.name || topic.topic || '').toString()
      .replace(/^#/, '').replace(/\s+/g, '').toLowerCase()
    return { tag, source: 'trend', volume: topic.volume || topic.searchVolume || null }
  }
  return null
}

function mergeAndRank(captionTags, aiTags) {
  const seen = new Set()
  const merged = []

  // Caption-derived rank highest — they've already proven they perform.
  for (const ct of captionTags) {
    if (seen.has(ct.tag)) continue
    seen.add(ct.tag)
    merged.push({
      tag: ct.tag,
      source: 'caption',
      usageCount: ct.count,
      recommended: true,
    })
  }

  for (const at of aiTags) {
    if (!at || !at.tag || seen.has(at.tag)) continue
    seen.add(at.tag)
    merged.push({
      tag: at.tag,
      source: 'trend',
      volume: at.volume || null,
      recommended: false,
    })
  }

  return merged
}

function fallbackHashtags(ctx) {
  const { account } = ctx
  const category = (account.category || 'general').toLowerCase().replace(/\s+/g, '')

  return {
    hashtags: [
      { tag: `${category}life`, source: 'fallback', recommended: true },
      { tag: `${category}community`, source: 'fallback', recommended: true },
      { tag: `${category}tips`, source: 'fallback', recommended: true },
      { tag: `reelsofinstagram`, source: 'fallback', recommended: false },
      { tag: `explorepage`, source: 'fallback', recommended: false },
    ],
    sourceBreakdown: { fromCaptions: 0, fromTrends: 0 },
    meta: {
      accountUsername: account.username,
      category: account.category || 'General',
      generatedAt: new Date().toISOString(),
    },
  }
}

function deYouTube(text) {
  if (!text) return ''
  return String(text)
    .replace(/\bvideos?\b/gi, 'reels')
    .replace(/\bchannel\b/gi, 'account')
    .replace(/\bsubscribers?\b/gi, 'followers')
}
