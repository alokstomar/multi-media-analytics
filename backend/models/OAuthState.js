import mongoose from 'mongoose'

const oauthStateSchema = new mongoose.Schema({
  state: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  codeVerifier: {
    type: String,
    required: false, // Optional, since some providers or flows do not enforce PKCE
  },
  provider: {
    type: String,
    required: true,
    enum: ['twitter', 'linkedin', 'instagram'],
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 }, // Dynamic TTL index: MongoDB will delete documents when current time >= expiresAt
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: false,
  },
})

export default mongoose.model('OAuthState', oauthStateSchema)
