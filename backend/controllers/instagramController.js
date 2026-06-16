import InstagramAccount from '../models/InstagramAccount.js'
import { AppError } from '../utils/errorHandler.js'
import { createHash } from 'crypto'
import { providerFactory } from '../services/instagram/providerFactory.js'
import MockProvider from '../services/instagram/mockProvider.js'
import MetaProvider from '../services/instagram/metaProvider.js'

/**
 * An account is considered "OAuth-bound" (eligible for Meta Graph API) when it
 * carries a real encrypted Meta access token AND a numeric Meta IG user id.
 * Accounts created via the username-only path have a synthetic accountId like
 * "ig_<hash>" and a placeholder token like "mock_access_token_ig_<hash>".
 */
function hasMetaOAuthToken(account) {
  if (!account?.accessToken) return false
  if (account.accessToken === 'revoked') return false
  if (/^mock_access_token_/.test(account.accessToken)) return false
  if (/^mock_ig_access_token/.test(account.accessToken)) return false
  if (!account.instagramUserId) return false
  // Meta IG user ids are numeric; synthetic ones look like "ig_<hash>".
  if (!/^\d+$/.test(String(account.instagramUserId))) return false
  return true
}

function metaProvider() {
  return new MetaProvider()
}

// ── Deterministic seeded random (mirrors frontend utils/deterministic.js) ─
function hashStr(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
function seededFloat(seed, min = 0, max = 1) {
  const n = hashStr(String(seed)) / 4294967295
  return min + n * (max - min)
}
function seededInt(seed, min, max) {
  return Math.round(seededFloat(seed, min, max))
}

// ── Generate deterministic mock analytics for an account ──────────────────
function generateMockAnalytics(account) {
  const id = account.accountId
  const followers = account.followers || seededInt(id + 'f', 10000, 500000)

  const reach = seededInt(id + 'r', followers * 2, followers * 6)
  const impressions = seededInt(id + 'i', reach * 2, reach * 4)
  const engRate = parseFloat(seededFloat(id + 'e', 2.1, 8.9).toFixed(2))
  const profileVisits = seededInt(id + 'pv', Math.floor(reach * 0.05), Math.floor(reach * 0.15))
  const reelViews = seededInt(id + 'rv', followers * 3, followers * 12)
  const saves = seededInt(id + 's', Math.floor(reach * 0.01), Math.floor(reach * 0.04))
  const shares = seededInt(id + 'sh', Math.floor(reach * 0.005), Math.floor(reach * 0.02))

  // Growth figures
  const followersGrowth = parseFloat(seededFloat(id + 'fg', -2, 18).toFixed(1))
  const reachGrowth = parseFloat(seededFloat(id + 'rg', -5, 28).toFixed(1))
  const engGrowth = parseFloat(seededFloat(id + 'eg', -3, 15).toFixed(1))
  const reelGrowth = parseFloat(seededFloat(id + 'rlg', -8, 45).toFixed(1))

  // Time-series — 30 daily data points
  const days = Array.from({ length: 30 }, (_, i) => {
    const seed = id + i
    const dayReach = seededInt(seed + 'dr', Math.floor(reach / 50), Math.floor(reach / 20))
    const dayFollowers = seededInt(seed + 'df', Math.floor(followers / 1000), Math.floor(followers / 200))
    const dayImpressions = seededInt(seed + 'di', dayReach * 2, dayReach * 4)
    const date = new Date()
    date.setDate(date.getDate() - (29 - i))
    const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return {
      date: label,
      reach: dayReach,
      followers: dayFollowers,
      impressions: dayImpressions,
      engagement: parseFloat(seededFloat(seed + 'de', engRate * 0.5, engRate * 1.5).toFixed(2)),
      saves: seededInt(seed + 'ds', 10, 200),
      reelViews: seededInt(seed + 'drv', 500, 15000),
    }
  })

  // Top posts (mock)
  const postTypes = ['Reel', 'Carousel', 'Image', 'Story']
  const posts = Array.from({ length: 12 }, (_, i) => {
    const pseed = id + 'post' + i
    const pReach = seededInt(pseed + 'pr', 1000, 80000)
    const pLikes = seededInt(pseed + 'pl', 50, Math.floor(pReach * 0.15))
    const pComments = seededInt(pseed + 'pc', 5, Math.floor(pLikes * 0.12))
    const pSaves = seededInt(pseed + 'ps', 10, Math.floor(pLikes * 0.3))
    const pShares = seededInt(pseed + 'psh', 5, Math.floor(pLikes * 0.2))
    const pEngRate = parseFloat((((pLikes + pComments + pSaves + pShares) / pReach) * 100).toFixed(2))
    const type = postTypes[seededInt(pseed + 'pt', 0, 3)]
    const date = new Date()
    date.setDate(date.getDate() - seededInt(pseed + 'pd', 0, 60))

    const captions = [
      `Behind the scenes of my latest ${type} 🎬`,
      `This is how I approach content creation 💡`,
      `Let's talk about what really matters 🔥`,
      `New ${type} just dropped — thoughts? 👇`,
      `The truth about growing on Instagram 📈`,
      `Everything changed when I tried this ✨`,
      `A day in my life as a creator 🎥`,
      `How I gained ${seededInt(pseed + 'cg', 100, 5000)} followers with this ${type}`,
      `Do this every day and watch your reach explode 💥`,
      `My honest review after 30 days of posting daily`,
      `Why most creators fail at ${type}s (and how to fix it)`,
      `This ${type} got ${seededInt(pseed + 'cv', 5000, 200000)} views overnight 🚀`,
    ]
    return {
      id: `${id}_post_${i}`,
      type,
      caption: captions[i % captions.length],
      thumbnail: `https://picsum.photos/seed/${pseed}/300/300`,
      reach: pReach,
      likes: pLikes,
      comments: pComments,
      saves: pSaves,
      shares: pShares,
      engagementRate: pEngRate,
      publishedAt: date.toISOString(),
      timeAgo: `${seededInt(pseed + 'ta', 1, 60)}d ago`,
    }
  })

  return {
    overview: {
      followers,
      reach,
      impressions,
      engagementRate: engRate,
      profileVisits,
      reelViews,
      saves,
      shares,
      followersGrowth,
      reachGrowth,
      engGrowth,
      reelGrowth,
    },
    timeSeries: days,
    posts,
  }
}

// ── Build a 30-day time series from Meta account-level insights ──────────
function buildTimeSeriesFromInsights(insightsRaw, fallbackFollowers) {
  if (!insightsRaw?.data) {
    return Array.from({ length: 30 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (29 - i))
      return {
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        reach: 0,
        followers: fallbackFollowers,
        impressions: 0,
        engagement: 0,
        saves: 0,
        reelViews: 0,
      }
    })
  }

  const byDate = new Map()
  for (const metric of insightsRaw.data) {
    if (!metric.values) continue
    for (const v of metric.values) {
      const d = new Date(v.end_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      if (!byDate.has(d)) byDate.set(d, { date: d, reach: 0, followers: 0, impressions: 0, engagement: 0, saves: 0, reelViews: 0 })
      const row = byDate.get(d)
      if (metric.name === 'reach') row.reach = v.value || 0
      else if (metric.name === 'impressions') row.impressions = v.value || 0
      else if (metric.name === 'follower_count') row.followers = v.value || 0
      else if (metric.name === 'profile_views') row.engagement = v.value || 0
    }
  }
  return Array.from(byDate.values()).slice(-30)
}

// ── CRUD Controllers ──────────────────────────────────────────────────────

export async function listAccounts(req, res, next) {
  try {
    const accounts = await InstagramAccount.find({
      workspaceId: req.workspaceId,
      connectionStatus: { $ne: 'revoked' }
    }).sort({ connectedAt: -1 })
    res.json({ success: true, data: accounts })
  } catch (err) {
    next(err)
  }
}

export async function addAccount(req, res, next) {
  try {
    const { username, displayName, category } = req.body
    if (!username) throw new AppError('username is required', 400)

    const clean = username.replace(/^@/, '').trim().toLowerCase()
    const accountId = `ig_${createHash('md5').update(clean).digest('hex').slice(0, 12)}`

    // Search globally by either computed accountId or matching username
    const existing = await InstagramAccount.findOne({
      $or: [
        { accountId },
        { username: `@${clean}` }
      ]
    })

    if (existing) {
      if (existing.workspaceId?.toString() === req.workspaceId?.toString()) {
        console.log(`[INSTAGRAM_CONNECT]\naccountId=${existing.accountId}\ninstagramUserId=${existing.instagramUserId}\nworkspaceId=${req.workspaceId}\noperation=reconnect`)

        // Refresh metadata using active provider
        const provider = providerFactory.getProvider()
        let profile = {}
        try {
          profile = await provider.getProfile(clean)
        } catch (err) {
          console.warn(`[instagramController] addAccount: provider.getProfile failed for ${clean}: ${err.message}`)
        }
        const isMockProfile = !!(profile.isMock || provider instanceof MockProvider)

        existing.displayName = isMockProfile ? (displayName || clean) : (profile.fullName || displayName || existing.displayName)
        existing.profileImage = isMockProfile ? (existing.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || clean)}&background=E1306C&color=fff&size=120`) : (profile.profilePic || existing.profileImage)
        existing.followers = isMockProfile ? 0 : (profile.followers || existing.followers)
        existing.following = isMockProfile ? 0 : (profile.following || existing.following)
        existing.postsCount = isMockProfile ? 0 : (profile.postsCount || existing.postsCount)
        existing.category = category || existing.category
        existing.connectionStatus = 'active'
        await existing.save()

        return res.json({ success: true, data: existing })
      } else {
        console.log(`[INSTAGRAM_CONNECT_CONFLICT] accountId=${existing.accountId} instagramUserId=${existing.instagramUserId} requestedWorkspaceId=${req.workspaceId} ownerWorkspaceId=${existing.workspaceId}`)
        return res.status(400).json({ success: false, message: 'Instagram account already connected.' })
      }
    }

    // Fetch profile details from the active provider (e.g. RapidAPI or MockProvider)
    const provider = providerFactory.getProvider()
    let profile = {}
    let profileError = null
    try {
      profile = await provider.getProfile(clean)
    } catch (err) {
      profileError = err.message
      console.warn(`[instagramController] addAccount: provider.getProfile failed for ${clean}: ${err.message}`)
    }
    const isMockProfile = !!(profile.isMock || provider instanceof MockProvider)

    // If the username-based provider failed entirely and we have no profile data,
    // refuse the connection instead of storing an empty account that would later
    // surface "No analytics available" without explanation.
    if (profileError && !profile.username) {
      return res.status(502).json({
        success: false,
        error: `Cannot connect Instagram account: upstream provider (${provider.constructor.name}) failed: ${profileError}. Use the OAuth connect flow to bind a real Meta account.`,
      })
    }

    const finalAccountId = profile.accountId || accountId

    const updateData = {
      accountId: finalAccountId,
      instagramUserId: finalAccountId,
      accessToken: `mock_access_token_${finalAccountId}`,
      username: `@${clean}`,
      displayName: isMockProfile ? (displayName || clean) : (profile.fullName || displayName || clean),
      profileImage: isMockProfile ? `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || clean)}&background=E1306C&color=fff&size=120` : (profile.profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || clean)}&background=E1306C&color=fff&size=120`),
      followers: isMockProfile ? 0 : (profile.followers || 0),
      following: isMockProfile ? 0 : (profile.following || 0),
      postsCount: isMockProfile ? 0 : (profile.postsCount || 0),
      category: category || 'General',
      isVerified: isMockProfile ? false : (profile.verified !== undefined ? profile.verified : false),
    }

    const account = await InstagramAccount.findOneAndUpdate(
      { accountId: finalAccountId },
      {
        $set: updateData,
        $setOnInsert: { workspaceId: req.workspaceId }
      },
      { upsert: true, new: true }
    )

    console.log(`[INSTAGRAM_CONNECT]\naccountId=${finalAccountId}\ninstagramUserId=${finalAccountId}\nworkspaceId=${req.workspaceId}\noperation=connect`)

    res.status(201).json({ success: true, data: account })
  } catch (err) {
    if (err.code === 11000 || err.message?.includes('E11000')) {
      return res.status(400).json({ success: false, message: 'Instagram account already connected.' })
    }
    next(err)
  }
}

