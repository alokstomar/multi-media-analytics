import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
  TrendingUp,
  Sliders,
  Settings,
  HelpCircle,
  X
} from 'lucide-react'

const LinkedInIcon = (props) => (
  <svg
    className={props.className || "h-4 w-4"}
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
  </svg>
)

const MOCK_RULES = [
  { id: 'ru1', name: 'Monday Morning Thought Leadership booster', type: 'leadership', trigger: 'Time reached = Monday 09:00 AM', frequency: 'Weekly', targetAccount: 'Samay Raina', status: 'Active' },
  { id: 'ru2', name: 'Compounding B2B SaaS Case Study', type: 'recurring', trigger: 'Day reached = Wednesday 02:00 PM', frequency: 'Weekly', targetAccount: 'Samay Raina', status: 'Active' },
  { id: 'ru3', name: 'YouTube Tech Upload summarizing dispatches', type: 'youtube', trigger: 'New video published on YouTube channel', frequency: 'On Upload', targetAccount: 'Samay Gaming Co', status: 'Active' },
  { id: 'ru4', name: 'Contrarian Debate Builder recyclers', type: 'blog', trigger: 'Likes count > 300', frequency: 'Every 60 days', targetAccount: 'Samay Raina', status: 'Inactive' }
]

export default function LinkedInAutomationRules() {
  const [rules, setRules] = useState(MOCK_RULES)
  const [successToast, setSuccessToast] = useState('')
  const [showBuilderModal, setShowBuilderModal] = useState(false)
  const [editingRule, setEditingRule] = useState(null)

  // Rule Form State
  const [ruleName, setRuleName] = useState('')
  const [ruleType, setRuleType] = useState('leadership')
  const [ruleTrigger, setRuleTrigger] = useState('')
  const [ruleFreq, setRuleFreq] = useState('')
  const [ruleAccount, setRuleAccount] = useState('Samay Raina')

  const showToast = (msg) => {
    setSuccessToast(msg)
    setTimeout(() => setSuccessToast(''), 3000)
  }

  // Toggle Rule Status
  const handleToggleStatus = (id) => {
    setRules(rules.map(r => {
      if (r.id === id) {
        const nextStatus = r.status === 'Active' ? 'Inactive' : 'Active'
        showToast(`Rule "${r.name}" is now ${nextStatus}!`)
        return { ...r, status: nextStatus }
      }
      return r
    }))
  }

  // Delete Rule
  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this automation rule?')) {
      setRules(rules.filter(r => r.id !== id))
      showToast('Automation rule deleted successfully!')
    }
  }

  // Open builder for creating new
  const openNewBuilder = () => {
    setEditingRule(null)
    setRuleName('')
    setRuleType('leadership')
    setRuleTrigger('Time reached = Monday 09:00 AM')
    setRuleFreq('Weekly')
    setRuleAccount('Samay Raina')
    setShowBuilderModal(true)
  }

  // Open builder for editing existing
  const openEditBuilder = (rule) => {
    setEditingRule(rule)
    setRuleName(rule.name)
    setRuleType(rule.type)
    setRuleTrigger(rule.trigger)
    setRuleFreq(rule.frequency)
    setRuleAccount(rule.targetAccount)
    setShowBuilderModal(true)
  }

  // Handle Form Submission (Create or Edit)
  const handleSaveRule = (e) => {
    e.preventDefault()
    if (!ruleName.trim()) return

    if (editingRule) {
      // Edit
      setRules(rules.map(r => r.id === editingRule.id ? {
        ...r,
        name: ruleName,
        type: ruleType,
        trigger: ruleTrigger,
        frequency: ruleFreq,
        targetAccount: ruleAccount
      } : r))
      showToast('Automation rule updated successfully!')
    } else {
      // Create
      const newRule = {
        id: 'ln-ru-' + Date.now(),
        name: ruleName,
        type: ruleType,
        trigger: ruleTrigger,
        frequency: ruleFreq,
        targetAccount: ruleAccount,
        status: 'Active'
      }
      setRules([newRule, ...rules])
      showToast('Automation rule created & enabled!')
    }

    setShowBuilderModal(false)
  }

  return (
    <div className="min-h-screen bg-gray-50/50 space-y-8 pb-12">
      {/* Toast Notification */}
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 right-6 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg text-xs font-bold"
          >
            <CheckCircle className="w-4 h-4" />
            {successToast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0077b5] text-white">
              <LinkedInIcon className="h-4.5 w-4.5" />
            </span>
            LinkedIn Automation Rules
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Define automated scheduling guidelines, convert external logs, and syndicate recurring thought-leadership loops.
          </p>
        </div>

        <button
          onClick={openNewBuilder}
          className="flex items-center gap-2 h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer transition shadow-sm shadow-blue-500/10 self-start sm:self-center"
        >
          <Plus className="w-3.5 h-3.5" />
          Create Automation Rule
        </button>
      </div>

      {/* Rules Dashboard Deck */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {rules.map(rule => (
          <div
            key={rule.id}
            className={`bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col justify-between hover:border-gray-200 hover:shadow-md transition duration-200 ${
              rule.status === 'Inactive' ? 'opacity-70' : ''
            }`}
          >
            <div className="space-y-4">
              {/* Header */}
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-1 min-w-0">
                  <span className="inline-block text-[8px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 uppercase tracking-wider">
                    {rule.type.replace('-', ' ')}
                  </span>
                  <h3 className="text-xs font-extrabold text-gray-900 leading-snug truncate mt-0.5" title={rule.name}>
                    {rule.name}
                  </h3>
                </div>

                {/* Status Toggle Switch */}
                <button
                  onClick={() => handleToggleStatus(rule.id)}
                  className="cursor-pointer transition shrink-0"
                  title={rule.status === 'Active' ? 'Deactivate rule' : 'Activate rule'}
                >
                  {rule.status === 'Active' ? (
                    <ToggleRight className="w-9 h-6 text-emerald-500" />
                  ) : (
                    <ToggleLeft className="w-9 h-6 text-gray-300" />
                  )}
                </button>
              </div>

              {/* Params list */}
              <div className="p-3 bg-gray-50 border border-gray-50 rounded-xl space-y-2 select-none text-[10px] font-bold text-gray-600 leading-none">
                <div className="flex justify-between items-center">
                  <span>Trigger:</span>
                  <span className="text-gray-900 font-extrabold">{rule.trigger}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Frequency:</span>
                  <span className="text-gray-900 font-extrabold">{rule.frequency}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Target Profile:</span>
                  <span className="text-gray-900 font-extrabold">{rule.targetAccount}</span>
                </div>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="flex justify-end gap-1.5 pt-4 mt-4 border-t border-gray-50 shrink-0">
              <button
                onClick={() => openEditBuilder(rule)}
                className="flex h-7 px-2.5 items-center gap-1 border border-gray-100 hover:bg-gray-50 text-gray-600 rounded-lg text-[9px] font-bold cursor-pointer transition shrink-0"
              >
                <Edit2 className="w-2.5 h-2.5" /> Edit Rule
              </button>
              <button
                onClick={() => handleDelete(rule.id)}
                className="flex h-7 w-7 items-center justify-center hover:bg-red-50 text-red-500 rounded-lg cursor-pointer transition shrink-0 border border-transparent hover:border-red-100"
                title="Delete rule"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Guidance Alert Banner */}
      <div className="bg-indigo-50/20 border border-indigo-100/50 rounded-2xl p-5 shadow-inner flex gap-3.5 items-start">
        <HelpCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5 animate-pulse" />
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-indigo-900">B2B Content Automation Rules</h4>
          <p className="text-[10px] text-indigo-700 leading-relaxed font-medium">
            Automation rules automatically plan and schedule your high-performance content library slots. You can repurpose YouTube publications into LinkedIn professional digests, recycle highly commented thought-leadership posts after days loops, or schedule weekly company presets.
          </p>
        </div>
      </div>

      {/* Slide-Drawer Rule Builder Modal */}
      <AnimatePresence>
        {showBuilderModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.form
              onSubmit={handleSaveRule}
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-[24px] shadow-2xl border border-gray-100 p-6 w-full max-w-md space-y-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Zap className="h-4.5 w-4.5 text-blue-600" />
                  {editingRule ? 'Edit Automation Rule' : 'Create LinkedIn Automation Rule'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowBuilderModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block pl-1">Rule Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Wednesday B2B Insight Loop"
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-gray-100 text-xs font-semibold text-gray-800 bg-gray-50/50 outline-none focus:border-blue-400 transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block pl-1">Rule Type</label>
                    <select
                      value={ruleType}
                      onChange={(e) => setRuleType(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-xl border border-gray-100 text-xs font-bold text-gray-700 bg-gray-50/50 outline-none focus:border-blue-400 transition cursor-pointer"
                    >
                      <option value="leadership">Thought Leadership</option>
                      <option value="recurring">Recurring Post</option>
                      <option value="company">Company updates</option>
                      <option value="blog">Blog repurpose</option>
                      <option value="youtube">YouTube summarizer</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block pl-1">Target Account</label>
                    <select
                      value={ruleAccount}
                      onChange={(e) => setRuleAccount(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-xl border border-gray-100 text-xs font-bold text-gray-700 bg-gray-50/50 outline-none focus:border-blue-400 transition cursor-pointer"
                    >
                      <option value="Samay Raina">Samay Raina</option>
                      <option value="Samay Gaming Co">Samay Gaming Co</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block pl-1">Trigger Trigger Condition</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Day reached = Wednesday 02:00 PM"
                    value={ruleTrigger}
                    onChange={(e) => setRuleTrigger(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-gray-100 text-xs font-semibold text-gray-800 bg-gray-50/50 outline-none focus:border-blue-400 transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block pl-1">Frequency Index</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Weekly, Every 60 days, etc."
                    value={ruleFreq}
                    onChange={(e) => setRuleFreq(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-gray-100 text-xs font-semibold text-gray-800 bg-gray-50/50 outline-none focus:border-blue-400 transition"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowBuilderModal(false)}
                  className="h-10 px-4 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer shadow-sm shadow-blue-500/10"
                >
                  Save Rule
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
