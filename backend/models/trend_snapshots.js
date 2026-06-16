import mongoose from 'mongoose'

const trendSnapshotSchema = new mongoose.Schema({
  prompt: {
    type: String,
    default: 'Fetch X trending topics snapshots',
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

export default mongoose.model('TrendSnapshot', trendSnapshotSchema)
