import * as schedulerService from '../services/schedulerService.js'

/**
 * POST /api/scheduler/post
 * Schedule a new post for future publishing.
 */
export async function schedulePost(req, res, next) {
  try {
    const { platform, accountId, content, media, scheduledFor, createdBy, postId } = req.body

    if (!platform) {
      return res.status(400).json({ success: false, error: 'platform is required' })
    }
    if (!scheduledFor) {
      return res.status(400).json({ success: false, error: 'scheduledFor is required' })
    }

    const result = await schedulerService.schedulePost({
      platform,
      accountId,
      content,
      media,
      scheduledFor,
      createdBy,
      postId,
      workspaceId: req.workspaceId,
    })

    res.status(201).json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/scheduler/cancel
 * Cancel a scheduled post.
 */
export async function cancelScheduledPost(req, res, next) {
  try {
    const { jobId } = req.body

    if (!jobId) {
      return res.status(400).json({ success: false, error: 'jobId is required' })
    }

    const result = await schedulerService.cancelScheduledPost(jobId, req.workspaceId)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/scheduler/reschedule
 * Reschedule a post to a new time.
 */
export async function reschedulePost(req, res, next) {
  try {
    const { jobId, scheduledFor } = req.body

    if (!jobId) {
      return res.status(400).json({ success: false, error: 'jobId is required' })
    }
    if (!scheduledFor) {
      return res.status(400).json({ success: false, error: 'scheduledFor is required' })
    }

    const result = await schedulerService.reschedulePost(jobId, scheduledFor, req.workspaceId)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/scheduler/metrics
 * Get queue health and performance metrics.
 */
export async function getMetrics(req, res, next) {
  try {
    const metrics = await schedulerService.getQueueMetrics(req.workspaceId)
    res.json({ success: true, data: metrics })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/scheduler/jobs
 * List scheduled jobs with optional filters.
 */
export async function getJobs(req, res, next) {
  try {
    const { status, platform, limit } = req.query
    const jobs = await schedulerService.getJobs({
      status,
      platform,
      limit,
      workspaceId: req.workspaceId,
    })
    res.json({ success: true, data: jobs })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/scheduler/retry
 * Retry a failed job.
 */
export async function retryJob(req, res, next) {
  try {
    const { jobId } = req.body

    if (!jobId) {
      return res.status(400).json({ success: false, error: 'jobId is required' })
    }

    const result = await schedulerService.retryFailedJob(jobId, req.workspaceId)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}
