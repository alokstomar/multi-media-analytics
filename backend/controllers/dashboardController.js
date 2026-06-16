import Channel from '../models/Channel.js'
import Video from '../models/Video.js'
import { generateAnalytics } from '../utils/analytics.js'
import { generateInsights } from '../utils/insights.js'
import { AppError } from '../utils/errorHandler.js'

// ── Complete dashboard data ──────────────────────────────
export async function getDashboard(req, res, next) {
  try {
    const { channelId } = req.params

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

    res.json({
      success: true,
      data: {
        channel,
        overview: analytics.overview,
        trafficSources: analytics.trafficSources,
        subscribersGrowth: analytics.subscribersGrowth,
        topVideos: analytics.topVideos,
        monthlyViews: analytics.monthlyViews,
        aiInsights,
      },
    })
  } catch (err) {
    next(err)
  }
}
