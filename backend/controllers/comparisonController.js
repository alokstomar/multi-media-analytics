import Channel from '../models/Channel.js'
import Video from '../models/Video.js'
import { generateAnalytics } from '../utils/analytics.js'
import { AppError } from '../utils/errorHandler.js'

// ── Compare multiple channels ────────────────────────────
export async function compareChannels(req, res, next) {
  try {
    const { channelIds } = req.body
    if (!channelIds || !Array.isArray(channelIds) || channelIds.length < 2) {
      throw new AppError('Provide at least 2 channel IDs in channelIds array', 400)
    }

    const results = await Promise.all(
      channelIds.map(async (id) => {
        const channel = await Channel.findOne({ channelId: id, workspaceId: req.workspaceId })
        if (!channel) throw new AppError(`Channel ${id} not found in this workspace`, 404)

        const videos = await Video.find({ channelId: id })
        const analytics = videos.length ? generateAnalytics(channel, videos) : null

        return {
          channel: {
            channelId: channel.channelId,
            title: channel.title,
            profileImage: channel.profileImage,
            subscribers: channel.subscribers,
          },
          analytics: analytics ? analytics.overview : {
            subscribers: channel.subscribers,
            totalViews: channel.totalViews,
            totalVideos: channel.totalVideos,
            engagementRate: 0,
            averageViews: 0,
            uploadFrequency: 0,
            viewsGrowth: 0,
          },
        }
      }),
    )

    // Rank by subscribers
    const ranked = [...results].sort(
      (a, b) => b.channel.subscribers - a.channel.subscribers,
    )

    res.json({ success: true, data: { compared: results, ranked } })
  } catch (err) {
    next(err)
  }
}
