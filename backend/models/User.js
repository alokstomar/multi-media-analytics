import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  password: {
    type: String,
    required: true,
  },
  // Legacy single-field name — kept for backward compatibility with existing components
  name: {
    type: String,
    required: true,
    trim: true,
  },

  // ── Profile fields ──────────────────────────────────────────────────────
  firstName: {
    type: String,
    trim: true,
    default: '',
  },
  lastName: {
    type: String,
    trim: true,
    default: '',
  },
  phone: {
    type: String,
    trim: true,
    default: '',
  },
  location: {
    type: String,
    trim: true,
    default: '',
  },
  organization: {
    type: String,
    trim: true,
    default: '',
  },
  bio: {
    type: String,
    trim: true,
    default: '',
  },
  // MVP: stored as base64 data URL in MongoDB.
  // Future: migrate to Cloudinary/S3 URL without changing frontend APIs.
  avatar: {
    type: String,
    default: '',
  },
  // ────────────────────────────────────────────────────────────────────────

  isVerified: {
    type: Boolean,
    default: false,
  },
  verificationToken: {
    type: String,
    default: null,
  },
  verificationExpiresAt: {
    type: Date,
    default: null,
  },
  resetPasswordToken: {
    type: String,
    default: null,
  },
  resetPasswordExpires: {
    type: Date,
    default: null,
  },
  activeWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    default: null,
  },
  lastLoginAt: {
    type: Date,
    default: null,
  },
  lastActiveAt: {
    type: Date,
    default: null,
  },
  passwordChangedAt: {
    type: Date,
    default: null,
  },
  activeSessions: [{
    sessionId: {
      type: String,
      required: true,
    },
    browser: {
      type: String,
      default: '',
    },
    os: {
      type: String,
      default: '',
    },
    device: {
      type: String,
      default: '',
    },
    ipAddress: {
      type: String,
      default: '',
    },
    location: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
  }],
}, {
  timestamps: true,
})

// Index for fast session lookup
userSchema.index({ 'activeSessions.sessionId': 1 })

// ── Pre-save: password hashing & tracking ─────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  
  // Set passwordChangedAt if this is an existing user updating their password
  if (!this.isNew) {
    this.passwordChangedAt = new Date(Date.now() - 1000)
  }

  try {
    const salt = await bcrypt.genSalt(10)
    this.password = await bcrypt.hash(this.password, salt)
    next()
  } catch (err) {
    next(err)
  }
})

// ── Pre-save: firstName / lastName auto-migration & name sync ─────────────
//
// Three cases handled:
//  1. New user: firstName/lastName empty → derive from name (e.g. "Alok Tomar" → "Alok", "Tomar")
//  2. Existing legacy user on first save: same derivation as above
//  3. Profile update: firstName/lastName changed → rebuild name for backward compat
//
userSchema.pre('save', function (next) {
  // If firstName/lastName are both empty, derive them from the legacy name field
  if ((!this.firstName || !this.lastName) && this.name) {
    const parts = this.name.trim().split(/\s+/)
    if (!this.firstName) this.firstName = parts[0] || ''
    if (!this.lastName)  this.lastName  = parts.slice(1).join(' ')
  }

  // Keep legacy name field in sync so existing components that use user.name still work
  if (this.firstName || this.lastName) {
    this.name = `${this.firstName} ${this.lastName}`.trim()
  }

  next()
})

// Instance method to check password validity
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password)
}

export default mongoose.model('User', userSchema)
