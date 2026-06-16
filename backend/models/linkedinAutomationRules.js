import mongoose from 'mongoose'

const linkedinAutomationRuleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['recurring', 'leadership', 'company', 'blog', 'youtube'],
    required: true,
  },
  trigger: {
    type: String,
    required: true,
  },
  frequency: {
    type: String,
    required: true,
  },
  targetAccount: {
    type: String,
    required: true,
    default: 'Samay Raina',
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active',
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
  }
}, { timestamps: true })

linkedinAutomationRuleSchema.index({ workspaceId: 1 })

export default mongoose.model('LinkedinAutomationRule', linkedinAutomationRuleSchema)
