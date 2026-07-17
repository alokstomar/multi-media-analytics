/**
 * DIAGNOSTIC SCRIPT — test_full_add_account.mjs
 *
 * Simulates the full addAccount() controller path with a real
 * MongoDB write, bypassing HTTP auth, to find the exact failure.
 *
 * Run: node backend/scripts/test_full_add_account.mjs
 */

import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })

// Establish MongoDB connection
import mongoose from 'mongoose'
console.log('\n=== Connecting to MongoDB ===')
await mongoose.connect(process.env.MONGO_URI)
console.log('MongoDB connected')

import InstagramProfile from '../models/InstagramProfile.js'
import { providerFactory } from '../services/instagram/providerFactory.js'
import { analyticsService } from '../services/instagram/analyticsService.js'

const TEST_USERNAME = 'mrbeast'
// Use a real workspaceId from the DB — find the first one
import Workspace from '../models/Workspace.js'
const workspace = await Workspace.findOne({ isDeleted: false })
if (!workspace) {
  console.error('No workspace found in DB. Cannot test.')
  process.exit(1)
}
const workspaceId = workspace._id
console.log('Using workspaceId:', workspaceId)

// ── STEP 1: getProvider ────────────────────────────────────────────────
console.log('\n=== STEP 1: providerFactory.getProvider() ===')
let provider, providerName
try {
  provider = providerFactory.getProvider()
  providerName = providerFactory.getProviderLabel()
  console.log('Provider:', provider.constructor.name, '| Label:', providerName)
} catch (err) {
  console.error('FAILED at providerFactory.getProvider():', err.message)
  console.error(err.stack)
  process.exit(1)
}

// ── STEP 2: provider.getProfile ────────────────────────────────────────
console.log('\n=== STEP 2: provider.getProfile("mrbeast") ===')
let profileData
try {
  profileData = await provider.getProfile(TEST_USERNAME)
  console.log('Profile OK:', profileData.username, '| followers:', profileData.followers)
} catch (err) {
  console.error('FAILED at provider.getProfile():', err.message)
  console.error('  code:', err.code, '| status:', err.status)
  console.error(err.stack)
  process.exit(1)
}

// ── STEP 3: Check if already exists ────────────────────────────────────
console.log('\n=== STEP 3: Check InstagramProfile.findOne ===')
try {
  const existing = await InstagramProfile.findOne({ username: TEST_USERNAME, workspaceId })
  if (existing) {
    console.log('Profile already exists in DB — deletedAt:', existing.deletedAt)
    console.log('syncStatus:', existing.syncStatus)
    console.log('Test DONE — addAccount() would return existing and skip create.')
    await mongoose.disconnect()
    process.exit(0)
  } else {
    console.log('No existing profile — will test create.')
  }
} catch (err) {
  console.error('FAILED at InstagramProfile.findOne():', err.message)
  console.error(err.stack)
  process.exit(1)
}

// ── STEP 4: InstagramProfile.create ────────────────────────────────────
console.log('\n=== STEP 4: InstagramProfile.create ===')
try {
  const doc = {
    username: TEST_USERNAME,
    workspaceId,
    fullName: profileData.fullName,
    bio: profileData.bio,
    profilePic: profileData.profilePic,
    followers: profileData.followers,
    following: profileData.following,
    postsCount: profileData.postsCount,
    verified: profileData.verified,
    provider: providerName,
    providerVersion: 'v1',
    syncedAt: new Date(),
    syncStatus: 'syncing',
    rawPayload: profileData.rawPayload || {},
  }
  console.log('Document to insert:', JSON.stringify({ ...doc, rawPayload: '[omitted]' }, null, 2))
  const created = await InstagramProfile.create(doc)
  console.log('CREATE SUCCESS — _id:', created._id)

  // Clean up
  await InstagramProfile.deleteOne({ _id: created._id })
  console.log('Cleaned up test doc.')
} catch (err) {
  console.error('\nFAILED at InstagramProfile.create()!')
  console.error('  err.message:', err.message)
  console.error('  err.code:', err.code)
  console.error('  err.name:', err.name)
  if (err.errors) {
    console.error('  Validation errors:', JSON.stringify(err.errors, null, 2))
  }
  console.error(err.stack)
}

await mongoose.disconnect()
console.log('\nDone.')
