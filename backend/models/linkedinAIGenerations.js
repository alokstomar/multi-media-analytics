import mongoose from 'mongoose'

const linkedinAIGenerationSchema = new mongoose.Schema({
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
    default: 'post-generation'
  },
  account: {
    type: String,
    required: true,
    default: 'Samay Raina'
  }
}, { timestamps: true })

export default mongoose.model('LinkedinAIGeneration', linkedinAIGenerationSchema)
