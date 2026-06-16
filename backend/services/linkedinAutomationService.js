import LinkedinAutomationRule from '../models/linkedinAutomationRules.js'

export const getAutomationRules = async (workspaceId) => {
  return await LinkedinAutomationRule.find({ workspaceId }).sort({ createdAt: -1 })
}

export const createAutomationRule = async (ruleData, workspaceId) => {
  const newRule = new LinkedinAutomationRule({ ...ruleData, workspaceId })
  return await newRule.save()
}

export const updateAutomationRule = async (id, ruleData, workspaceId) => {
  return await LinkedinAutomationRule.findOneAndUpdate({ _id: id, workspaceId }, ruleData, { new: true })
}

export const deleteAutomationRule = async (id, workspaceId) => {
  return await LinkedinAutomationRule.findOneAndDelete({ _id: id, workspaceId })
}

export const toggleRuleStatus = async (id, workspaceId) => {
  const rule = await LinkedinAutomationRule.findOne({ _id: id, workspaceId })
  if (!rule) throw new Error('Rule not found')
  rule.status = rule.status === 'Active' ? 'Inactive' : 'Active'
  return await rule.save()
}