export async function getAccount(req, res, next) {
  try {
    const query = InstagramAccount.buildIdentifierQuery(req.params.id, req.workspaceId)
    const account = await InstagramAccount.findOne(query)
    if (!account) throw new AppError('Account not found', 404)
    res.json({ success: true, data: account })
  } catch (err) {
    next(err)
  }
}

export async function removeAccount(req, res, next) {
  try {
    const query = InstagramAccount.buildIdentifierQuery(req.params.id, req.workspaceId)
    const account = await InstagramAccount.findOneAndDelete(query)
    if (!account) throw new AppError('Account not found', 404)
    res.json({ success: true, message: 'Account removed' })
  } catch (err) {
    next(err)
  }
}

// Helper to map provider reels to posts schema expected by frontend
function mapReelsToPosts(reels, account) {
  const id = account.accountId
  return reels.map((reel, i) => {
    const reelId = reel.reelId || `${id}_post_${i}`
    const views = reel.views || 0
    const likes = reel.likes || 0
    const comments = reel.comments || 0
    
    // Seeded/calculated fallbacks for saves and shares
    const saves = seededInt(reelId + 's', Math.floor(views * 0.01), Math.floor(views * 0.04))
    const shares = seededInt(reelId + 'sh', Math.floor(views * 0.005), Math.floor(views * 0.02))
    
    // Engagement rate calculation
    const reachVal = views || 1
    const pEngRate = parseFloat((((likes + comments + saves + shares) / reachVal) * 100).toFixed(2))
    
    // Published at date mapping
    const pubDate = reel.publishDate ? new Date(reel.publishDate) : new Date()
    
    // Time ago string
    const diffTime = Math.abs(new Date() - pubDate)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    const timeAgo = `${diffDays}d ago`
    
    // Thumbnail resolution
    const thumbnail = reel.thumbnail || reel.rawPayload?.thumbnail_url || reel.rawPayload?.display_url || `https://picsum.photos/seed/${reelId}/300/300`
    
    let type = reel.mediaType || 'Reel'
    if (type === 'Video') {
      type = 'Reel'
    }
    
    return {
      id: reelId,
      type,
      caption: reel.caption || '',
      thumbnail,
      reach: views, // map views to reach for consistency
      likes,
      comments,
      saves,
      shares,
      engagementRate: pEngRate,
      publishedAt: pubDate.toISOString(),
      timeAgo,
    }
  })
}

