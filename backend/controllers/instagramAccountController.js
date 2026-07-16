import InstagramProfile from '../models/InstagramProfile.js'
import { analyticsService } from '../services/instagram/analyticsService.js'
import { providerFactory } from '../services/instagram/providerFactory.js'
import { AppError } from '../utils/errorHandler.js'

function normalizeUsername(raw) {
  if (typeof raw !== 'string') return ''
  return raw.trim().replace(/^@+/, '').toLowerCase()
}

async function runBackgroundSync(username, workspaceId) {
  try {
    const result = await analyticsService.syncAll(username, workspaceId)
    await InstagramProfile.findOneAndUpdate(
      { username, workspaceId },
      { syncStatus: 'ready', syncError: '' }
    )
    console.log(`[InstagramAccounts] background sync ready: @${username}`)
    if (result.commentWarnings?.length) {
      console.warn(
        `[InstagramAccounts] @${username} synced with ${result.commentWarnings.length} comment warning(s):`,
        result.commentWarnings.map((w) => `reel ${w.reelId}: ${w.error}`).join(' | ')
      )
    }
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

    // Probe the provider BEFORE any DB write. If the provider fails
    // (429/401/403/404/500/network), propagate the error and leave the
    // database untouched. No MockProvider fallback — ever.
    const provider = providerFactory.getProvider()
    const profileData = await provider.getProfile(username)
    const providerName = providerFactory.getProviderLabel()

    if (existing && existing.deletedAt) {
      const updated = await InstagramProfile.findOneAndUpdate(
        { username, workspaceId },
        {
          deletedAt: null,
          fullName: profileData.fullName,
          bio: profileData.bio,
          profilePic: profileData.profilePic,
          followers: profileData.followers,
          following: profileData.following,
          postsCount: profileData.postsCount,
          verified: profileData.verified,
          provider: providerName,
          providerVersion: 'v1',
          syncedAt: new Date(),
          syncStatus: 'syncing',
          syncError: '',
        },
        { new: true }
      )
      setImmediate(() => runBackgroundSync(username, workspaceId))
      return res.json({ success: true, data: updated })
    }

    const created = await InstagramProfile.create({
      username,
      workspaceId,
      fullName: profileData.fullName,
      bio: profileData.bio,
      profilePic: profileData.profilePic,
      followers: profileData.followers,
      following: profileData.following,
      postsCount: profileData.postsCount,
      verified: profileData.verified,
      provider: providerName,
      providerVersion: 'v1',
      syncedAt: new Date(),
      syncStatus: 'syncing',
      rawPayload: profileData.rawPayload || {},
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
