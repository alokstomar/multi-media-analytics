import mongoose from 'mongoose'

const automationRuleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['daily', 'thread', 'repurpose', 'recycle'],
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
    default: '@samay_raina',
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

automationRuleSchema.index({ workspaceId: 1 })

export default mongoose.model('AutomationRule', automationRuleSchema)
