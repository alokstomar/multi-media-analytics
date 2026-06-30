/**
 * Instagram alerts service — orchestration layer.
 *
 * Responsibilities:
 *   - Pull source data (account, prior snapshot, recent reels, recent comments)
 *     via the IG models the rest of the IG subsystem already uses.
 *   - Run the detection engine.
 *   - Dedupe by `metadata.signature` so refresh doesn't double-insert.
 *   - Persist new alerts, expose list/mark-read/mark-all-read operations.
 *
 * No HTTP knowledge here — that belongs in the controller. Service throws
 * AppError on failures; the central error handler maps to HTTP responses.
 */

import mongoose from 'mongoose'
import InstagramAccount from '../../models/InstagramAccount.js'
import InstagramAnalyticsSnapshot from '../../models/InstagramAnalyticsSnapshot.js'
import InstagramReel from '../../models/InstagramReel.js'
import InstagramComment from '../../models/InstagramComment.js'
import InstagramAlert from '../../models/InstagramAlert.js'
import { AppError } from '../../utils/errorHandler.js'
import { detectAlerts } from './instagramAlertEngine.js'
import { FILTER_BUCKETS } from './instagramAlertRules.js'

// How far back to look for an existing identical signature before re-inserting.
const DEDUPE_WINDOW_DAYS = 7
// How many recent reels / comments to feed the engine.
const RECENT_REELS_LIMIT = 25
const RECENT_COMMENTS_WINDOW_DAYS = 7

/**
 * Resolve a workspace-scoped Instagram account by id (objectId OR accountId).
 * Throws 404 if not found or outside the workspace.
 */
async function resolveAccount(accountId, workspaceId) {
  if (!accountId) throw new AppError('accountId is required', 400)
  const query = { workspaceId }
  if (mongoose.Types.ObjectId.isValid(accountId)) {
    query.$or = [{ _id: accountId }, { accountId }]
  } else {
    query.accountId = accountId
  }
  const acc = await InstagramAccount.findOne(query).lean()
  if (!acc) throw new AppError('Instagram account not found in this workspace', 404)
  return acc
}

/**
 * Refresh alerts for a single IG account in the workspace.
 * Returns { created, skipped, total }.
 */
export async function refreshAlertsForAccount(accountId, workspaceId, userId = null) {
  const acc = await resolveAccount(accountId, workspaceId)

  // Prior snapshot (skip today's — we want the comparison baseline)
  const snapshots = await InstagramAnalyticsSnapshot.find({
    username: acc.username,
    workspaceId,
  })
    .sort({ snapshotDate: -1 })
    .limit(2)
    .lean()
  const prevSnapshot = snapshots[0]?.snapshotDate &&
    new Date(snapshots[0].snapshotDate).toDateString() === new Date().toDateString()
    ? snapshots[1] || null
    : snapshots[0] || null

  // Account's current engagementRate lives on snapshots; prefer the latest one.
  if (prevSnapshot && !acc.engagementRate) {
    acc.engagementRate = snapshots[0]?.engagementRate || 0
  }

  // Recent reels for this username
  const recentReels = await InstagramReel.find({
    username: acc.username,
    workspaceId,
  })
    .sort({ publishDate: -1 })
    .limit(RECENT_REELS_LIMIT)
    .lean()

  // Recent comments across this account's reels
  const reelIds = recentReels.map((r) => r.reelId)
  const since = new Date(Date.now() - RECENT_COMMENTS_WINDOW_DAYS * 86400000)
  let recentComments = []
  if (reelIds.length) {
    recentComments = await InstagramComment.find({
      reelId: { $in: reelIds },
      workspaceId,
      syncedAt: { $gte: since },
    })
      .lean()
      .limit(500)
  }

  const candidates = detectAlerts({
    account: acc,
    prevSnapshot,
    recentReels,
    recentComments,
  })

  // Dedupe: skip signatures that already exist in the dedupe window.
  const signatures = candidates.map((c) => c.metadata?.signature).filter(Boolean)
  const cutoff = new Date(Date.now() - DEDUPE_WINDOW_DAYS * 86400000)
  let existing = []
  if (signatures.length) {
    existing = await InstagramAlert.find({
      workspaceId,
      accountId: acc.accountId,
      'metadata.signature': { $in: signatures },
      createdAt: { $gte: cutoff },
    })
      .select('metadata.signature')
      .lean()
  }
  const existingSigs = new Set(existing.map((e) => e.metadata?.signature).filter(Boolean))

  const toInsert = candidates
    .filter((c) => c.metadata?.signature && !existingSigs.has(c.metadata.signature))
    .map((c) => ({
      workspaceId,
      accountId: acc.accountId,
      userId: userId || null,
      type: c.type,
      severity: c.severity,
      title: c.title,
      message: c.message,
      metadata: c.metadata,
      isRead: false,
    }))

  if (toInsert.length) {
    await InstagramAlert.insertMany(toInsert, { ordered: false })
  }

  return { created: toInsert.length, skipped: existingSigs.size, total: candidates.length }
}

