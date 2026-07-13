import mongoose from 'mongoose'
import dotenv from 'dotenv'

dotenv.config()

const MONGO_URI = process.env.MONGO_URI
const MOZNO_ID = 'UCfApvrRY2UpuyAClmDEA2EA'
const WORKING_ID = 'UCcnCnzZ2x-fdYXfml5nOJpA' // Simran Tomar vlog

async function main() {
  await mongoose.connect(MONGO_URI)
  await import('../models/Channel.js')
  await import('../models/Video.js')
  await import('../models/CreatorStyleProfile.js')
  await import('../models/ScriptWorkspace.js')

  const Channel = mongoose.model('Channel')
  const Video = mongoose.model('Video')
  const CreatorStyleProfile = mongoose.model('CreatorStyleProfile')
  const ScriptWorkspace = mongoose.model('ScriptWorkspace')

  const { fetchVideoDescriptions } = await import('../services/youtubeService.js')

  async function getDiagnostics(channelId) {
    const channel = await Channel.findOne({ channelId }).lean()
    const videos = await Video.find({ channelId }).sort({ publishedAt: -1 }).limit(15).lean()
    const profileDoc = await CreatorStyleProfile.findOne({ channelId }).lean()
    const workspaces = await ScriptWorkspace.find({ channelId }).lean()

    const videoIds = videos.map(v => v.videoId).filter(Boolean)
    const descData = await fetchVideoDescriptions(videoIds)
    const descMap = new Map(descData.map(d => [d.videoId, d.description]))

    const transcriptLines = []
    for (const v of videos) {
      if (v.transcript) {
        transcriptLines.push(`[TRANSCRIPT] "${v.title}":\n${v.transcript.substring(0, 300)}`)
      }
    }

    const descriptionLines = []
    for (const v of videos) {
      const desc = descMap.get(v.videoId)
      if (desc) {
        descriptionLines.push(`[DESC] "${v.title}":\n${desc.split(/\n{2,}/)[0].substring(0, 200)}`)
      }
    }

    const titleLines = videos.map((v, i) => `  ${i + 1}. "${v.title}"`)

    const corpusSections = []
    if (transcriptLines.length) corpusSections.push(transcriptLines.join('\n'))
    if (descriptionLines.length) corpusSections.push(descriptionLines.join('\n'))
    if (titleLines.length) corpusSections.push(titleLines.join('\n'))
    const contentCorpus = corpusSections.join('\n\n')

    // Find first script workspace with working fullScript
    const workingWS = workspaces.find(w => w.working?.fullScript?.trim()?.length > 100)
    const first500Words = workingWS ? workingWS.working.fullScript.split(/\s+/).slice(0, 150).join(' ') + '...' : '(none)'

    return {
      channelTitle: channel?.title || '(unknown)',
      totalVideosAnalyzed: videos.length,
      titles: videos.map(v => v.title),
      descriptions: videos.map(v => descMap.get(v.videoId) || '(none)'),
      transcriptCount: videos.filter(v => v.transcript).length,
      existingScriptsCount: workspaces.length,
      existingScriptsUsed: workspaces.map(w => w.working?.title),
      contentCorpusLength: contentCorpus.length,
      contentCorpusPreview: contentCorpus.substring(0, 600) + '...',
      profile: profileDoc?.profile || {},
      scriptWorkspace: workingWS ? {
        title: workingWS.working.title,
        hook: workingWS.working.hook,
        cta: workingWS.working.cta,
        first500Words
      } : null
    }
  }

  console.log('--- Collecting Mozno ---')
  const mozno = await getDiagnostics(MOZNO_ID)
  
  console.log('--- Collecting Simran ---')
  const simran = await getDiagnostics(WORKING_ID)

  console.log('\n=======================================')
  console.log('COMPARATIVE DIAGNOSTIC DUMP')
  console.log('=======================================')
  console.log(JSON.stringify({ mozno, simran }, null, 2))

  await mongoose.disconnect()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
