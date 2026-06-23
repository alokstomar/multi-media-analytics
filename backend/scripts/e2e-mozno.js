// E2E verification: hit the real HTTP endpoint with a freshly minted JWT
// for whichever workspace Mozno is actually attached to.
//
// Run: node --env-file=.env scripts/e2e-mozno.js
import mongoose from 'mongoose'
import jwt from 'jsonwebtoken'

const MONGO_URI = process.env.MONGO_URI
const JWT_SECRET = process.env.JWT_SECRET || 'creator-analytics-secret-jwt-key-2026'
const MOZNO_ID = 'UCfApvrRY2UpuyAClmDEA2EA'

async function main() {
  await mongoose.connect(MONGO_URI)
  await import('../models/User.js')
  await import('../models/Workspace.js')
  await import('../models/Channel.js')

  const Channel = mongoose.model('Channel')
  const Workspace = mongoose.model('Workspace')
  const User = mongoose.model('User')

  // Find a workspace that has Mozno, and a user who is a member.
  const moznoChannel = await Channel.findOne({ channelId: MOZNO_ID }).lean()
  if (!moznoChannel) throw new Error('Mozno channel not in DB')
  const workspaceId = moznoChannel.workspaceId
  console.log(`Mozno is in workspace: ${workspaceId}`)

  const workspace = await Workspace.findById(workspaceId).lean()
  if (!workspace?.members?.length) throw new Error('no members in that workspace')
  const memberUserId = workspace.members[0].userId
  const user = await User.findById(memberUserId).lean()
  if (!user) throw new Error(`user ${memberUserId} not found`)
  console.log(`Using user: ${user.email}`)

  const token = jwt.sign({ userId: user._id.toString() }, JWT_SECRET, { expiresIn: '1h' })

  const t0 = Date.now()
  const res = await fetch(`http://localhost:5000/api/intelligence/${MOZNO_ID}/video-ideas`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-workspace-id': workspaceId.toString(),
    },
    body: '{}',
  })
  const coldMs = Date.now() - t0
  const text = await res.text()
  let parsed
  try { parsed = JSON.parse(text) } catch { parsed = { _raw: text.slice(0, 300) } }

  console.log(`\n=== Cold call ===`)
  console.log(`HTTP ${res.status} in ${coldMs}ms`)
  console.log(`X-AI-Provider: ${res.headers.get('x-ai-provider')}`)
  console.log(`X-AI-Status: ${res.headers.get('x-ai-status')}`)
  console.log(`success: ${parsed?.success}`)
  console.log(`aiUnavailable: ${parsed?.aiUnavailable ?? 'n/a'}`)
  console.log(`ideas count: ${parsed?.data?.ideas?.length ?? 'n/a'}`)
  if (parsed?.error) console.log(`error: ${parsed.error}`)
  if (parsed?.data?.ideas?.[0]) {
    console.log(`first idea: "${parsed.data.ideas[0].title}"`)
  }

  // Warm call — should be cache hit < 1s
  const t1 = Date.now()
  const res2 = await fetch(`http://localhost:5000/api/intelligence/${MOZNO_ID}/video-ideas`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-workspace-id': workspaceId.toString(),
    },
    body: '{}',
  })
  const warmMs = Date.now() - t1
  console.log(`\n=== Warm call ===`)
  console.log(`HTTP ${res2.status} in ${warmMs}ms`)

  await mongoose.disconnect()
  process.exit(res.status >= 200 && res.status < 300 ? 0 : 1)
}

main().catch((err) => {
  console.error('E2E script crashed:', err)
  process.exit(1)
})
