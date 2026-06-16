import mongoose from 'mongoose'

const commentSchema = new mongoose.Schema({
  commentId: { type: String, required: true, unique: true },
  channelId: { type: String, required: true, index: true },
  channelName: { type: String, default: '' },
  videoId: { type: String, index: true },
  videoTitle: String,
  videoThumbnail: String,
  authorDisplayName: { type: String, default: 'Anonymous' },
  authorProfileImageUrl: String,
  text: { type: String, required: true },
  publishedAt: { type: Date, required: true },
  likeCount: { type: Number, default: 0 },

  // Sentiment / Emotion
  sentiment: { type: String, required: true },
  sentimentScore: { type: Number, required: true },
  sentimentColor: { type: String, required: true },
  emotion: { type: String, required: true },
  emotionEmoji: { type: String, required: true },

  // Language detection
  language: { type: String, default: 'English' },
  langLabel: { type: String, default: 'EN' },

  // AI quality score
  aiScore: { type: Number, required: true },

  // Flags
  isToxic: { type: Boolean, default: false },

  // Extracted metadata
  topics: [{ type: String }],
  isQuestion: { type: Boolean, default: false },
  isViral: { type: Boolean, default: false },       // aiScore >= 90 + likeCount >= 5

  // Sync metadata
  fetchedAt: { type: Date, default: Date.now },
  syncDepth: { type: Number, default: 10 },          // maxVideos used when this was fetched
}, {
  timestamps: true,
})

commentSchema.index({ channelId: 1, publishedAt: -1 })
commentSchema.index({ channelId: 1, sentiment: 1 })
commentSchema.index({ channelId: 1, isToxic: 1 })
commentSchema.index({ videoId: 1, channelId: 1 })

export default mongoose.model('Comment', commentSchema)
