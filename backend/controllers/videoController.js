import Video from '../models/Video.js'
import Channel from '../models/Channel.js'
import { fetchChannelVideos } from '../services/youtubeService.js'
import { AppError } from '../utils/errorHandler.js'

// ── Get videos for a channel ──────────────────────────────
export async function getVideos(req, res, next) {
  try {
    const { id } = req.params
    const { page = 1, limit = 20, refresh = 'false' } = req.query

    const channel = await Channel.findOne({ channelId: id, workspaceId: req.workspaceId })
    if (!channel) throw new AppError('Channel not found', 404)

    // Optionally refresh from YouTube API
    if (refresh === 'true') {
      const fresh = await fetchChannelVideos(id, Number(limit))
      if (fresh.length) {
        const bulkOps = fresh.map((v) => ({
          updateOne: {
            filter: { videoId: v.videoId, channelId: v.channelId },
            update: v,
            upsert: true,
          },
        }))
        await Video.bulkWrite(bulkOps)
      }
    }

    const skip = (Number(page) - 1) * Number(limit)
    const videos = await Video.find({ channelId: id })
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(Number(limit))

    const total = await Video.countDocuments({ channelId: id })

    res.json({
      success: true,
      data: videos,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    })
  } catch (err) {
    next(err)
  }
}
