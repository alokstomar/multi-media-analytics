/**
 * Diagnostic: Compare "Finance with Mozno" vs "Anuv Jain"
 * Views Over Time data flow — full comparison.
 *
 * Usage: node scripts/diagnose_views_timeline.mjs
 */

import 'dotenv/config'
import '../config/dns.js'   // apply DNS_RESOLVERS so SRV lookup works on localhost
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import mongoose from 'mongoose'

await mongoose.connect(process.env.MONGO_URI)
console.log('✅ MongoDB connected\n')

// ── Schemas (loose — read any field from DB) ─────────────────────────────
const channelSchema = new mongoose.Schema({}, { strict: false, collection: 'channels' })
const videoSchema   = new mongoose.Schema({}, { strict: false, collection: 'videos'   })
const Channel = mongoose.model('DiagChannel', channelSchema)
const Video   = mongoose.model('DiagVideo',   videoSchema)

// ── Helper: monthlyViewsBreakdown (mirrors analytics.js exactly) ──────────
function monthlyViewsBreakdown(videos) {
  if (!videos.length) return []
  const months = {}
  videos.forEach((v) => {
    const d = new Date(v.publishedAt)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    months[key] = (months[key] || 0) + v.views
  })
  return Object.entries(months)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, views]) => ({ month, views }))
}

// ── Investigate one channel ────────────────────────────────────────────────
async function investigate(label) {
  console.log('═'.repeat(70))
  console.log(`CHANNEL: ${label}`)
  console.log('═'.repeat(70))

  // Find channel document
  const channel = await Channel.findOne({ title: new RegExp(label, 'i') }).lean()
  if (!channel) {
    console.log(`❌ Channel not found in DB for label: "${label}"`)
    return null
  }

  const channelId = channel.channelId
  console.log(`channelId        : ${channelId}`)
  console.log(`title            : ${channel.title}`)
  console.log(`subscribers      : ${channel.subscribers}`)
  console.log(`totalViews       : ${channel.totalViews}`)
  console.log(`totalVideos      : ${channel.totalVideos}`)
  console.log(`workspaceId      : ${channel.workspaceId}`)
  console.log(`createdAt        : ${channel.createdAt}`)
  console.log(`updatedAt        : ${channel.updatedAt}`)
  console.log()

  // Fetch all stored videos
  const videos = await Video.find({ channelId }).sort({ publishedAt: -1 }).lean()

  console.log(`── Videos in DB ─────────────────────────────────────────────`)
  console.log(`Total stored videos : ${videos.length}`)

  if (videos.length === 0) {
    console.log('❌ No videos found in DB for this channel')
    return { channel, videos: [], monthlyViews: [] }
  }

  const sorted = [...videos].sort((a, b) => new Date(a.publishedAt) - new Date(b.publishedAt))
  const oldest = sorted[0]
  const newest = sorted[sorted.length - 1]

  console.log(`Oldest video     : "${oldest.title}" → publishedAt: ${oldest.publishedAt}`)
  console.log(`Newest video     : "${newest.title}" → publishedAt: ${newest.publishedAt}`)
  console.log()

  // Print all videos with publishedAt
  console.log(`── All ${videos.length} stored videos (sorted newest first) ────────`)
  sorted.reverse().forEach((v, i) => {
    const pub = v.publishedAt ? new Date(v.publishedAt).toISOString().slice(0, 10) : 'NO DATE'
    console.log(`  ${String(i+1).padStart(2)}. [${pub}] views=${String(v.views).padStart(8)}  "${v.title?.slice(0,60)}"`)
  })
  console.log()

  // Run the exact same aggregation as analytics.js
  const monthlyViews = monthlyViewsBreakdown(sorted.reverse()) // back to oldest-first

  console.log(`── monthlyViewsBreakdown() output (what goes into the chart) ─`)
  console.log(`Datapoints: ${monthlyViews.length}`)
  if (monthlyViews.length > 0) {
    console.log(`First month: ${monthlyViews[0].month}`)
    console.log(`Last month : ${monthlyViews[monthlyViews.length - 1].month}`)
    console.log()
    monthlyViews.forEach(m => {
      console.log(`  ${m.month}  →  ${m.views} views`)
    })
  }

  // Check for missing months
  const now = new Date()
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  if (monthlyViews.length > 0) {
    const lastMonth = monthlyViews[monthlyViews.length - 1].month
    console.log()
    if (lastMonth < currentYearMonth) {
      console.log(`⚠️  LAST DATA POINT (${lastMonth}) IS BEHIND CURRENT MONTH (${currentYearMonth})`)
      console.log(`    Gap: the chart stops at ${lastMonth} because the newest video`)
      console.log(`         in the DB was published in that month.`)
    } else {
      console.log(`✅  Data extends to current month (${currentYearMonth})`)
    }
  }

  console.log()
  return { channel, videos, monthlyViews }
}

const mozno = await investigate('Finance with Mozno')
const anuv  = await investigate('Anuv Jain')

// ── Side-by-side comparison ───────────────────────────────────────────────
console.log('═'.repeat(70))
console.log('COMPARISON SUMMARY')
console.log('═'.repeat(70))

function summarize(label, data) {
  if (!data) return
  const mv = data.monthlyViews
  console.log(`\n${label}:`)
  console.log(`  Videos in DB   : ${data.videos.length}`)
  console.log(`  Monthly points : ${mv.length}`)
  console.log(`  First month    : ${mv[0]?.month || 'N/A'}`)
  console.log(`  Last month     : ${mv[mv.length-1]?.month || 'N/A'}`)
  if (data.videos.length > 0) {
    const sorted = [...data.videos].sort((a,b) => new Date(a.publishedAt)-new Date(b.publishedAt))
    console.log(`  Oldest video   : ${sorted[0]?.publishedAt?.toString().slice(0,10) || 'N/A'}`)
    console.log(`  Newest video   : ${sorted[sorted.length-1]?.publishedAt?.toString().slice(0,10) || 'N/A'}`)
  }
}

summarize('Finance with Mozno', mozno)
summarize('Anuv Jain', anuv)

console.log('\n── Root Cause Check ─────────────────────────────────────────────')
const now = new Date()
const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
console.log(`Current month: ${currentYearMonth}`)

if (mozno && anuv) {
  const moznoLast = mozno.monthlyViews[mozno.monthlyViews.length - 1]?.month
  const anuvLast  = anuv.monthlyViews[anuv.monthlyViews.length - 1]?.month

  console.log(`Finance with Mozno last data: ${moznoLast || 'N/A'}`)
  console.log(`Anuv Jain last data         : ${anuvLast  || 'N/A'}`)

  if (moznoLast && moznoLast < currentYearMonth) {
    const moznoNewest = [...mozno.videos].sort((a,b) => new Date(b.publishedAt)-new Date(a.publishedAt))[0]
    console.log(`\n🔍 Finance with Mozno: newest stored video published: ${moznoNewest?.publishedAt?.toString().slice(0,10)}`)
    console.log(`   Title: "${moznoNewest?.title}"`)
    console.log(`   The chart stops at ${moznoLast} because that is when the most recent`)
    console.log(`   stored video was published. The DB only has ${mozno.videos.length} videos for this channel.`)
    console.log(`\n   fetchChannelVideos() fetches maxResults=20 by default.`)
    console.log(`   Finance with Mozno has ${mozno.channel.totalVideos} total videos per YouTube API.`)
  }
}

await mongoose.disconnect()
console.log('\n✅ Done')
