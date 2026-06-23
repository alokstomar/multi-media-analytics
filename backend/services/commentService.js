import Comment from '../models/Comment.js'
import Video from '../models/Video.js'
import Channel from '../models/Channel.js'
import { fetchChannelComments } from './youtubeService.js'
import { analyzeComment } from '../utils/sentimentAnalysis.js'
import { generateCommentInsights, generateReplySuggestions } from '../utils/commentInsights.js'
import { AppError } from '../utils/errorHandler.js'

const CACHE_TTL_MS = 15 * 60 * 1000
const VALID_DEPTHS = [5, 10, 25]
const VALID_VOLUMES = [100, 250, 500, 0]
const SUMMARY_SAMPLE_LIMIT = 500

const SENTIMENT_COLORS = {
  Positive: '#10B981',
  Negative: '#EF4444',
  Neutral: '#3B82F6',
  Question: '#F59E0B',
}

const EMOTION_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4']

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

function scopedFilter(channelId, workspaceId) {
  const filter = { channelId }
  if (workspaceId) filter.workspaceId = workspaceId
  return filter
}

function buildCommentFilter(channelIds, { workspaceId, sentiment, search, timeRange, language } = {}) {
  const ids = Array.isArray(channelIds) ? channelIds : [channelIds]
  const filter = ids.length === 1 ? { channelId: ids[0] } : { channelId: { $in: ids } }
  if (workspaceId) filter.workspaceId = workspaceId

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

  return filter
}

async function getCacheMeta(channelId, workspaceId) {
  const filter = scopedFilter(channelId, workspaceId)
  const latest = await Comment.findOne(filter).sort({ fetchedAt: -1 }).select('fetchedAt syncDepth').lean()
  const count = await Comment.countDocuments(filter)
  const videosScanned = await Comment.distinct('videoId', filter)
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
  const videos = videoIds.length ? await Video.find({ videoId: { $in: videoIds } }).lean() : []
  const videoMap = Object.fromEntries(videos.map((v) => [v.videoId, v]))

  return comments.map((c) => {
    const v = c.videoId ? videoMap[c.videoId] : null
    return formatCommentForApi(c, v)
  })
}

