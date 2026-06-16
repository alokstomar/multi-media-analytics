import mongoose from 'mongoose'

const linkedinContentIdeaSchema = new mongoose.Schema({
  prompt: {
    type: String,
    required: true,
  },
  response: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  type: {
    type: String,
    required: true,
    default: 'idea-suggestions'
  },
  account: {
    type: String,
    required: true,
    default: 'Samay Raina'
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
  }
}, { timestamps: true })

linkedinContentIdeaSchema.index({ workspaceId: 1 })

export default mongoose.model('LinkedinContentIdea', linkedinContentIdeaSchema)
