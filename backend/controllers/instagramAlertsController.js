/**
 * Instagram alerts HTTP controller.
 *
 * Thin layer over instagramAlertsService — pulls workspaceId / userId from
 * req (set by auth middleware) and accountId/filter from query/body.
 *
 * All responses are JSON: { success, data } on success, { success: false,
 * error } on failure (the central error handler maps thrown AppErrors).
 */

import * as alertsService from '../services/instagram/instagramAlertsService.js'

export async function listAlerts(req, res, next) {
  try {
    const { workspaceId } = req
    const accountId = req.query.accountId || req.body?.accountId
    const filter = req.query.filter || req.body?.filter
    const limit = req.query.limit || req.body?.limit
    const data = await alertsService.listAlerts({ workspaceId, accountId, filter, limit })
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
}

export async function refreshAlerts(req, res, next) {
  try {
    const { workspaceId, user } = req
    const accountId = req.body?.accountId || req.query.accountId
    const userId = user?._id || null

    const result = accountId
      ? await alertsService.refreshAlertsForAccount(accountId, workspaceId, userId)
      : await alertsService.refreshAllAlerts(workspaceId, userId)

    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

export async function markRead(req, res, next) {
  try {
    const { workspaceId, user } = req
    const { id } = req.params
    const userId = user?._id || null
    const updated = await alertsService.markAlertRead(id, workspaceId, userId)
    res.json({ success: true, data: updated })
  } catch (err) {
    next(err)
  }
}

export async function markAllRead(req, res, next) {
  try {
    const { workspaceId } = req
    const accountId = req.body?.accountId || req.query.accountId
    const result = await alertsService.markAllRead(workspaceId, accountId)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}
