import Comment from '../models/Comment.js'
import Video from '../models/Video.js'
import Channel from '../models/Channel.js'
import { fetchChannelComments } from './youtubeService.js'
import { analyzeComment, aggregateSentiment, aggregateEmotions } from '../utils/sentimentAnalysis.js'
import { generateCommentInsights, generateReplySuggestions } from '../utils/commentInsights.js'
import { AppError } from '../utils/errorHandler.js'

// Cache TTL: 15 minutes
const CACHE_TTL_MS = 15 * 60 * 1000

// Valid video depth options
const VALID_DEPTHS = [5, 10, 25]
// Valid comment volume options (max total comments fetched per channel per sync)
const VALID_VOLUMES = [100, 250, 500, 0] // 0 = unlimited

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

async function getCacheMeta(channelId) {
  const latest = await Comment.findOne({ channelId }).sort({ fetchedAt: -1 }).select('fetchedAt syncDepth')
  const count = await Comment.countDocuments({ channelId })
  const videosScanned = await Comment.distinct('videoId', { channelId })
  return {
    count,
    videosScanned: videosScanned.filter(Boolean).length,
    lastFetchedAt: latest?.fetchedAt || null,
    lastSyncDepth: latest?.syncDepth || 10,
    isStale: !latest?.fetchedAt || Date.now() - latest.fetchedAt.getTime() > CACHE_TTL_MS,
  }
}

async function enrichWithVideoMeta(comments) {
  const videoIds = [...new Set(comments.map((c) => c.videoId).filter(Boolean))]
  const videos = videoIds.length
    ? await Video.find({ videoId: { $in: videoIds } })
    : []
  const videoMap = Object.fromEntries(videos.map((v) => [v.videoId, v]))

  return comments.map((c) => {
    const v = c.videoId ? videoMap[c.videoId] : null
    return formatCommentForApi(c, v)
  })
}

function formatCommentForApi(doc, video) {
  const c = doc.toObject ? doc.toObject() : doc
  return {
    id: c.commentId,
    channelId: c.channelId,
    channelName: c.channelName || '',
    user: c.authorDisplayName,
    avatar: c.authorProfileImageUrl || 'https://ui-avatars.com/api/?name=User&background=random',
    comment: c.text,
    videoId: c.videoId || null,
    video: c.videoTitle || video?.title || 'Latest Upload',
    videoThumb: c.videoThumbnail || video?.thumbnail || 'https://ui-avatars.com/api/?name=Video&background=3B82F6&color=fff&size=60',
    language: c.language,
    langLabel: c.langLabel,
    sentiment: c.sentiment,
    sentimentColor: c.sentimentColor,
    emotion: c.emotion,
    emotionEmoji: c.emotionEmoji,
    aiScore: c.aiScore,
    isToxic: c.isToxic || false,
    isQuestion: c.isQuestion || false,
    isViral: c.isViral || false,
    topics: c.topics || [],
    likeCount: c.likeCount || 0,
    time: timeAgo(c.publishedAt),
    publishedAt: c.publishedAt,
  }
}

/**
 * Extract simple topic keywords from comment text.
 */
function extractTopics(text) {
  const lower = text.toLowerCase()
  const topics = []

  const topicPatterns = [
    { pattern: /\b(part\s*2|sequel|next\s+episode|part\s+\d+)\b/i, topic: 'Part 2 Request' },
    { pattern: /\b(collab|collaboration|with\s+\w+)\b/i, topic: 'Collab Request' },
    { pattern: /\b(tutorial|teach|how\s+to|guide|explain)\b/i, topic: 'Tutorial Request' },
    { pattern: /\b(review|comparison|compare|vs)\b/i, topic: 'Review/Comparison' },
    { pattern: /\b(subtitles|subtitle|captions|translate)\b/i, topic: 'Subtitles Request' },
    { pattern: /\b(subscribe|subscribed|sub)\b/i, topic: 'Subscription' },
    { pattern: /\b(music|song|bgm|background\s+music)\b/i, topic: 'Music' },
    { pattern: /\b(price|cost|affordable|expensive|cheap|budget)\b/i, topic: 'Pricing' },
    { pattern: /\b(where\s+to\s+buy|buy|purchase|link)\b/i, topic: 'Purchase Info' },
    { pattern: /\b(funny|laugh|lol|haha|hilarious|comedy)\b/i, topic: 'Humor' },
    { pattern: /\b(emotional|cry|tears|heart|touching)\b/i, topic: 'Emotional' },
    { pattern: /\b(tips|advice|trick|hack)\b/i, topic: 'Tips & Tricks' },
    { pattern: /\b(india|indian|hindi|bharat)\b/i, topic: 'India/Hindi Content' },
  ]

  for (const { pattern, topic } of topicPatterns) {
    if (pattern.test(lower)) topics.push(topic)
  }

  return topics.slice(0, 3)
}

