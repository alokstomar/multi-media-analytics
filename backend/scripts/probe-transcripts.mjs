/**
 * Probe script for the Speech Engine Round 2 transcript pipeline.
 * Verifies that:
 *   1. `youtube-transcript` package loads
 *   2. fetchTranscript() returns real captions for a known video
 *   3. ensureTranscriptsForVideos() persists transcripts to Video docs
 *   4. Video.find().lean() returns the populated transcript field
 *
 * Usage:
 *   node scripts/probe-transcripts.mjs <channelId> [videoCount]
 *
 * If no channelId given, uses a default FinanceWithMozno test channel
 * (purely for engineering verification — no creator-specific logic
 * lives in the production code path).
 */

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import mongoose from 'mongoose'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function main() {
  const channelId = process.argv[2] || 'UCaleoOaWXQ6BzJmPGKsIXXQ' // fallback only
  const videoCount = Number(process.argv[3]) || 5

  console.log('\n╔══════════════════════════════════════════════════════════╗')
  console.log('║       Speech Engine Round 2 — Transcript Probe            ║')
  console.log('╚══════════════════════════════════════════════════════════╝')
  console.log(`Channel ID : ${channelId}`)
  console.log(`Video count: ${videoCount}\n`)

  const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/multi-channel'
  console.log(`Connecting to MongoDB: ${MONGO_URI.replace(/\/\/[^@]+@/, '//***:***@')}`)
  await mongoose.connect(MONGO_URI)
  console.log('Connected.\n')

  await import('../models/Video.js')
  const Video = mongoose.model('Video')
  const { fetchTranscript, ensureTranscriptsForVideos } = await import('../services/transcriptService.js')

  // ── Step 1: load videos from Mongo ────────────────────────────────────
  const videos = await Video.find({ channelId })
    .sort({ publishedAt: -1 })
    .limit(videoCount)
    .lean()
  console.log(`Found ${videos.length} videos in MongoDB for channel.`)
  if (videos.length === 0) {
    console.log('No videos found — connect the channel first via the app.')
    return
  }

  console.log('\n── Videos before fetch ──')
  for (const v of videos) {
    console.log(`  ${v.videoId}  hasTranscript=${Boolean(v.transcript)}  fetchedAt=${v.transcriptFetchedAt?.toISOString?.() || 'null'}`)
  }

  // ── Step 2: ensure transcripts (cold) ────────────────────────────────
  console.log('\n── Calling ensureTranscriptsForVideos (cold) ──')
  const stats = await ensureTranscriptsForVideos(videos, { concurrency: 3 })
  console.log('Stats:', stats)

  // ── Step 3: re-fetch from Mongo to confirm persistence ───────────────
  const videoIds = videos.map((v) => v.videoId)
  const refreshed = await Video.find({ videoId: { $in: videoIds } }).lean()
  console.log('\n── Videos after fetch ──')
  for (const v of refreshed) {
    const preview = (v.transcript || '').slice(0, 200).replace(/\s+/g, ' ')
    console.log(`\n  ${v.videoId}  source=${v.transcriptSource || 'null'}  length=${(v.transcript || '').length}`)
    console.log(`    preview: "${preview}${(v.transcript || '').length > 200 ? '...' : ''}"`)
  }

  // ── Step 4: single-video direct fetch (sanity) ───────────────────────
  if (videos[0]) {
    console.log('\n── Direct fetchTranscript sanity check ──')
    try {
      const result = await fetchTranscript(videos[0].videoId)
      if (!result) {
        console.log(`  ${videos[0].videoId} → no captions available (returned null)`)
      } else {
        console.log(`  ${videos[0].videoId} → source=${result.source}, length=${result.transcript.length}`)
      }
    } catch (err) {
      console.log(`  ${videos[0].videoId} → ERROR: ${err.message}`)
    }
  }

  console.log('\n✓ Probe complete.\n')
}

main()
  .catch((err) => {
    console.error('\n✗ Probe failed:', err)
    process.exitCode = 1
  })
  .finally(() => mongoose.disconnect())
