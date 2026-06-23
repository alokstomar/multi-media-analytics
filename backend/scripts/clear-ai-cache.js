// Wipe both cache layers for the test channels so the next call is cold.
// Run: node --env-file=.env scripts/clear-ai-cache.js
import mongoose from 'mongoose'
import { createHash } from 'crypto'

const MONGO_URI = process.env.MONGO_URI

const CHANNELS = [
  ['Mozno', 'UCfApvrRY2UpuyAClmDEA2EA'],
  ['MrBeast', 'UCX6OQ3DkcsbYNE6H8uQQuVA'],
]

function makeCacheKey(method, params) {
  return createHash('sha256').update(method + '::' + JSON.stringify(params)).digest('hex')
}

async function main() {
  await mongoose.connect(MONGO_URI)
  const ic = mongoose.connection.collection('intelligencecaches')
  const arc = mongoose.connection.collection('airesponsecaches')

  for (const [label, id] of CHANNELS) {
    const icRes = await ic.deleteMany({
      channelId: id,
      feature: { $in: ['video-ideas', 'shorts-ideas', 'strategist-tips', 'content-gaps', 'alerts-summary', 'openai:video-ideas', 'openai:shorts-ideas', 'openai:strategist-tips', 'openai:content-gaps', 'openai:alerts-summary'] },
    })
    const arcKeys = ['generateVideoIdeas', 'generateShortsIdeas', 'getStrategistTips', 'getContentGaps', 'summarizeAlerts']
      .map((m) => makeCacheKey(m, { channelId: id }))
    const arcRes = await arc.deleteMany({ cacheKey: { $in: arcKeys } })
    console.log(`${label} (${id}): IntelligenceCache deleted ${icRes.deletedCount}, AIResponseCache deleted ${arcRes.deletedCount}`)
  }

  await mongoose.disconnect()
  process.exit(0)
}

main().catch((err) => {
  console.error('clear-cache script crashed:', err)
  process.exit(1)
})
