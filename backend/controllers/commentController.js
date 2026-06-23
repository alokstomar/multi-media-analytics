import {
  getComments,
  getCommentsSummary,
  getMultiChannelComments,
  getMultiChannelSummary,
  enqueueCommentSync,
} from '../services/commentService.js'
import Channel from '../models/Channel.js'
import { AppError } from '../utils/errorHandler.js'

// Parse video depth — default 10, valid values: 5, 10, 25
function parseDepth(val) {
  const n = parseInt(val, 10)
  return [5, 10, 25].includes(n) ? n : 10
}

// Parse max volume — default 0 (all), valid: 100, 250, 500, 0
function parseVolume(val) {
  const n = parseInt(val, 10)
  return [100, 250, 500, 0].includes(n) ? n : 0
}

export async function listChannelComments(req, res, next) {
  try {
    const { id } = req.params
    const page = parseInt(req.query.page, 10) || 1
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100)
    const { sentiment, search, timeRange, language } = req.query

    const channel = await Channel.findOne({ channelId: id, workspaceId: req.workspaceId })
    if (!channel) throw new AppError('Channel not found or not in workspace', 404)

    const result = await getComments(id, { page, limit, sentiment, search, timeRange, language, workspaceId: req.workspaceId })
    res.json({ success: true, ...result })
  } catch (err) {
    next(err)
  }
}

export async function getChannelCommentsSummary(req, res, next) {
  try {
    const { id } = req.params

    const channel = await Channel.findOne({ channelId: id, workspaceId: req.workspaceId })
    if (!channel) throw new AppError('Channel not found or not in workspace', 404)

    const summary = await getCommentsSummary(id, { workspaceId: req.workspaceId })
    res.json({ success: true, data: summary })
  } catch (err) {
    next(err)
  }
}

export async function refreshChannelComments(req, res, next) {
  try {
    const { id } = req.params
    const maxVideos = parseDepth(req.body?.maxVideos || req.query.maxVideos)
    const maxVolume = parseVolume(req.body?.maxVolume || req.query.maxVolume)

    const channel = await Channel.findOne({ channelId: id, workspaceId: req.workspaceId })
    if (!channel) throw new AppError('Channel not found or not in workspace', 404)

    const result = enqueueCommentSync(id, { maxVideos, maxVolume, workspaceId: req.workspaceId })
    res.status(202).json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

export async function listMultiChannelComments(req, res, next) {
  try {
    const channelIds = (req.query.channelIds || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    const page = parseInt(req.query.page, 10) || 1
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100)
    const { sentiment, search, timeRange, language } = req.query

    // Resolve channels belonging to current workspace
    let targetChannelIds = channelIds
    if (targetChannelIds.length === 0) {
      const workspaceChannels = await Channel.find({ workspaceId: req.workspaceId }).select('channelId')
      targetChannelIds = workspaceChannels.map(c => c.channelId)
    } else {
      // Verify all specified channels belong to current workspace
      const validChannelsCount = await Channel.countDocuments({
        channelId: { $in: targetChannelIds },
        workspaceId: req.workspaceId
      })
      if (validChannelsCount !== targetChannelIds.length) {
        throw new AppError('Access denied: One or more channels do not belong to this workspace', 403)
      }
    }

    const result = await getMultiChannelComments(targetChannelIds, { page, limit, sentiment, search, timeRange, language, workspaceId: req.workspaceId })
    res.json({ success: true, ...result })
  } catch (err) {
    next(err)
  }
}

export async function getMultiChannelCommentsSummary(req, res, next) {
  try {
    const channelIds = (req.query.channelIds || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    // Resolve channels belonging to current workspace
    let targetChannelIds = channelIds
    if (targetChannelIds.length === 0) {
      const workspaceChannels = await Channel.find({ workspaceId: req.workspaceId }).select('channelId')
      targetChannelIds = workspaceChannels.map(c => c.channelId)
    } else {
      // Verify all specified channels belong to current workspace
      const validChannelsCount = await Channel.countDocuments({
        channelId: { $in: targetChannelIds },
        workspaceId: req.workspaceId
      })
      if (validChannelsCount !== targetChannelIds.length) {
        throw new AppError('Access denied: One or more channels do not belong to this workspace', 403)
      }
    }

    const summary = await getMultiChannelSummary(targetChannelIds, { workspaceId: req.workspaceId })
    res.json({ success: true, data: summary })
  } catch (err) {
    next(err)
  }
}
