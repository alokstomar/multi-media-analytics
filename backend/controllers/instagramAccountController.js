import InstagramProfile from '../models/InstagramProfile.js'
import { analyticsService } from '../services/instagram/analyticsService.js'
import { AppError } from '../utils/errorHandler.js'

const STALENESS_MS = 24 * 60 * 60 * 1000

function normalizeUsername(raw) {
  if (typeof raw !== 'string') return ''
  return raw.trim().replace(/^@+/, '').toLowerCase()
}

function isStale(profile) {
  if (!profile?.syncedAt) return true
  return Date.now() - new Date(profile.syncedAt).getTime() > STALENESS_MS
}

async function runBackgroundSync(username, workspaceId) {
  try {
    await analyticsService.syncAll(username, workspaceId)
    await InstagramProfile.findOneAndUpdate(
      { username, workspaceId },
      { syncStatus: 'ready', syncError: '' }
    )
    console.log(`[InstagramAccounts] background sync ready: @${username}`)
  } catch (err) {
    console.error(`[InstagramAccounts] background sync failed for @${username}:`, err.message)
    await InstagramProfile.findOneAndUpdate(
      { username, workspaceId },
      { syncStatus: 'error', syncError: err.message || 'Sync failed' }
    )
  }
}

export async function addAccount(req, res, next) {
  try {
    const username = normalizeUsername(req.params.username)
    if (!username) throw new AppError('Username is required', 400)

    const workspaceId = req.workspaceId
    const existing = await InstagramProfile.findOne({ username, workspaceId })

    if (existing && !existing.deletedAt) {
      return res.json({ success: true, data: existing })
    }

    if (existing && existing.deletedAt) {
      const needsSync = isStale(existing)
      const updated = await InstagramProfile.findOneAndUpdate(
        { username, workspaceId },
        {
          deletedAt: null,
          syncStatus: needsSync ? 'syncing' : existing.syncStatus === 'error' ? 'syncing' : existing.syncStatus,
          syncError: '',
        },
        { new: true }
      )
      if (needsSync || updated.syncStatus === 'syncing') {
        setImmediate(() => runBackgroundSync(username, workspaceId))
      }
      return res.json({ success: true, data: updated })
    }

    const created = await InstagramProfile.create({
      username,
      workspaceId,
      syncStatus: 'syncing',
    })
    setImmediate(() => runBackgroundSync(username, workspaceId))
    return res.json({ success: true, data: created })
  } catch (err) {
    next(err)
  }
}

export async function listAccounts(req, res, next) {
  try {
    const accounts = await InstagramProfile.find({
      workspaceId: req.workspaceId,
      deletedAt: null,
    }).sort({ createdAt: -1 })
    res.json({ success: true, data: accounts })
  } catch (err) {
    next(err)
  }
}

export async function deleteAccount(req, res, next) {
  try {
    const username = normalizeUsername(req.params.username)
    if (!username) throw new AppError('Username is required', 400)

    const updated = await InstagramProfile.findOneAndUpdate(
      { username, workspaceId: req.workspaceId },
      { deletedAt: new Date() },
      { new: true }
    )
    if (!updated) throw new AppError('Account not found', 404)

    res.json({ success: true, data: { username, deletedAt: updated.deletedAt } })
  } catch (err) {
    next(err)
  }
}

export async function syncAccount(req, res, next) {
  try {
    const username = normalizeUsername(req.params.username)
    if (!username) throw new AppError('Username is required', 400)

    await InstagramProfile.findOneAndUpdate(
      { username, workspaceId: req.workspaceId },
      { syncStatus: 'syncing', syncError: '' }
    )

    try {
      const result = await analyticsService.syncAll(username, req.workspaceId)
      await InstagramProfile.findOneAndUpdate(
        { username, workspaceId: req.workspaceId },
        { syncStatus: 'ready', syncError: '' }
      )
      res.json({ success: true, data: result })
    } catch (err) {
      await InstagramProfile.findOneAndUpdate(
        { username, workspaceId: req.workspaceId },
        { syncStatus: 'error', syncError: err.message || 'Sync failed' }
      )
      throw err
    }
  } catch (err) {
    next(err)
  }
}

export async function getAccountStatus(req, res, next) {
  try {
    const username = normalizeUsername(req.params.username)
    if (!username) throw new AppError('Username is required', 400)

    const profile = await InstagramProfile.findOne(
      { username, workspaceId: req.workspaceId },
      { syncStatus: 1, syncError: 1, syncedAt: 1, deletedAt: 1 }
    )
    if (!profile) throw new AppError('Account not found', 404)

    res.json({
      success: true,
      data: {
        username,
        syncStatus: profile.syncStatus,
        syncError: profile.syncError,
        syncedAt: profile.syncedAt,
      },
    })
  } catch (err) {
    next(err)
  }
}