export async function getAccountAnalytics(req, res, next) {
  try {
    const query = InstagramAccount.buildIdentifierQuery(req.params.id, req.workspaceId)
    const account = await InstagramAccount.findOne(query)
    if (!account) throw new AppError('Account not found', 404)

    // ── Path A: Real Meta Graph API via stored OAuth token ──────────────
    if (hasMetaOAuthToken(account)) {
      const meta = metaProvider()
      let result
      try {
        result = await meta.getAnalyticsByAccount(account)
      } catch (err) {
        // Surface the real failure — do not silently substitute mock data.
        return res.status(502).json({
          success: false,
          error: `Instagram analytics failed: ${err.message}`,
          provider: 'meta',
          source: 'meta_graph_api',
        })
      }

      const m = result.metrics
      // Persist refreshed profile stats so listAccounts reflects live data
      const updated = {}
      if (result.profile.followers != null && result.profile.followers !== account.followers) updated.followers = result.profile.followers
      if (result.profile.following != null && result.profile.following !== account.following) updated.following = result.profile.following
      if (result.profile.postsCount != null && result.profile.postsCount !== account.postsCount) updated.postsCount = result.profile.postsCount
      if (result.profile.fullName && result.profile.fullName !== account.displayName) updated.displayName = result.profile.fullName
      if (result.profile.profilePic && result.profile.profilePic !== account.profileImage) updated.profileImage = result.profile.profilePic
      if (Object.keys(updated).length) {
        await InstagramAccount.updateOne({ _id: account._id }, { $set: updated })
        account.set(updated)
      }

      return res.json({
        success: true,
        data: {
          overview: {
            followers: m.followers,
            reach: m.reach,
            impressions: m.impressions,
            engagementRate: m.engagementRate,
            profileVisits: m.profileVisits,
            reelViews: m.averageViews,
            saves: 0,
            shares: 0,
            followersGrowth: 0,
            reachGrowth: 0,
            engGrowth: 0,
            reelGrowth: 0,
          },
          timeSeries: buildTimeSeriesFromInsights(result.insightsRaw, m.followers),
          posts: mapReelsToPosts(result.reels, account),
          source: 'meta_graph_api',
        },
      })
    }

    // ── Path B: Username-based provider (RapidAPI / Mock) ───────────────
    const cleanUsername = account.username.replace(/^@/, '').trim().toLowerCase()
    const provider = providerFactory.getProvider()

    let profile = {}
    let reels = []
    let profileError = null
    let reelsError = null

    try {
      profile = await provider.getProfile(cleanUsername)
    } catch (err) {
      profileError = err.message
      console.warn(`[instagramController] Provider.getProfile failed for ${cleanUsername}: ${err.message}`)
    }

    try {
      reels = await provider.getReels(cleanUsername)
    } catch (err) {
      reelsError = err.message
      console.warn(`[instagramController] Provider.getReels failed for ${cleanUsername}: ${err.message}`)
    }

    const isMock = !!(profile.isMock || reels.isMock || provider instanceof MockProvider)

    // If the active provider threw real errors AND no mock data was returned,
    // surface the failure rather than rendering an empty "no analytics" state.
    if (profileError && reelsError) {
      return res.status(502).json({
        success: false,
        error: `Instagram provider (${provider.constructor.name}) failed: ${profileError}`,
        provider: provider.constructor.name.toLowerCase(),
      })
    }

    if (isMock || (!profile.followers && reels.length === 0)) {
      return res.json({
        success: true,
        data: {
          overview: null,
          timeSeries: [],
          posts: [],
          message: 'No analytics available',
          source: provider instanceof MockProvider ? 'mock' : 'provider_fallback',
        }
      })
    }

    const followers = profile.followers || account.followers || 0
    
    // Sync back profile changes to the database
    let hasChanged = false
    if (profile.followers && profile.followers !== account.followers) {
      account.followers = profile.followers
      hasChanged = true
    }
    if (profile.following && profile.following !== account.following) {
      account.following = profile.following
      hasChanged = true
    }
    if (profile.postsCount && profile.postsCount !== account.postsCount) {
      account.postsCount = profile.postsCount
      hasChanged = true
    }
    if (profile.fullName && profile.fullName !== account.displayName) {
      account.displayName = profile.fullName
      hasChanged = true
    }
    if (profile.profilePic && profile.profilePic !== account.profileImage) {
      account.profileImage = profile.profilePic
      hasChanged = true
    }
    if (hasChanged) {
      await account.save()
    }
    
    let totalViews = 0
    let totalLikes = 0
    let totalComments = 0
    reels.forEach(r => {
      totalViews += r.views || 0
      totalLikes += r.likes || 0
      totalComments += r.comments || 0
    })
    
    const reach = totalViews || Math.round(followers * 3)
    const impressions = Math.round(reach * 1.3)
    const reelViews = totalViews || Math.round(followers * 6) // Fallback if no views
    
    let engagementRate = 0
    if (followers > 0) {
      engagementRate = parseFloat((((totalLikes + totalComments) / followers) * 100).toFixed(2))
    }
    
    const id = account.accountId
    const profileVisits = 0
    const saves = 0
    const shares = 0
    
    const followersGrowth = 0
    const reachGrowth = 0
    const engGrowth = 0
    const reelGrowth = 0
    
    const days = Array.from({ length: 30 }, (_, i) => {
      const seed = id + i
      const dayReach = 0
      const dayFollowers = followers
      const dayImpressions = 0
      const date = new Date()
      date.setDate(date.getDate() - (29 - i))
      const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      return {
        date: label,
        reach: dayReach,
        followers: dayFollowers,
        impressions: dayImpressions,
        engagement: 0,
        saves: 0,
        reelViews: 0,
      }
    })
    
    const posts = mapReelsToPosts(reels, account)
    
    res.json({
      success: true,
      data: {
        overview: {
          followers,
          reach,
          impressions,
          engagementRate,
          profileVisits,
          reelViews,
          saves,
          shares,
          followersGrowth,
          reachGrowth,
          engGrowth,
          reelGrowth,
        },
        timeSeries: days,
        posts
      }
    })
  } catch (err) {
    next(err)
  }
}