/**
 * Sync comments from YouTube API into MongoDB for a channel.
 *
 * @param {string} channelId
 * @param {object} opts
 * @param {boolean} opts.force         - force re-fetch even if cache is fresh
 * @param {number}  opts.maxVideos     - how many videos to scan (5, 10, 25)
 * @param {number}  opts.maxVolume     - max total comments per channel (100, 250, 500, 0=all)
 */
export async function syncCommentsFromYouTube(channelId, { force = false, maxVideos = 10, maxVolume = 0 } = {}) {
  const channel = await Channel.findOne({ channelId })
  if (!channel) throw new AppError('Channel not found', 404)

  const safeMaxVideos = VALID_DEPTHS.includes(maxVideos) ? maxVideos : 10

  const meta = await getCacheMeta(channelId)
  if (!force && !meta.isStale && meta.count > 0 && meta.lastSyncDepth >= safeMaxVideos) {
    console.log(`[SYNC] Channel "${channel.title}": using cache (${meta.count} comments, depth=${meta.lastSyncDepth})`)
    return { synced: false, fromCache: true, count: meta.count, lastFetchedAt: meta.lastFetchedAt, videosScanned: meta.videosScanned }
  }

  console.log(`[SYNC] Channel "${channel.title}": fetching from YouTube (maxVideos=${safeMaxVideos})...`)

  // maxPagesPerVideo: 1 page = 100 comments. For 500 volume / 10 videos = 50/video = 1 page each.
  const maxPagesPerVideo = maxVolume > 0 ? Math.ceil(maxVolume / (safeMaxVideos * 100)) || 1 : 3

  const { comments: rawThreads, videosScanned, apiCalls } = await fetchChannelComments(channelId, {
    maxVideos: safeMaxVideos,
    maxPagesPerVideo,
  })

  // Apply volume cap if set
  const threads = maxVolume > 0 ? rawThreads.slice(0, maxVolume) : rawThreads

  const fetchedAt = new Date()
  const videoIds = [...new Set(threads.map((t) => t.videoId).filter(Boolean))]
  const videos = videoIds.length
    ? await Video.find({ videoId: { $in: videoIds } })
    : []
  const videoMap = Object.fromEntries(videos.map((v) => [v.videoId, v]))

  const bulkOps = threads.map((thread) => {
    const analysis = analyzeComment(thread.text, { likeCount: thread.likeCount })
    const video = thread.videoId ? videoMap[thread.videoId] : null
    const topics = extractTopics(thread.text)
    const isQuestion = analysis.sentiment === 'Question' || thread.text.includes('?')
    const isViral = analysis.aiScore >= 90 && thread.likeCount >= 5

    return {
      updateOne: {
        filter: { commentId: thread.commentId },
        update: {
          $set: {
            commentId: thread.commentId,
            channelId,
            channelName: channel.title,
            videoId: thread.videoId,
            authorDisplayName: thread.authorDisplayName,
            authorProfileImageUrl: thread.authorProfileImageUrl,
            text: thread.text,
            publishedAt: thread.publishedAt,
            likeCount: thread.likeCount,
            videoTitle: video?.title || null,
            videoThumbnail: video?.thumbnail || null,
            fetchedAt,
            syncDepth: safeMaxVideos,
            topics,
            isQuestion,
            isViral,
            ...analysis,
          },
        },
        upsert: true,
      },
    }
  })

  if (bulkOps.length) {
    await Comment.bulkWrite(bulkOps)
  }

  const storedCount = await Comment.countDocuments({ channelId })
  console.log(`[SYNC] "${channel.title}": ${threads.length} fetched, ${storedCount} total, ${videosScanned} videos, ${apiCalls} API calls`)

  return {
    synced: true,
    fromCache: false,
    count: threads.length,
    totalInDb: storedCount,
    videosScanned,
    apiCalls,
    lastFetchedAt: fetchedAt,
  }
}

