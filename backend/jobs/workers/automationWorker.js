import { Worker } from 'bullmq'
import { getRedisClient } from '../../config/redis.js'
import mongoose from 'mongoose'

let worker = null

/**
 * Supported automation job types:
 *   - automation         (generic rule execution)
 *   - generate-linkedin-post
 *   - generate-thread
 *   - generate-content-ideas
 *   - repurpose-content
 */
const AI_JOB_HANDLERS = {
  'generate-linkedin-post': async (job) => {
    console.log(`[AutomationWorker] AI: Generating LinkedIn post for rule ${job.data.ruleId}`)
    await new Promise(r => setTimeout(r, 800))
    return { type: 'generate-linkedin-post', simulated: true, generatedAt: new Date().toISOString() }
  },
  'generate-thread': async (job) => {
    console.log(`[AutomationWorker] AI: Generating thread for rule ${job.data.ruleId}`)
    await new Promise(r => setTimeout(r, 800))
    return { type: 'generate-thread', simulated: true, generatedAt: new Date().toISOString() }
  },
  'generate-content-ideas': async (job) => {
    console.log(`[AutomationWorker] AI: Generating content ideas for rule ${job.data.ruleId}`)
    await new Promise(r => setTimeout(r, 600))
    return { type: 'generate-content-ideas', simulated: true, generatedAt: new Date().toISOString() }
  },
  'repurpose-content': async (job) => {
    console.log(`[AutomationWorker] AI: Repurposing content for rule ${job.data.ruleId}`)
    await new Promise(r => setTimeout(r, 1000))
    return { type: 'repurpose-content', simulated: true, generatedAt: new Date().toISOString() }
  },
}

/**
 * Start the automation worker.
 *
 * Processes jobs from the 'automation' queue:
 *   - Rule-based automation (weekly LinkedIn, daily threads, etc.)
 *   - AI job types (generate-linkedin-post, generate-thread, etc.)
 *   - Content repurposing workflows
 *
 * All handlers are mock implementations for now — prepares infrastructure
 * for OAuth and real AI integration later.
 */
export function startAutomationWorker() {
  const connection = getRedisClient()

  worker = new Worker('automation', async (job) => {
    const { ruleId, platform, action, jobType, scheduledJobId } = job.data
    const startTime = Date.now()
    console.log(`[AutomationWorker] Processing rule ${ruleId} for ${platform} (type: ${jobType || action || 'automation'})`)

    // Update ScheduledJob status → active
    let scheduledJobRecord
    if (scheduledJobId) {
      const ScheduledJob = mongoose.model('ScheduledJob')
      scheduledJobRecord = await ScheduledJob.findById(scheduledJobId)
      if (scheduledJobRecord) {
        scheduledJobRecord.status = 'active'
        scheduledJobRecord.executedAt = new Date()
        await scheduledJobRecord.save()
      }
    }

    // Route to AI handler or generic automation
    const handlerKey = jobType || action
    const aiHandler = AI_JOB_HANDLERS[handlerKey]
    let result

    if (aiHandler) {
      result = await aiHandler(job)
    } else {
      // Generic automation rule execution (mock)
      console.log(`[AutomationWorker] Executing generic automation rule ${ruleId}`)
      await new Promise(r => setTimeout(r, 1000))
      result = { type: 'generic-automation', simulated: true, executedAt: new Date().toISOString() }
    }

    const executionDurationMs = Date.now() - startTime
    console.log(`[AutomationWorker] Rule ${ruleId} completed in ${executionDurationMs}ms`)

    // Update ScheduledJob → completed
    if (scheduledJobRecord) {
      scheduledJobRecord.status = 'completed'
      scheduledJobRecord.completedAt = new Date()
      scheduledJobRecord.executionDurationMs = executionDurationMs
      await scheduledJobRecord.save()
    }

    return result
  }, { connection })

  worker.on('completed', (job) => {
    console.log(`[AutomationWorker] Job ${job.id} completed.`)
  })

  worker.on('failed', async (job, err) => {
    if (!job) return
    console.error(`[AutomationWorker] Job ${job.id} failed: ${err.message}`)

    const { scheduledJobId } = job.data
    if (scheduledJobId) {
      try {
        const ScheduledJob = mongoose.model('ScheduledJob')
        const sjRecord = await ScheduledJob.findById(scheduledJobId)
        if (sjRecord) {
          sjRecord.status = 'failed'
          sjRecord.error = err.message
          sjRecord.stackTrace = err.stack || ''
          sjRecord.retries = job.attemptsMade
          await sjRecord.save()
        }
      } catch (updateErr) {
        console.error(`[AutomationWorker] Error updating ScheduledJob: ${updateErr.message}`)
      }
    }
  })

  console.log('[AutomationWorker] Started.')
  return worker
}

/**
 * Gracefully close the automation worker.
 */
export async function closeAutomationWorker() {
  if (worker) {
    await worker.close()
    worker = null
  }
}
