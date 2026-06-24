import User from '../models/User.js'
import { computeFingerprint } from '../utils/generateApiKey.js'
import bcrypt from 'bcryptjs'

export async function requireApiKey(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required. Provide Bearer token.' })
    }

    const rawKey = authHeader.split(' ')[1]
    if (!rawKey) {
      return res.status(401).json({ success: false, message: 'Invalid token format.' })
    }

    const fp = computeFingerprint(rawKey)

    // O(1) compound index lookup
    const user = await User.findOne({
      'apiKeys.fingerprint': fp,
      'apiKeys.active': true
    })

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid or deactivated API Key.' })
    }

    const keyObj = user.apiKeys.find(k => k.fingerprint === fp && k.active)
    if (!keyObj) {
      return res.status(401).json({ success: false, message: 'Invalid or deactivated API Key.' })
    }

    const isMatch = await bcrypt.compare(rawKey, keyObj.keyHash)
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid or deactivated API Key.' })
    }

    // Daily rate limit reset logic
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const needsReset = !keyObj.lastResetAt || keyObj.lastResetAt < today

    const currentRequests = needsReset ? 0 : keyObj.requestsToday
    if (currentRequests >= keyObj.rateLimit) {
      return res.status(429).json({ success: false, message: 'API rate limit exceeded.' })
    }

    // Concurrent-safe atomic update
    const updateQuery = {
      _id: user._id,
      'apiKeys.fingerprint': fp
    }
    const updateDoc = {
      $set: {
        'apiKeys.$.lastUsedAt': new Date()
      },
      $inc: {
        'apiKeys.$.requestsToday': 1
      }
    }
    if (needsReset) {
      updateDoc.$set['apiKeys.$.requestsToday'] = 1
      updateDoc.$set['apiKeys.$.lastResetAt'] = new Date()
    }
    await User.updateOne(updateQuery, updateDoc)

    req.apiUser = user
    next()
  } catch (err) {
    next(err)
  }
}