/**
 * Get paginated comments for a single channel.
 */
export async function getComments(channelId, {
  page = 1,
  limit = 20,
  refresh = false,
  sentiment,
  search,
  timeRange,      // '24h' | '7d' | '30d' | null (all)
  maxVideos = 10,
  maxVolume = 0,
  language,
} = {}) {
  const channel = await Channel.findOne({ channelId })
  if (!channel) throw new AppError('Channel not found', 404)

  await syncCommentsFromYouTube(channelId, { force: refresh, maxVideos, maxVolume })

  const filter = { channelId }

  if (sentiment && sentiment !== 'all') {
    if (sentiment === 'toxic') {
      filter.isToxic = true
    } else if (sentiment === 'questions') {
      filter.isQuestion = true
    } else {
      filter.sentiment = sentiment.charAt(0).toUpperCase() + sentiment.slice(1).toLowerCase()
    }
  }

  if (search?.trim()) {
    filter.text = { $regex: search.trim(), $options: 'i' }
  }

  if (timeRange) {
    const now = Date.now()
    const ms = timeRange === '24h' ? 86400000 : timeRange === '7d' ? 604800000 : timeRange === '30d' ? 2592000000 : null
    if (ms) filter.publishedAt = { $gte: new Date(now - ms) }
  }

  if (language && language !== 'all') {
    filter.language = language
  }

  const skip = (Math.max(1, page) - 1) * limit
  const [docs, total] = await Promise.all([
    Comment.find(filter).sort({ publishedAt: -1 }).skip(skip).limit(limit),
    Comment.countDocuments(filter),
  ])

  const meta = await getCacheMeta(channelId)
  const data = await enrichWithVideoMeta(docs)

  return {
    data,
    pagination: {
      page: Math.max(1, page),
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
    cache: {
      lastFetchedAt: meta.lastFetchedAt,
      isStale: meta.isStale,
      totalCached: meta.count,
      videosScanned: meta.videosScanned,
      channelName: channel.title,
    },
  }
}

/**
 * Get paginated comments for multiple channels.
 */
export async function getMultiChannelComments(channelIds, {
  page = 1,
  limit = 20,
  refresh = false,
  sentiment,
  search,
  timeRange,
  maxVideos = 10,
  maxVolume = 0,
  language,
} = {}) {
  if (!channelIds?.length) throw new AppError('Provide at least one channelId', 400)

  const uniqueIds = [...new Set(channelIds)]
  const channels = await Channel.find({ channelId: { $in: uniqueIds } })
  if (!channels.length) throw new AppError('No matching channels found', 404)

  // Sync all channels in parallel
  await Promise.all(uniqueIds.map((id) => syncCommentsFromYouTube(id, { force: refresh, maxVideos, maxVolume })))

  const filter = { channelId: { $in: uniqueIds } }

  if (sentiment && sentiment !== 'all') {
    if (sentiment === 'toxic') {
      filter.isToxic = true
    } else if (sentiment === 'questions') {
      filter.isQuestion = true
    } else {
      filter.sentiment = sentiment.charAt(0).toUpperCase() + sentiment.slice(1).toLowerCase()
    }
  }

  if (search?.trim()) {
    filter.text = { $regex: search.trim(), $options: 'i' }
  }

  if (timeRange) {
    const now = Date.now()
    const ms = timeRange === '24h' ? 86400000 : timeRange === '7d' ? 604800000 : timeRange === '30d' ? 2592000000 : null
    if (ms) filter.publishedAt = { $gte: new Date(now - ms) }
  }

  if (language && language !== 'all') {
    filter.language = language
  }

  const skip = (Math.max(1, page) - 1) * limit
  const [docs, total] = await Promise.all([
    Comment.find(filter).sort({ publishedAt: -1 }).skip(skip).limit(limit),
    Comment.countDocuments(filter),
  ])

  const channelMap = Object.fromEntries(channels.map((c) => [c.channelId, c.title]))
  const data = (await enrichWithVideoMeta(docs)).map((c) => ({
    ...c,
    channelName: channelMap[c.channelId] || c.channelId,
  }))

  return {
    data,
    pagination: {
      page: Math.max(1, page),
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
    channelIds: uniqueIds,
  }
}

/**
 * Get full summary/analytics for a single channel's comments.
 */
export async function getCommentsSummary(channelId, { refresh = false, maxVideos = 10, maxVolume = 0 } = {}) {
  const channel = await Channel.findOne({ channelId })
  if (!channel) throw new AppError('Channel not found', 404)

  await syncCommentsFromYouTube(channelId, { force: refresh, maxVideos, maxVolume })

  const allComments = await Comment.find({ channelId }).sort({ publishedAt: -1 }).lean()
  const videos = await Video.find({ channelId }).sort({ comments: -1 }).limit(10).lean()

  const sentimentBreakdown = aggregateSentiment(allComments)
  const emotionBreakdown = aggregateEmotions(allComments)
  const insights = generateCommentInsights(allComments, videos)
  const replySuggestions = generateReplySuggestions(allComments)

  const total = allComments.length
  const avgScore = total
    ? Math.round(allComments.reduce((s, c) => s + c.aiScore, 0) / total)
    : 0
  const toxicCount = allComments.filter((c) => c.isToxic).length
  const positiveCount = allComments.filter((c) => c.sentiment === 'Positive').length
  const questionCount = allComments.filter((c) => c.isQuestion).length
  const viralCount = allComments.filter((c) => c.isViral).length

  // Language breakdown
  const languageBreakdown = {}
  for (const c of allComments) {
    languageBreakdown[c.language] = (languageBreakdown[c.language] || 0) + 1
  }

  // Topic frequency
  const topicFreq = {}
  for (const c of allComments) {
    for (const t of c.topics || []) {
      topicFreq[t] = (topicFreq[t] || 0) + 1
    }
  }
  const topTopics = Object.entries(topicFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([topic, count]) => ({ topic, count }))

  // Comments over time — group by day for last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const recentComments = allComments.filter((c) => new Date(c.publishedAt) >= thirtyDaysAgo)
  const byDay = {}
  for (const c of recentComments) {
    const key = new Date(c.publishedAt).toISOString().slice(0, 10)
    byDay[key] = (byDay[key] || 0) + 1
  }
  const commentsOverTime = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      count,
    }))

  // Top engaged videos
  const topEngagedVideos = videos
    .filter((v) => v.comments > 0)
    .slice(0, 5)
    .map((v) => ({
      videoId: v.videoId,
      title: v.title,
      comments: v.comments,
      thumbnail: v.thumbnail,
    }))

  // Tab counts
  const tabCounts = {
    all: total,
    positive: allComments.filter((c) => c.sentiment === 'Positive').length,
    negative: allComments.filter((c) => c.sentiment === 'Negative').length,
    questions: questionCount,
    toxic: toxicCount,
  }

  const meta = await getCacheMeta(channelId)

  return {
    stats: {
      totalComments: total,
      avgSentimentScore: avgScore,
      positiveRate: total ? parseFloat(((positiveCount / total) * 100).toFixed(1)) : 0,
      toxicCount,
      toxicRate: total ? parseFloat(((toxicCount / total) * 100).toFixed(1)) : 0,
      questionCount,
      viralCount,
      responseRate: null,
      responseRateEstimated: true,
    },
    sentimentBreakdown,
    emotionBreakdown,
    languageBreakdown: Object.entries(languageBreakdown).map(([lang, count]) => ({ lang, count })),
    topTopics,
    commentsOverTime,
    topEngagedVideos,
    tabCounts,
    insights,
    replySuggestions,
    cache: {
      lastFetchedAt: meta.lastFetchedAt,
      isStale: meta.isStale,
      totalCached: meta.count,
      videosScanned: meta.videosScanned,
      lastSyncDepth: meta.lastSyncDepth,
      channelName: channel.title,
    },
  }
}

