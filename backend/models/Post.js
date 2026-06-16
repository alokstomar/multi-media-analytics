import mongoose from 'mongoose'

const postSchema = new mongoose.Schema({
  platform: {
    type: String,
    required: true,
    enum: ['linkedin', 'twitter', 'instagram', 'threads'],
  },
  type: {
    type: String,
    required: true,
    enum: [
      // LinkedIn
      'thought-leadership', 'story', 'educational', 'carousel', 'personal-branding',
      // Twitter
      'tweet', 'thread', 'launch', 'announcement', 'engagement',
      // Instagram
      'reel-caption', 'carousel-caption', 'story-content',
      // Threads
      'post', 'discussion',
      // Repurpose
      'repurposed',
    ],
  },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'queued', 'publishing', 'published', 'failed'],
    default: 'draft',
  },

  content: {
    hook: { type: String, default: '' },
    body: { type: String, default: '' },
    cta: { type: String, default: '' },
    hashtags: [{ type: String }],
    // Twitter-specific
    thread: [{ type: String }],
    // Raw full text for display
    fullText: { type: String, default: '' },
    // Media / Instagram support
    mediaUrls: [{ type: String }],
    contentType: { type: String, default: '' },
    media: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  topic: { type: String, default: '' },
  tone: { type: String, default: 'professional' },
  audience: { type: String, default: '' },
  channelId: { type: String, default: '' },
  // Source video for repurposed content
  sourceVideoId: { type: String, default: '' },
  sourceVideoTitle: { type: String, default: '' },
  // Scheduling
  scheduledAt: { type: Date, default: null },
  publishedAt: { type: Date, default: null },
  // Platform response
  platformPostId: { type: String, default: '' },
  platformResponse: { type: mongoose.Schema.Types.Mixed, default: null },
  // Workspace Isolation
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace' },
}, { timestamps: true })

postSchema.index({ workspaceId: 1 })
postSchema.index({ platform: 1, status: 1 })
postSchema.index({ scheduledAt: 1 })
postSchema.index({ channelId: 1 })

postSchema.statics.findByStatus = function (status, { platform, limit = 50 } = {}) {
  const query = { status }
  if (platform) query.platform = platform
  return this.find(query).sort({ createdAt: -1 }).limit(limit).lean()
}

postSchema.statics.findScheduled = function ({ before } = {}) {
  const query = { status: 'scheduled', scheduledAt: { $ne: null } }
  if (before) query.scheduledAt.$lte = before
  return this.find(query).sort({ scheduledAt: 1 }).lean()
}

postSchema.statics.getCalendarEvents = function (startDate, endDate, workspaceId) {
  const query = {
    $or: [
      { scheduledAt: { $gte: startDate, $lte: endDate } },
      { createdAt: { $gte: startDate, $lte: endDate } },
    ],
  }
  if (workspaceId) {
    query.workspaceId = workspaceId
  }
  return this.find(query).sort({ scheduledAt: 1, createdAt: 1 }).lean()
}

export default mongoose.model('Post', postSchema)