/**
 * Refresh alerts for all IG accounts in the workspace.
 * Returns aggregate counts.
 */
export async function refreshAllAlerts(workspaceId, userId = null) {
  const accounts = await InstagramAccount.find({ workspaceId })
    .select('accountId username')
    .lean()
  if (!accounts.length) return { accounts: 0, created: 0, skipped: 0, total: 0 }

  let created = 0
  let skipped = 0
  let total = 0
  for (const acc of accounts) {
    try {
      const r = await refreshAlertsForAccount(acc.accountId, workspaceId, userId)
      created += r.created
      skipped += r.skipped
      total += r.total
    } catch (err) {
      // Per-account failures shouldn't abort the whole refresh — log and move on.
      console.warn(
        `[instagramAlertsService] refresh failed for ${acc.username || acc.accountId}:`,
        err.message
      )
    }
  }
  return { accounts: accounts.length, created, skipped, total }
}

/**
 * List alerts newest-first, scoped to workspace. Optional filters:
 *   - accountId
 *   - filter bucket key from FILTER_BUCKETS
 *   - limit (default 100, max 500)
 */
export async function listAlerts({ workspaceId, accountId, filter, limit = 100 }) {
  const q = { workspaceId }
  if (accountId) q.accountId = accountId

  const cap = Math.min(Math.max(Number(limit) || 100, 1), 500)
  const alerts = await InstagramAlert.find(q).sort({ createdAt: -1 }).limit(cap).lean()

  const filtered =
    filter && FILTER_BUCKETS[filter] ? alerts.filter(FILTER_BUCKETS[filter]) : alerts

  return {
    alerts: filtered,
    total: alerts.length,
    counts: computeCounts(alerts),
  }
}

function computeCounts(alerts) {
  let critical = 0
  let unread = 0
  let viral = 0
  for (const a of alerts) {
    if (a.severity === 'critical') critical++
    if (!a.isRead) unread++
    if (a.type === 'VIRAL_REEL') viral++
  }
  return { total: alerts.length, critical, unread, viral }
}

/**
 * Mark a single alert as read. Workspace-scoped ownership check.
 */
export async function markAlertRead(alertId, workspaceId, userId = null) {
  if (!mongoose.Types.ObjectId.isValid(alertId)) {
    throw new AppError('Invalid alert id', 400)
  }
  const updated = await InstagramAlert.findOneAndUpdate(
    { _id: alertId, workspaceId },
    { $set: { isRead: true } },
    { new: true }
  )
  if (!updated) throw new AppError('Alert not found in this workspace', 404)
  return updated
}

/**
 * Mark every alert in the workspace (optionally scoped to one account) as read.
 */
export async function markAllRead(workspaceId, accountId = null) {
  const q = { workspaceId, isRead: false }
  if (accountId) q.accountId = accountId
  const res = await InstagramAlert.updateMany(q, { $set: { isRead: true } })
  return { modifiedCount: res.modifiedCount || 0 }
}
