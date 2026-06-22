import Channel from '../models/Channel.js'
import Video from '../models/Video.js'
import IntelligenceCache from '../models/IntelligenceCache.js'
import { generateAnalytics } from '../utils/analytics.js'
import { generateInsights } from '../utils/insights.js'
import { AppError } from '../utils/errorHandler.js'

const CACHE_TTL_MS = 10 * 60 * 1000

// ── Complete dashboard data ──────────────────────────────
export async function getDashboard(req, res, next) {
  try {
    const { channelId } = req.params

    try {
      const hit = await IntelligenceCache.findCached(channelId, 'dashboard')
      if (hit && Date.now() - new Date(hit.createdAt).getTime() < CACHE_TTL_MS) {
        return res.json({ success: true, data: hit.result })
      }
    } catch { /* cache read failure — proceed */ }

    const channel = await Channel.findOne({ channelId, workspaceId: req.workspaceId })
    if (!channel) throw new AppError('Channel not found', 404)

    const videos = await Video.find({ channelId }).sort({ publishedAt: -1 })

    // Even if no videos, return channel data with empty analytics
    const analytics = videos.length ? generateAnalytics(channel, videos) : {
      overview: {
        subscribers: channel.subscribers,
        totalViews: channel.totalViews,
        totalVideos: channel.totalVideos,
        engagementRate: 0,
        averageViews: 0,
        uploadFrequency: 0,
        viewsGrowth: 0,
      },
      trafficSources: [],
      subscribersGrowth: [],
      topVideos: [],
      monthlyViews: [],
    }

    const aiInsights = videos.length ? generateInsights(channel, videos) : []

    const payload = {
      channel,
      overview: analytics.overview,
      trafficSources: analytics.trafficSources,
      subscribersGrowth: analytics.subscribersGrowth,
      topVideos: analytics.topVideos,
      monthlyViews: analytics.monthlyViews,
      aiInsights,
    }

    try {
      await IntelligenceCache.upsert(channelId, 'dashboard', payload)
    } catch { /* cache write failure — non-blocking */ }

    res.json({ success: true, data: payload })
  } catch (err) {
    next(err)
  }
}
