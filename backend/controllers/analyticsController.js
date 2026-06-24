import Channel from '../models/Channel.js'
import Video from '../models/Video.js'
import IntelligenceCache from '../models/IntelligenceCache.js'
import { generateAnalytics } from '../utils/analytics.js'
import { generateInsights } from '../utils/insights.js'
import { AppError } from '../utils/errorHandler.js'

const CACHE_TTL_MS = 10 * 60 * 1000

async function readCache(channelId, feature) {
  try {
    const hit = await IntelligenceCache.findCached(channelId, feature)
    if (hit && Date.now() - new Date(hit.createdAt).getTime() < CACHE_TTL_MS) {
      return hit.result
    }
  } catch { /* cache read failure — proceed */ }
  return null
}

async function writeCache(channelId, feature, result) {
  try {
    await IntelligenceCache.upsert(channelId, feature, result)
  } catch { /* cache write failure — non-blocking */ }
}

// ── Get analytics for a channel ──────────────────────────
export async function getAnalytics(req, res, next) {
  try {
    const { id } = req.params

    const cached = await readCache(id, 'analytics')
    if (cached) return res.json({ success: true, data: cached })

    const channel = await Channel.findOne({ channelId: id, workspaceId: req.workspaceId })
    if (!channel) throw new AppError('Channel not found', 404)

    const videos = await Video.find({ channelId: id }).sort({ publishedAt: -1 })

    const analytics = generateAnalytics(channel, videos)
    await writeCache(id, 'analytics', analytics)

    res.json({ success: true, data: analytics })
  } catch (err) {
    next(err)
  }
}

// ── Get AI insights ───────────────────────────────────────
export async function getInsights(req, res, next) {
  try {
    const { id } = req.params

    const cached = await readCache(id, 'insights')
    if (cached) return res.json({ success: true, data: cached })

    const channel = await Channel.findOne({ channelId: id, workspaceId: req.workspaceId })
    if (!channel) throw new AppError('Channel not found', 404)

    const videos = await Video.find({ channelId: id }).sort({ publishedAt: -1 })

    const insights = generateInsights(channel, videos)
    await writeCache(id, 'insights', insights)

    res.json({ success: true, data: insights })
  } catch (err) {
    next(err)
  }
}
