import mongoose from 'mongoose'

const workspaceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  logo: {
    type: String,
    default: '',
  },
  timezone: {
    type: String,
    default: 'UTC',
  },
  branding: {
    primaryColor: {
      type: String,
      default: '#4f46e5',
    },
    secondaryColor: {
      type: String,
      default: '#06b6d4',
    },
  },
  members: [
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      role: {
        type: String,
        enum: ['owner', 'admin', 'editor', 'viewer'],
        default: 'viewer',
      },
    }
  ],
  isDeleted: {
    type: Boolean,
    default: false,
    index: true,
  },
  deletedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
})

export default mongoose.model('Workspace', workspaceSchema)
