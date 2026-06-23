// Inspect IntelligenceCache + AIResponseCache for Mozno vs MrBeast
// Run from backend/ with: node --env-file=.env scripts/inspect-cache.js
import mongoose from 'mongoose'
import { createHash } from 'crypto'

const MONGO_URI = process.env.MONGO_URI
const MOZNO_ID = 'UCfApvrRY2UpuyAClmDEA2EA'
const MRBEAST_ID = 'UCX6OQ3DkcsbYNE6H8uQQuVA'

function makeCacheKey(method, params) {
  const raw = method + '::' + JSON.stringify(params)
  return createHash('sha256').update(raw).digest('hex')
}

async function main() {
  await mongoose.connect(MONGO_URI)
  const IntelligenceCache = mongoose.connection.collection('intelligencecaches')
  const AIResponseCache = mongoose.connection.collection('airesponsecaches')

  for (const [label, channelId] of [['Mozno', MOZNO_ID], ['MrBeast', MRBEAST_ID]]) {
    console.log(`\n=== IntelligenceCache for ${label} (${channelId}) ===`)
    const docs = await IntelligenceCache.find({ channelId }).toArray()
    console.log(`  found ${docs.length} entries`)
    for (const d of docs) {
      console.log(`  - feature=${d.feature}, expires=${d.expiresAt?.toISOString}, resultKeys=${Object.keys(d.result || {}).join(',')}, resultCount=${Array.isArray(d.result?.ideas) ? d.result.ideas.length : Array.isArray(d.result?.tips) ? d.result.tips.length : Array.isArray(d.result?.gaps) ? d.result.gaps.length : 'n/a'}`)
    }

    console.log(`\n=== AIResponseCache for ${label} (provider-level cache) ===`)
    for (const method of ['generateVideoIdeas', 'generateShortsIdeas', 'getStrategistTips', 'getContentGaps']) {
      const key = makeCacheKey(method, { channelId })
      const doc = await AIResponseCache.findOne({ cacheKey: key })
      console.log(`  ${method}: ${doc ? `HIT (expires ${doc.expiresAt?.toISOString}, response keys: ${Object.keys(doc.response || {}).join(',')})` : 'miss'}`)
    }
  }

  await mongoose.disconnect()
  process.exit(0)
}

main().catch((err) => {
  console.error('inspect script crashed:', err)
  process.exit(1)
})
