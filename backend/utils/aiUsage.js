import User from '../models/User.js'
import { aiLocalStorage } from './aiContext.js'

export async function lazyResetUserUsage(userId) {
  if (!userId) return null
  const user = await User.findById(userId).select('aiUsage').lean()
  if (!user) return null

  // If aiUsage doesn't exist, initialize it
  if (!user.aiUsage) {
    const now = new Date()
    const init = {
      dailyBudget: 5,
      monthlyBudget: 50,
      todaySpend: 0,
      monthSpend: 0,
      todayCalls: 0,
      todayTokens: 0,
      cacheHits: 0,
      providerFallbacks: 0,
      lastResetDay: now,
      lastResetMonth: now
    }
    await User.updateOne({ _id: userId }, { $set: { aiUsage: init } })
    return init
  }

  const now = new Date()
  const updates = {}
  const aiUsage = user.aiUsage

  const lastResetDay = aiUsage.lastResetDay ? new Date(aiUsage.lastResetDay) : null
  const newDay = !lastResetDay ||
    lastResetDay.getDate() !== now.getDate() ||
    lastResetDay.getMonth() !== now.getMonth() ||
    lastResetDay.getFullYear() !== now.getFullYear()

  const lastResetMonth = aiUsage.lastResetMonth ? new Date(aiUsage.lastResetMonth) : null
  const newMonth = !lastResetMonth ||
    lastResetMonth.getMonth() !== now.getMonth() ||
    lastResetMonth.getFullYear() !== now.getFullYear()

  if (newDay) {
    updates['aiUsage.todaySpend'] = 0
    updates['aiUsage.todayCalls'] = 0
    updates['aiUsage.todayTokens'] = 0
    updates['aiUsage.cacheHits'] = 0
    updates['aiUsage.lastResetDay'] = now
  }

  if (newMonth) {
    updates['aiUsage.monthSpend'] = 0
    updates['aiUsage.lastResetMonth'] = now
  }

  if (Object.keys(updates).length) {
    await User.updateOne({ _id: userId }, { $set: updates })
    
    // Merge updates back to local object
    aiUsage.todaySpend = newDay ? 0 : aiUsage.todaySpend
    aiUsage.todayCalls = newDay ? 0 : aiUsage.todayCalls
    aiUsage.todayTokens = newDay ? 0 : aiUsage.todayTokens
    aiUsage.cacheHits = newDay ? 0 : aiUsage.cacheHits
    aiUsage.monthSpend = newMonth ? 0 : aiUsage.monthSpend
    aiUsage.lastResetDay = newDay ? now : aiUsage.lastResetDay
    aiUsage.lastResetMonth = newMonth ? now : aiUsage.lastResetMonth
  }

  return aiUsage
}

export async function checkUserBudget(userId) {
  if (!userId) return

  const store = aiLocalStorage.getStore()
  if (store?.budgetChecked) {
    return // skip DB query if budget was already checked in this request lifecycle
  }

  const aiUsage = await lazyResetUserUsage(userId)
  if (!aiUsage) return

  const dailyBudget = aiUsage.dailyBudget || 5
  const monthlyBudget = aiUsage.monthlyBudget || 50

  // Query using findOne to check budget atomically under high concurrency
  const allowedUser = await User.findOne(
    {
      _id: userId,
      'aiUsage.todaySpend': { $lt: dailyBudget },
      'aiUsage.monthSpend': { $lt: monthlyBudget }
    },
    {
      aiUsage: 1
    }
  )

  if (!allowedUser) {
    throw new Error(`AI daily or monthly budget limit exceeded ($${aiUsage.todaySpend.toFixed(4)} / $${dailyBudget.toFixed(2)})`)
  }

  if (store) {
    store.budgetChecked = true
  }
}

export async function incrementUserUsage(userId, { spend, tokens, cacheHit }) {
  if (!userId) return

  // Ensure resets are handled first
  const aiUsage = await lazyResetUserUsage(userId)
  if (!aiUsage) return

  // Re-check budget immediately before incrementing usage
  const dailyBudget = aiUsage.dailyBudget || 5
  const monthlyBudget = aiUsage.monthlyBudget || 50

  const allowedUser = await User.findOne(
    {
      _id: userId,
      'aiUsage.todaySpend': { $lt: dailyBudget },
      'aiUsage.monthSpend': { $lt: monthlyBudget }
    },
    {
      aiUsage: 1
    }
  )

  if (!allowedUser && !cacheHit) {
    throw new Error(`AI daily or monthly budget limit exceeded ($${aiUsage.todaySpend.toFixed(4)} / $${dailyBudget.toFixed(2)})`)
  }

  const query = { _id: userId }
  if (!cacheHit) {
    query['aiUsage.todaySpend'] = { $lt: dailyBudget }
    query['aiUsage.monthSpend'] = { $lt: monthlyBudget }
  }

  const update = {
    $inc: {
      'aiUsage.todayCalls': cacheHit ? 0 : 1,
      'aiUsage.todayTokens': cacheHit ? 0 : tokens,
      'aiUsage.todaySpend': cacheHit ? 0 : spend,
      'aiUsage.monthSpend': cacheHit ? 0 : spend,
      'aiUsage.cacheHits': cacheHit ? 1 : 0
    }
  }

  const result = await User.updateOne(query, update)
  if (result.matchedCount === 0) {
    throw new Error(`AI daily or monthly budget limit exceeded ($${aiUsage.todaySpend.toFixed(4)} / $${dailyBudget.toFixed(2)})`)
  }
}

export async function incrementProviderFallback(userId) {
  if (!userId) return
  await User.updateOne(
    { _id: userId },
    { $inc: { 'aiUsage.providerFallbacks': 1 } }
  )
}
