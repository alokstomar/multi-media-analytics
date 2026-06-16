import mongoose from 'mongoose'

const linkedinTrendSnapshotSchema = new mongoose.Schema({
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
    default: 'trend-analysis'
  },
  account: {
    type: String,
    required: true,
    default: 'Samay Raina'
  }
}, { timestamps: true })

export default mongoose.model('LinkedinTrendSnapshot', linkedinTrendSnapshotSchema)
