import Channel from '../models/Channel.js'
import Video from '../models/Video.js'
import { generateAnalytics } from '../utils/analytics.js'
import { generateInsights } from '../utils/insights.js'
import { AppError } from '../utils/errorHandler.js'

// ── Get analytics for a channel ──────────────────────────
export async function getAnalytics(req, res, next) {
  try {
    const { id } = req.params

    const channel = await Channel.findOne({ channelId: id, workspaceId: req.workspaceId })
    if (!channel) throw new AppError('Channel not found', 404)

    const videos = await Video.find({ channelId: id }).sort({ publishedAt: -1 })
    if (!videos.length) throw new AppError('No videos found for this channel', 404)

    const analytics = generateAnalytics(channel, videos)

    res.json({ success: true, data: analytics })
  } catch (err) {
    next(err)
  }
}

// ── Get AI insights ───────────────────────────────────────
export async function getInsights(req, res, next) {
  try {
    const { id } = req.params

    const channel = await Channel.findOne({ channelId: id, workspaceId: req.workspaceId })
    if (!channel) throw new AppError('Channel not found', 404)

    const videos = await Video.find({ channelId: id }).sort({ publishedAt: -1 })
    if (!videos.length) throw new AppError('No videos found for this channel', 404)

    const insights = generateInsights(channel, videos)

    res.json({ success: true, data: insights })
  } catch (err) {
    next(err)
  }
}
