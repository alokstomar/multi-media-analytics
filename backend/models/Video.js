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
}, {
  timestamps: true,
})

// Prevent duplicate videos per channel
videoSchema.index({ videoId: 1, channelId: 1 }, { unique: true })

export default mongoose.model('Video', videoSchema)
