import mongoose from 'mongoose'

const channelSchema = new mongoose.Schema({
  channelId: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  handle: String,
  profileImage: String,
  banner: String,
  description: String,
  subscribers: { type: Number, default: 0 },
  totalViews: { type: Number, default: 0 },
  totalVideos: { type: Number, default: 0 },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})

channelSchema.index({ workspaceId: 1 })

// Virtual: videos linked to this channel
channelSchema.virtual('videos', {
  ref: 'Video',
  localField: 'channelId',
  foreignField: 'channelId',
})

export default mongoose.model('Channel', channelSchema)
