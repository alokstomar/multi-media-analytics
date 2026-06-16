import mongoose from 'mongoose'

const aiGenerationSchema = new mongoose.Schema({
  prompt: {
    type: String,
    required: true,
  },
  response: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  platform: {
    type: String,
    required: true,
    default: 'twitter',
  }
}, { timestamps: true })

export default mongoose.model('AIGeneration', aiGenerationSchema)
