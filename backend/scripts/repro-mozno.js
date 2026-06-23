// Reproduction: call generateVideoIdeas for MrBeast vs Finance with Mozno
// using their real Channel + Video docs from Mongo.
//
// Run from backend/ with:
//   node --env-file=.env scripts/repro-mozno.js
//
import mongoose from 'mongoose'
import { OpenAIProvider } from '../services/ai/openaiProvider.js'
import { AIProviderError } from '../services/ai/AIProviderError.js'

const MONGO_URI = process.env.MONGO_URI
const MOZNO_ID = 'UCfApvrRY2UpuyAClmDEA2EA'
const MRBEAST_ID = 'UCX6OQ3DkcsbYNE6H8uQQuVA'

async function loadContext(channelId) {
  const Channel = mongoose.model('Channel')
  const Video = mongoose.model('Video')
  // Pick any one of the (possibly multiple) workspace copies.
  const channel = await Channel.findOne({ channelId }).lean()
  const videos = await Video.find({ channelId }).sort({ publishedAt: -1 }).limit(20).lean()
  return { channel, videos }
}

function summarizeCtx(label, ctx) {
  const c = ctx.channel || {}
  console.log(`\n[${label}] context summary:`)
  console.log(`  channelId     : ${ctx.channelId}`)
  console.log(`  channel.title : ${JSON.stringify(c.title)}`)
  console.log(`  channel.handle: ${JSON.stringify(c.handle)}`)
  console.log(`  channel.desc  : ${JSON.stringify((c.description || '').slice(0, 80))}... (len=${(c.description || '').length})`)
  console.log(`  channel.subs  : ${c.subscribers}`)
  console.log(`  channel.totalV: ${c.totalVideos}`)
  console.log(`  channel.banner: ${JSON.stringify(c.banner)}`)
  console.log(`  videos.length : ${ctx.videos.length}`)
  if (ctx.videos[0]) {
    const v = ctx.videos[0]
    console.log(`  videos[0]     : title=${JSON.stringify(v.title)?.slice(0, 60)} views=${v.views} likes=${v.likes} comments=${v.comments}`)
  }
}

async function tryGenerate(provider, label, ctx) {
  console.log(`\n=== Calling generateVideoIdeas for ${label} ===`)
  const t0 = Date.now()
  try {
    const out = await provider.generateVideoIdeas(
      { channelId: ctx.channelId, channel: ctx.channel, videos: ctx.videos },
      { channelId: ctx.channelId, feature: 'video-ideas' },
    )
    const ms = Date.now() - t0
    console.log(`  ✓ SUCCESS in ${ms}ms — ${out?.ideas?.length} ideas`)
    console.log(`  first idea keys: ${Object.keys(out?.ideas?.[0] || {}).join(', ')}`)
    console.log(`  first idea sample:`, JSON.stringify(out?.ideas?.[0], null, 2).slice(0, 500))
    return { ok: true, ms, out }
  } catch (err) {
    const ms = Date.now() - t0
    console.log(`  ✗ FAILED in ${ms}ms`)
    console.log(`  err.name    : ${err?.name}`)
    console.log(`  err.message : ${err?.message}`)
    if (err instanceof AIProviderError) {
      console.log(`  err.provider : ${err.provider}`)
      console.log(`  err.method   : ${err.method}`)
      console.log(`  err.cause    : ${err.cause?.message}`)
      console.log(`  err.cause.stack (first 3 frames):`)
      console.log((err.cause?.stack || '').split('\n').slice(0, 4).join('\n'))
    } else {
      console.log(`  err.stack (first 3 frames):`)
      console.log((err?.stack || '').split('\n').slice(0, 4).join('\n'))
    }
    return { ok: false, ms, err }
  }
}

async function main() {
  if (!MONGO_URI) {
    console.error('MONGO_URI not set')
    process.exit(1)
  }
  if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_BASE_URL) {
    console.error('OPENAI_API_KEY / OPENAI_BASE_URL must be set')
    process.exit(1)
  }

  console.log('Connecting to Mongo...')
  await mongoose.connect(MONGO_URI)
  // Load Channel + Video models from the existing schemas.
  await import('../models/Channel.js')
  await import('../models/Video.js')

  console.log('Instantiating OpenAIProvider...')
  const provider = new OpenAIProvider(process.env.OPENAI_API_KEY)

  // Load contexts
  const moznoChannel = await loadContext(MOZNO_ID)
  const mrbeastChannel = await loadContext(MRBEAST_ID)

  summarizeCtx('Mozno', { channelId: MOZNO_ID, ...moznoChannel })
  summarizeCtx('MrBeast', { channelId: MRBEAST_ID, ...mrbeastChannel })

  // Try Mozno first (the failing one)
  const moznoResult = await tryGenerate(provider, 'Mozno', { channelId: MOZNO_ID, ...moznoChannel })

  // Then MrBeast (the working one) for comparison
  const mrbeastResult = await tryGenerate(provider, 'MrBeast', { channelId: MRBEAST_ID, ...mrbeastChannel })

  console.log('\n=== SUMMARY ===')
  console.log(`  Mozno  : ${moznoResult.ok ? 'SUCCESS' : 'FAILED'} (${moznoResult.ms}ms)`)
  console.log(`  MrBeast: ${mrbeastResult.ok ? 'SUCCESS' : 'FAILED'} (${mrbeastResult.ms}ms)`)

  await mongoose.disconnect()
  process.exit(0)
}

main().catch((err) => {
  console.error('Repro script crashed:', err)
  process.exit(1)
})