/**
 * Get portfolio summary across multiple channels.
 * Returns per-channel data + cross-channel insights.
 */
export async function getMultiChannelSummary(channelIds, { refresh = false, maxVideos = 10, maxVolume = 0 } = {}) {
  if (!channelIds?.length) throw new AppError('Provide at least one channelId', 400)

  const summaries = await Promise.all(
    channelIds.map((id) => getCommentsSummary(id, { refresh, maxVideos, maxVolume }))
  )

  const mergedComments = summaries.reduce((s, x) => s + x.stats.totalComments, 0)
  const mergedToxic = summaries.reduce((s, x) => s + x.stats.toxicCount, 0)
  const mergedViral = summaries.reduce((s, x) => s + x.stats.viralCount, 0)
  const mergedQuestions = summaries.reduce((s, x) => s + x.stats.questionCount, 0)

  // Cross-channel topic overlap
  const allTopicSets = summaries.map((s) => new Set(s.topTopics.map((t) => t.topic)))
  const sharedTopics = []
  if (allTopicSets.length >= 2) {
    const firstSet = allTopicSets[0]
    for (const topic of firstSet) {
      if (allTopicSets.every((set) => set.has(topic))) {
        sharedTopics.push(topic)
      }
    }
  }

  // Cross-channel sentiment comparison
  const sentimentByChannel = channelIds.reduce((acc, id, i) => {
    acc[id] = summaries[i].sentimentBreakdown
    return acc
  }, {})

  // Portfolio insights
  const portfolioInsights = generatePortfolioInsights(channelIds, summaries, sharedTopics)

  return {
    channelIds,
    stats: {
      totalComments: mergedComments,
      toxicCount: mergedToxic,
      viralCount: mergedViral,
      questionCount: mergedQuestions,
      channelCount: channelIds.length,
    },
    sharedTopics,
    sentimentByChannel,
    portfolioInsights,
    perChannel: channelIds.reduce((acc, id, i) => {
      acc[id] = summaries[i]
      return acc
    }, {}),
  }
}

