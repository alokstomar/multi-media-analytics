import Channel from '../models/Channel.js'
import Video from '../models/Video.js'
import Comment from '../models/Comment.js'
import { resolveChannelId, fetchChannelDetails, fetchChannelVideos } from '../services/youtubeService.js'
import { AppError } from '../utils/errorHandler.js'

export async function addChannel(req, res, next) {
  try {
    const { input } = req.body
    if (!input) throw new AppError('Provide a channel URL, @handle, or channel ID', 400)

    const channelId = await resolveChannelId(input)
    const details = await fetchChannelDetails(channelId)

    // Perform atomic upsert using global unique channelId
    const result = await Channel.findOneAndUpdate(
      { channelId: details.channelId },
      {
        $set: {
          title: details.title,
          handle: details.handle,
          profileImage: details.profileImage,
          banner: details.banner,
          description: details.description,
          subscribers: details.subscribers,
          totalViews: details.totalViews,
          totalVideos: details.totalVideos,
        },
        $setOnInsert: {
          channelId: details.channelId,
          workspaceId: req.workspaceId,
        }
      },
      {
        new: true,
        upsert: true,
        includeResultMetadata: true,
        setDefaultsOnInsert: true
      }
    )

    const channel = result.value
    const wasUpdated = result.lastErrorObject?.updatedExisting

    if (wasUpdated) {
      console.log(`[Channel Connect] Reused existing channel document: ${channel.channelId} (currently associated with workspace: ${channel.workspaceId})`)

      return res.status(200).json({
        success: true,
        message: 'Channel already connected.',
        data: channel
      })
    }

    console.log(`[Channel Connect] Created new channel: ${channel.channelId} for workspace ${req.workspaceId}`)

    // Fetch and store latest videos
    const videos = await fetchChannelVideos(channelId)
    if (videos.length) {
      const bulkOps = videos.map((v) => ({
        updateOne: {
          filter: { videoId: v.videoId, channelId: v.channelId },
          update: v,
          upsert: true,
        },
      }))
      await Video.bulkWrite(bulkOps)
    }
    res.status(201).json({
      success: true,
      message: 'Channel connected successfully.',
      data: channel
    })
  } catch (err) {
    next(err)
  }
}

// ── Get all channels ──────────────────────────────────────
export async function getChannels(req, res, next) {
  try {
    const channels = await Channel.find({ workspaceId: req.workspaceId }).sort({ subscribers: -1 })
    res.json({ success: true, count: channels.length, data: channels })
  } catch (err) {
    next(err)
  }
}

// ── Get single channel ────────────────────────────────────
export async function getChannel(req, res, next) {
  try {
    const channel = await Channel.findOne({ channelId: req.params.id, workspaceId: req.workspaceId })
    if (!channel) throw new AppError('Channel not found', 404)
    res.json({ success: true, data: channel })
  } catch (err) {
    next(err)
  }
}

// ── Refresh channel data ──────────────────────────────────
export async function refreshChannel(req, res, next) {
  try {
    const { id } = req.params
    const existing = await Channel.findOne({ channelId: id, workspaceId: req.workspaceId })
    if (!existing) throw new AppError('Channel not found', 404)

    const details = await fetchChannelDetails(id)
    const channel = await Channel.findOneAndUpdate({ channelId: id, workspaceId: req.workspaceId }, details, { new: true })

    // Refresh videos too
    const videos = await fetchChannelVideos(id)
    if (videos.length) {
      const bulkOps = videos.map((v) => ({
        updateOne: {
          filter: { videoId: v.videoId, channelId: v.channelId },
          update: v,
          upsert: true,
        },
      }))
      await Video.bulkWrite(bulkOps)
    }
    res.json({ success: true, data: channel })
  } catch (err) {
    next(err)
  }
}

// ── Delete channel ────────────────────────────────────────
export async function deleteChannel(req, res, next) {
  try {
    const channel = await Channel.findOneAndDelete({ channelId: req.params.id, workspaceId: req.workspaceId })
    if (!channel) throw new AppError('Channel not found', 404)
    await Video.deleteMany({ channelId: req.params.id })
    await Comment.deleteMany({ channelId: req.params.id })
    res.json({ success: true, message: 'Channel deleted' })
  } catch (err) {
    next(err)
  }
}
