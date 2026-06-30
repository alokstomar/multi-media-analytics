/**
 * Instagram competitor intelligence service.
 *
 * Calls provider.generateCompetitorOpportunities (the same method the YT
 * Portfolio Intelligence uses) with IG-shaped data, then reshapes the
 * response into our IG competitor contract.
 *
 * Competitor set = other IG accounts in the same workspace. The caller
 * passes them in already-filtered to exclude the active account.
 */

import { getAIProvider } from '../ai/index.js'

export async function getCompetitorInsights(ctx, competitorAccounts = []) {
  const { account, recentReels } = ctx

  // No competitors configured → still return a useful structured payload
  // (we surface "no competitors connected" on the frontend).
  if (!competitorAccounts.length) {
    return {
      result: fallbackCompetitorInsights(ctx, competitorAccounts),
      fallback: true,
    }
  }

  // Need at least 1 reel of the active account's own content to give the
  // AI something to compare against.
  if (recentReels.length < 1) {
    return {
      result: fallbackCompetitorInsights(ctx, competitorAccounts),
      fallback: true,
    }
  }

  try {
    const provider = getAIProvider()
    const payload = buildCompetitorPayload(ctx, competitorAccounts)
    const raw = await provider.generateCompetitorOpportunities(payload, {
      channelId: account.accountId,
      feature: 'ig-competitors',
    })

    const opportunities = Array.isArray(raw?.opportunities) ? raw.opportunities : []
    if (!opportunities.length) {
      return {
        result: fallbackCompetitorInsights(ctx, competitorAccounts),
        fallback: true,
      }
    }

    return {
      result: {
        opportunities: opportunities.map((o, i) => ({
          id: o.id || i + 1,
          title: deYouTube(o.title || ''),
          opportunityLevel: o.opportunityLevel || 'Medium',
          estimatedSearchVolume: o.estimatedSearchVolume || o.estimatedReach || 'Unknown',
          reason: deYouTube(o.reason || o.rationale || ''),
        })),
        competitors: payload.competitors.map((c) => ({
          accountId: c.accountId,
          username: c.username,
          followers: c.followers || 0,
          postsCount: c.postsCount || 0,
          category: c.category || '',
        })),
        meta: {
          accountUsername: account.username,
          competitorCount: payload.competitors.length,
          generatedAt: new Date().toISOString(),
        },
      },
    }
  } catch (err) {
    console.warn('[IG AI] competitors fell back:', err.message)
    return {
      result: fallbackCompetitorInsights(ctx, competitorAccounts),
      fallback: true,
    }
  }
}

/**
 * Build the payload generateCompetitorOpportunities expects. We map IG
 * accounts → YT-shaped "competitors" and IG reels → YT-shaped "videos".
 */
function buildCompetitorPayload(ctx, competitorAccounts) {
  const { account, recentReels } = ctx
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
      publishedAt: r.publishDate,
    })),
    competitors: competitorAccounts.map((c) => ({
      channelId: c.accountId,
      accountId: c.accountId,
      username: c.username,
      title: c.username,
      handle: `@${c.username}`,
      description: c.bio || c.category || '',
      subscribers: c.followers || 0,
      totalVideos: c.postsCount || 0,
      followers: c.followers || 0,
      postsCount: c.postsCount || 0,
      category: c.category || '',
    })),
    // We don't currently fetch competitor reels (cross-account). The
    // provider tolerates an empty topVideos list.
    topVideos: [],
  }
}

function deYouTube(text) {
  if (!text) return ''
  return String(text)
    .replace(/\bvideos?\b/gi, 'reels')
    .replace(/\bchannel\b/gi, 'account')
    .replace(/\bsubscribers?\b/gi, 'followers')
    .replace(/\bShorts?\b/g, 'Reels')
}

function fallbackCompetitorInsights(ctx, competitorAccounts = []) {
  const { account } = ctx
  return {
    opportunities: [
      {
        id: 1,
        title: 'Jump on a trending audio your competitors haven’t used yet',
        opportunityLevel: 'High',
        estimatedSearchVolume: 'High',
        reason: 'Trending sounds typically see 2-3 days of peak reach before saturation.',
      },
      {
        id: 2,
        title: 'Turn your top-performing reel into a 3-part series',
        opportunityLevel: 'Medium',
        estimatedSearchVolume: 'Medium',
        reason: 'Serialized content lifts session time and follow conversion.',
      },
      {
        id: 3,
        title: 'Collaborate with a micro-creator in an adjacent niche',
        opportunityLevel: 'Medium',
        estimatedSearchVolume: 'Medium',
        reason: 'Collab posts reach both audiences with algorithmic preference.',
      },
    ],
    competitors: competitorAccounts.map((c) => ({
      accountId: c.accountId,
      username: c.username,
      followers: c.followers || 0,
      postsCount: c.postsCount || 0,
      category: c.category || '',
    })),
    meta: {
      accountUsername: account.username,
      competitorCount: competitorAccounts.length,
      generatedAt: new Date().toISOString(),
    },
  }
}