function formatCommentForApi(c, video) {
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

function percentBreakdown(rows, total, colorFor) {
  const safeTotal = total || 1
  return rows
    .filter((row) => row._id && row.count > 0)
    .map((row, index) => ({
      name: row._id,
      value: parseFloat(((row.count / safeTotal) * 100).toFixed(1)),
      count: row.count,
      color: colorFor(row._id, index),
    }))
}

function normalizeSummaryAggregation(rows) {
  const agg = rows?.[0] || {}
  const stats = agg.stats?.[0] || {}
  const total = stats.total || 0
  const positiveCount = stats.positiveCount || 0
  const toxicCount = stats.toxicCount || 0

  return {
    stats: {
      totalComments: total,
      avgSentimentScore: total ? Math.round(stats.avgScore || 0) : 0,
      positiveRate: total ? parseFloat(((positiveCount / total) * 100).toFixed(1)) : 0,
      toxicCount,
      toxicRate: total ? parseFloat(((toxicCount / total) * 100).toFixed(1)) : 0,
      questionCount: stats.questionCount || 0,
      viralCount: stats.viralCount || 0,
      responseRate: null,
      responseRateEstimated: true,
    },
    sentimentBreakdown: percentBreakdown(agg.sentimentBreakdown || [], total, (name) => SENTIMENT_COLORS[name] || SENTIMENT_COLORS.Neutral),
    emotionBreakdown: percentBreakdown(agg.emotionBreakdown || [], total, (_name, index) => EMOTION_COLORS[index % EMOTION_COLORS.length]),
    languageBreakdown: (agg.languageBreakdown || [])
      .filter((row) => row._id)
      .map((row) => ({ lang: row._id, count: row.count })),
    topTopics: (agg.topTopics || []).map((row) => ({ topic: row._id, count: row.count })),
    commentsOverTime: (agg.commentsOverTime || []).map((row) => ({
      date: new Date(`${row._id}T00:00:00.000Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      count: row.count,
    })),
    tabCounts: {
      all: total,
      positive: positiveCount,
      negative: stats.negativeCount || 0,
      questions: stats.questionCount || 0,
      toxic: toxicCount,
    },
  }
}

async function aggregateCommentSummary(filter) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const rows = await Comment.aggregate([
    { $match: filter },
    {
      $facet: {
        stats: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              avgScore: { $avg: '$aiScore' },
              positiveCount: { $sum: { $cond: [{ $eq: ['$sentiment', 'Positive'] }, 1, 0] } },
              negativeCount: { $sum: { $cond: [{ $eq: ['$sentiment', 'Negative'] }, 1, 0] } },
              questionCount: { $sum: { $cond: ['$isQuestion', 1, 0] } },
              toxicCount: { $sum: { $cond: ['$isToxic', 1, 0] } },
              viralCount: { $sum: { $cond: ['$isViral', 1, 0] } },
            },
          },
        ],
        sentimentBreakdown: [
          { $group: { _id: '$sentiment', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ],
        emotionBreakdown: [
          { $group: { _id: '$emotion', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ],
        languageBreakdown: [
          { $group: { _id: '$language', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ],
        topTopics: [
          { $unwind: '$topics' },
          { $group: { _id: '$topics', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 8 },
        ],
        commentsOverTime: [
          { $match: { publishedAt: { $gte: thirtyDaysAgo } } },
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$publishedAt' } }, count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ],
      },
    },
  ])

  return normalizeSummaryAggregation(rows)
}

export async function syncCommentsFromYouTube(channelId, { force = false, maxVideos = 10, maxVolume = 0, workspaceId } = {}) {
  const channelFilter = { channelId }
  if (workspaceId) channelFilter.workspaceId = workspaceId
  const channel = await Channel.findOne(channelFilter).lean()
  if (!channel) throw new AppError('Channel not found', 404)

  const safeMaxVideos = VALID_DEPTHS.includes(maxVideos) ? maxVideos : 10
  const effectiveWorkspaceId = workspaceId || channel.workspaceId
  const meta = await getCacheMeta(channelId, effectiveWorkspaceId)
  if (!force && !meta.isStale && meta.count > 0 && meta.lastSyncDepth >= safeMaxVideos) {
    console.log(`[SYNC] Channel "${channel.title}": using cache (${meta.count} comments, depth=${meta.lastSyncDepth})`)
    return { synced: false, fromCache: true, count: meta.count, lastFetchedAt: meta.lastFetchedAt, videosScanned: meta.videosScanned }
  }

  console.log(`[SYNC] Channel "${channel.title}": fetching from YouTube (maxVideos=${safeMaxVideos})...`)

  const maxPagesPerVideo = maxVolume > 0 ? Math.ceil(maxVolume / (safeMaxVideos * 100)) || 1 : 3
  const { comments: rawThreads, videosScanned, apiCalls } = await fetchChannelComments(channelId, {
    maxVideos: safeMaxVideos,
    maxPagesPerVideo,
  })

  const threads = maxVolume > 0 ? rawThreads.slice(0, maxVolume) : rawThreads
  const fetchedAt = new Date()
  const videoIds = [...new Set(threads.map((t) => t.videoId).filter(Boolean))]
  const videos = videoIds.length ? await Video.find({ videoId: { $in: videoIds } }).lean() : []
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
            workspaceId: effectiveWorkspaceId,
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

  const storedCount = await Comment.countDocuments(scopedFilter(channelId, effectiveWorkspaceId))
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

const activeSyncs = new Set()

export function enqueueCommentSync(channelId, { maxVideos = 10, maxVolume = 0, workspaceId } = {}) {
  const key = `${workspaceId || 'global'}:${channelId}`
  if (activeSyncs.has(key)) {
    return { queued: true, deduped: true, channelId }
  }

  activeSyncs.add(key)
  setTimeout(async () => {
    try {
      await syncCommentsFromYouTube(channelId, { force: true, maxVideos, maxVolume, workspaceId })
    } catch (err) {
      console.error(`[CommentSync] Background sync failed for ${channelId}:`, err.message)
    } finally {
      activeSyncs.delete(key)
    }
  }, 0)

  return { queued: true, deduped: false, channelId }
}

export async function getComments(channelId, {
  page = 1,
  limit = 20,
  sentiment,
  search,
  timeRange,
  language,
  workspaceId,
} = {}) {
  const channelFilter = { channelId }
  if (workspaceId) channelFilter.workspaceId = workspaceId
  const channel = await Channel.findOne(channelFilter).lean()
  if (!channel) throw new AppError('Channel not found', 404)

  const filter = buildCommentFilter(channelId, { workspaceId, sentiment, search, timeRange, language })
  const safePage = Math.max(1, page)
  const skip = (safePage - 1) * limit
  const [docs, total] = await Promise.all([
    Comment.find(filter).sort({ publishedAt: -1 }).skip(skip).limit(limit).lean(),
    Comment.countDocuments(filter),
  ])

  const meta = await getCacheMeta(channelId, workspaceId)
  const data = await enrichWithVideoMeta(docs)

  return {
    data,
    pagination: {
      page: safePage,
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

export async function getMultiChannelComments(channelIds, {
  page = 1,
  limit = 20,
  sentiment,
  search,
  timeRange,
  language,
  workspaceId,
} = {}) {
  if (!channelIds?.length) throw new AppError('Provide at least one channelId', 400)

  const uniqueIds = [...new Set(channelIds)]
  const channelFilter = { channelId: { $in: uniqueIds } }
  if (workspaceId) channelFilter.workspaceId = workspaceId
  const channels = await Channel.find(channelFilter).lean()
  if (!channels.length) throw new AppError('No matching channels found', 404)

  const filter = buildCommentFilter(uniqueIds, { workspaceId, sentiment, search, timeRange, language })
  const safePage = Math.max(1, page)
  const skip = (safePage - 1) * limit
  const [docs, total] = await Promise.all([
    Comment.find(filter).sort({ publishedAt: -1 }).skip(skip).limit(limit).lean(),
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
      page: safePage,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
    channelIds: uniqueIds,
  }
}

export async function getCommentsSummary(channelId, { workspaceId } = {}) {
  const channelFilter = { channelId }
  if (workspaceId) channelFilter.workspaceId = workspaceId
  const channel = await Channel.findOne(channelFilter).lean()
  if (!channel) throw new AppError('Channel not found', 404)

  const filter = scopedFilter(channelId, workspaceId)
  const [summary, sampleComments, videos, meta] = await Promise.all([
    aggregateCommentSummary(filter),
    Comment.find(filter).sort({ publishedAt: -1 }).limit(SUMMARY_SAMPLE_LIMIT).lean(),
    Video.find({ channelId }).sort({ comments: -1 }).limit(10).lean(),
    getCacheMeta(channelId, workspaceId),
  ])

  const topEngagedVideos = videos
    .filter((v) => v.comments > 0)
    .slice(0, 5)
    .map((v) => ({
      videoId: v.videoId,
      title: v.title,
      comments: v.comments,
      thumbnail: v.thumbnail,
    }))

  return {
    ...summary,
    topEngagedVideos,
    insights: generateCommentInsights(sampleComments, videos),
    replySuggestions: generateReplySuggestions(sampleComments),
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

export async function getMultiChannelSummary(channelIds, { workspaceId } = {}) {
  if (!channelIds?.length) throw new AppError('Provide at least one channelId', 400)

  const summaries = await Promise.all(
    channelIds.map((id) => getCommentsSummary(id, { workspaceId }))
  )

  const mergedComments = summaries.reduce((s, x) => s + x.stats.totalComments, 0)
  const mergedToxic = summaries.reduce((s, x) => s + x.stats.toxicCount, 0)
  const mergedViral = summaries.reduce((s, x) => s + x.stats.viralCount, 0)
  const mergedQuestions = summaries.reduce((s, x) => s + x.stats.questionCount, 0)

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

  const sentimentByChannel = channelIds.reduce((acc, id, i) => {
    acc[id] = summaries[i].sentimentBreakdown
    return acc
  }, {})

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

  const mostQuestions = summaries.reduce((best, s) => {
    return s.stats.questionCount > (best?.count || 0) ? { count: s.stats.questionCount, name: s.cache.channelName } : best
  }, null)
  if (mostQuestions?.count >= 3) {
    insights.push({
      title: 'FAQ content opportunity',
      desc: `${mostQuestions.name} has ${mostQuestions.count} unanswered questions - ideal for a dedicated FAQ video.`,
      bg: 'bg-blue-50',
      textColor: 'text-blue-800',
      extra: `+${mostQuestions.count}`,
    })
  }

  const totalToxic = summaries.reduce((s, x) => s + x.stats.toxicCount, 0)
  if (totalToxic > 0) {
    insights.push({
      title: `${totalToxic} toxic comments across portfolio`,
      desc: 'Review flagged comments across channels to protect community health.',
      bg: totalToxic > 10 ? 'bg-red-50' : 'bg-amber-50',
      textColor: totalToxic > 10 ? 'text-red-800' : 'text-amber-800',
    })
  }

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

  const best = summaries.reduce((b, s) =>
    s.stats.positiveRate > (b?.rate || 0) ? { rate: s.stats.positiveRate, name: s.cache.channelName } : b
  , null)
  if (best && channelIds.length > 1) {
    insights.push({
      title: `${best.name} leads in positive sentiment`,
      desc: `${best.rate}% of its comments are positive - replicate its content strategy across channels.`,
      bg: 'bg-emerald-50',
      textColor: 'text-emerald-800',
    })
  }

  return insights.slice(0, 6)
}
