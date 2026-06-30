/**
 * Instagram AI intelligence HTTP controller.
 *
 * Thin layer over instagramAIService. Pulls workspaceId / userId from req
 * (set by auth middleware) and accountId / userInput from query / body.
 *
 * Responses:
 *   success → { success: true, data: { ...featurePayload, _fallback?, meta } }
 *   failure → central errorHandler maps AppError / AIProviderError to a
 *             clean HTTP response. The feature services already absorb AI
 *             failures internally and return deterministic fallbacks, so
 *             AI errors never bubble here as 5xx — they're surfaced as
 *             `data._fallback: true` on a 200.
 */

import {
  getActiveProviderName,
} from '../services/ai/index.js'
import * as aiService from '../services/instagram/instagramAIService.js'

function attachAIHeaders(res) {
  res.setHeader('X-AI-Provider', getActiveProviderName())
  res.setHeader('X-AI-Status', 'success')
}

function accountIdFrom(req) {
  return req.query.accountId || req.body?.accountId || ''
}

export async function listRecommendations(req, res, next) {
  try {
    const data = await aiService.getRecommendations({
      workspaceId: req.workspaceId,
      accountId: accountIdFrom(req),
    })
    attachAIHeaders(res)
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
}

export async function listBestTimes(req, res, next) {
  try {
    const data = await aiService.getBestTimes({
      workspaceId: req.workspaceId,
      accountId: accountIdFrom(req),
    })
    attachAIHeaders(res)
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
}

export async function listGrowthOpportunities(req, res, next) {
  try {
    const data = await aiService.getGrowthOpportunitiesEndpoint({
      workspaceId: req.workspaceId,
      accountId: accountIdFrom(req),
    })
    attachAIHeaders(res)
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
}

export async function listCompetitors(req, res, next) {
  try {
    const data = await aiService.getCompetitorsEndpoint({
      workspaceId: req.workspaceId,
      accountId: accountIdFrom(req),
    })
    attachAIHeaders(res)
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
}

export async function listHashtags(req, res, next) {
  try {
    const data = await aiService.getHashtagsEndpoint({
      workspaceId: req.workspaceId,
      accountId: accountIdFrom(req),
    })
    attachAIHeaders(res)
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
}

export async function createContentIdeas(req, res, next) {
  try {
    const userInput = req.body?.prompt || req.body?.userInput || req.body?.topic || ''
    const data = await aiService.getContentIdeasEndpoint({
      workspaceId: req.workspaceId,
      accountId: req.body?.accountId || '',
      userInput,
    })
    attachAIHeaders(res)
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
}
