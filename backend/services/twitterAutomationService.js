import AutomationRule from '../models/automationRules.js'

export const getAutomationRules = async (workspaceId) => {
  return await AutomationRule.find({ workspaceId }).sort({ createdAt: -1 })
}

export const createAutomationRule = async (ruleData, workspaceId) => {
  const newRule = new AutomationRule({ ...ruleData, workspaceId })
  return await newRule.save()
}

export const updateAutomationRule = async (id, ruleData, workspaceId) => {
  return await AutomationRule.findOneAndUpdate({ _id: id, workspaceId }, ruleData, { new: true })
}

export const deleteAutomationRule = async (id, workspaceId) => {
  return await AutomationRule.findOneAndDelete({ _id: id, workspaceId })
}

export const toggleRuleStatus = async (id, workspaceId) => {
  const rule = await AutomationRule.findOne({ _id: id, workspaceId })
  if (!rule) throw new Error('Rule not found')
  rule.status = rule.status === 'Active' ? 'Inactive' : 'Active'
  return await rule.save()
}