/**
 * Generate cross-channel portfolio-level insights.
 */
function generatePortfolioInsights(channelIds, summaries, sharedTopics) {
  const insights = []
  const total = summaries.reduce((s, x) => s + x.stats.totalComments, 0)
  const allPositive = summaries.reduce((s, x) => s + (x.stats.totalComments * x.stats.positiveRate / 100), 0)
  const avgPositiveRate = total ? (allPositive / total * 100).toFixed(1) : 0

  insights.push({
    title: `Portfolio sentiment: ${avgPositiveRate}% positive`,
    desc: `${total} total comments analyzed across ${channelIds.length} channels.`,
    bg: 'bg-emerald-50',
    textColor: 'text-emerald-800',
  })

  if (sharedTopics.length) {
    insights.push({
      title: 'Shared audience interests',
      desc: `Topics discussed across all channels: ${sharedTopics.slice(0, 3).join(', ')}.`,
      bg: 'bg-violet-50',
      textColor: 'text-violet-800',
      extra: `${sharedTopics.length} shared`,
    })
  }

  // Find channel with most questions → content opportunity
  const mostQuestions = summaries.reduce((best, s, i) => {
    return s.stats.questionCount > (best?.count || 0) ? { idx: i, count: s.stats.questionCount, name: s.cache.channelName } : best
  }, null)
  if (mostQuestions?.count >= 3) {
    insights.push({
      title: 'FAQ content opportunity',
      desc: `${mostQuestions.name} has ${mostQuestions.count} unanswered questions — ideal for a dedicated FAQ video.`,
      bg: 'bg-blue-50',
      textColor: 'text-blue-800',
      extra: `+${mostQuestions.count}`,
    })
  }

  // Cross-channel toxicity warning
  const totalToxic = summaries.reduce((s, x) => s + x.stats.toxicCount, 0)
  if (totalToxic > 0) {
    insights.push({
      title: `${totalToxic} toxic comments across portfolio`,
      desc: 'Review flagged comments across channels to protect community health.',
      bg: totalToxic > 10 ? 'bg-red-50' : 'bg-amber-50',
      textColor: totalToxic > 10 ? 'text-red-800' : 'text-amber-800',
    })
  }

  // Viral content signal
  const totalViral = summaries.reduce((s, x) => s + x.stats.viralCount, 0)
  if (totalViral > 0) {
    insights.push({
      title: `${totalViral} viral comments detected`,
      desc: 'These high-scored, high-liked comments are signals of top-performing content.',
      bg: 'bg-amber-50',
      textColor: 'text-amber-800',
      extra: `${totalViral} viral`,
    })
  }

  // Channel with best sentiment
  const best = summaries.reduce((b, s, i) =>
    s.stats.positiveRate > (b?.rate || 0) ? { idx: i, rate: s.stats.positiveRate, name: s.cache.channelName } : b
  , null)
  if (best && channelIds.length > 1) {
    insights.push({
      title: `${best.name} leads in positive sentiment`,
      desc: `${best.rate}% of its comments are positive — replicate its content strategy across channels.`,
      bg: 'bg-emerald-50',
      textColor: 'text-emerald-800',
    })
  }

  return insights.slice(0, 6)
}
