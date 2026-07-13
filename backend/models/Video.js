import mongoose from 'mongoose'

const videoSchema = new mongoose.Schema({
  videoId: { type: String, required: true },
  channelId: { type: String, required: true, index: true },
  title: String,
  thumbnail: String,
  publishedAt: Date,
  views: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  comments: { type: Number, default: 0 },
  // Speech corpus for Creator DNA analysis. Populated lazily by
  // transcriptService.ensureTranscriptsForVideos on first analyzeCreatorStyle
  // cold build. transcriptFetchedAt drives a 14-day soft refresh window.
  transcript: { type: String, default: null },
  transcriptSource: { type: String, default: null, enum: [null, 'manual', 'auto', 'unknown'] },
  transcriptFetchedAt: { type: Date, default: null },
}, {
  timestamps: true,
})

// Prevent duplicate videos per channel
videoSchema.index({ videoId: 1, channelId: 1 }, { unique: true })

export default mongoose.model('Video', videoSchema)