export async function getAccountPosts(req, res, next) {
  try {
    const query = InstagramAccount.buildIdentifierQuery(req.params.id, req.workspaceId)
    const account = await InstagramAccount.findOne(query)
    if (!account) throw new AppError('Account not found', 404)

    // ── Path A: Meta Graph API via stored OAuth token ───────────────────
    if (hasMetaOAuthToken(account)) {
      const meta = metaProvider()
      let reels
      try {
        reels = await meta.getReelsByAccount(account, 50)
      } catch (err) {
        return res.status(502).json({
          success: false,
          error: `Instagram posts failed: ${err.message}`,
          provider: 'meta',
        })
      }
      const posts = mapReelsToPosts(reels, account)
      const type = req.query.type
      const filtered = type && type !== 'All' ? posts.filter(p => p.type === type) : posts
      return res.json({ success: true, data: filtered, total: filtered.length, source: 'meta_graph_api' })
    }

    // ── Path B: Username-based provider ─────────────────────────────────
    const cleanUsername = account.username.replace(/^@/, '').trim().toLowerCase()
    const provider = providerFactory.getProvider()

    let reels = []
    let reelsError = null
    try {
      reels = await provider.getReels(cleanUsername)
    } catch (err) {
      reelsError = err.message
      console.warn(`[instagramController] Provider.getReels failed for ${cleanUsername}: ${err.message}`)
    }

    const isMock = !!(reels.isMock || provider instanceof MockProvider)

    // If the provider threw a real error and we have no usable data, surface
    // the 502 — never paper over an upstream failure with an empty 200.
    if (reelsError && (!Array.isArray(reels) || reels.length === 0)) {
      return res.status(502).json({
        success: false,
        error: `Instagram provider (${provider.constructor.name}) failed: ${reelsError}`,
        provider: provider.constructor.name.toLowerCase(),
      })
    }
    if (isMock) {
      return res.json({ success: true, data: [], total: 0, source: 'mock' })
    }

    const posts = mapReelsToPosts(reels, account)
    const type = req.query.type // 'Reel' | 'Carousel' | 'Image' | 'Story'
    const filtered = type && type !== 'All' ? posts.filter(p => p.type === type) : posts
    res.json({ success: true, data: filtered, total: filtered.length })
  } catch (err) {
    next(err)
  }
}
