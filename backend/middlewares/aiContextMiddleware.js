import { aiLocalStorage } from '../utils/aiContext.js'

export const attachAIContext = (req, res, next) => {
  aiLocalStorage.run({ userId: req.user?._id?.toString() || null, budgetChecked: false }, next)
}
