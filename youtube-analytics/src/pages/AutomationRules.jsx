import { useState, useEffect } from 'react'
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
  Play,
  X
} from 'lucide-react'
import {
  getTwitterRules,
  createTwitterRule,
  updateTwitterRule,
  deleteTwitterRule,
  toggleTwitterRule,
  executeTwitterRule
} from '../services/api'

const TwitterIcon = (props) => (
  <svg
    className={props.className || "h-4 w-4"}
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M4 4l11.73 16h4.27L8.27 4H4z" />
    <path d="M18 4l-6.25 6.25m-2.5 2.5L4 20" />
  </svg>
)

export default function AutomationRules() {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(false)
  const [successToast, setSuccessToast] = useState('')
  const [showBuilderModal, setShowBuilderModal] = useState(false)
  const [editingRule, setEditingRule] = useState(null)

  // Rule Form State
  const [ruleName, setRuleName] = useState('')
  const [ruleType, setRuleType] = useState('daily')
  const [ruleTrigger, setRuleTrigger] = useState('')
  const [ruleFreq, setRuleFreq] = useState('')
  const [ruleAccount, setRuleAccount] = useState('@samay_raina')

  const showToast = (msg) => {
    setSuccessToast(msg)
    setTimeout(() => setSuccessToast(''), 3000)
  }

  const loadRules = async () => {
    setLoading(true)
    try {
      const res = await getTwitterRules()
      if (res?.success) {
        setRules(res.data || [])
      }
    } catch (err) {
      console.error('Failed to load Twitter rules:', err)
      showToast('Error loading automation rules.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRules()
  }, [])

  // Toggle Rule Status
  const handleToggleStatus = async (id) => {
    try {
      const res = await toggleTwitterRule(id)
      if (res?.success) {
        const item = rules.find(r => r._id === id)
        showToast(`Rule "${item.name}" toggled successfully!`)
        await loadRules()
      }
    } catch (err) {
      showToast(`Error: ${err.message}`)
    }
  }

  // Delete Rule
  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this automation rule?')) {
      try {
        const res = await deleteTwitterRule(id)
        if (res?.success) {
          showToast('Automation rule deleted successfully!')
          await loadRules()
        }
      } catch (err) {
        showToast(`Error: ${err.message}`)
      }
    }
  }

  // Execute Rule Now
  const handleExecuteRule = async (id) => {
    showToast('Triggering automation rule execution...')
    try {
      const res = await executeTwitterRule(id)
      if (res?.success && res.data?.success) {
        showToast('Rule executed successfully! Tweet published.')
      } else {
        showToast(`Rule execution failed: ${res.data?.errorMessage || 'Unknown error'}`)
      }
    } catch (err) {
      showToast(`Execution error: ${err.message}`)
    }
  }

  // Open builder for creating new
  const openNewBuilder = () => {
    setEditingRule(null)
    setRuleName('')
    setRuleType('daily')
    setRuleTrigger('Time reached = 09:00 AM')
    setRuleFreq('Daily')
    setRuleAccount('@samay_raina')
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
  const handleSaveRule = async (e) => {
    e.preventDefault()
    if (!ruleName.trim()) return

    const payload = {
      name: ruleName,
      type: ruleType,
      trigger: ruleTrigger,
      frequency: ruleFreq,
      targetAccount: ruleAccount
    }

    try {
      if (editingRule) {
        const res = await updateTwitterRule(editingRule._id, payload)
        if (res?.success) {
          showToast('Automation rule updated successfully!')
          await loadRules()
        }
      } else {
        const res = await createTwitterRule({ ...payload, status: 'Active' })
        if (res?.success) {
          showToast('Automation rule created successfully!')
          await loadRules()
        }
      }
      setShowBuilderModal(false)
    } catch (err) {
      showToast(`Save error: ${err.message}`)
    }
  }

  // Fill in default presets depending on selected trigger type
  const handleTypePresetChange = (type) => {
    setRuleType(type)
    if (type === 'daily') {
      setRuleTrigger('Time reached = 09:00 AM')
      setRuleFreq('Daily')
    } else if (type === 'thread') {
      setRuleTrigger('Day = Monday at 10:00 AM')
      setRuleFreq('Weekly')
    } else if (type === 'repurpose') {
      setRuleTrigger('New video published on YouTube')
      setRuleFreq('On Upload')
    } else if (type === 'recycle') {
      setRuleTrigger('Likes count > 500')
      setRuleFreq('Every 90 days')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/50 space-y-8 pb-12">
      {/* Toast */}
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
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-black text-white">
              <TwitterIcon className="h-4 w-4" fill="currentColor" />
            </span>
            X Automation Rule Studio
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Create recurring posting pipelines, auto-repurpose YouTube video links, and trigger auto-DM lists.
          </p>
        </div>

        <button
          onClick={openNewBuilder}
          className="flex items-center gap-2 h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer transition shadow-sm shadow-blue-500/10 self-start sm:self-center"
        >
          <Plus className="w-3.5 h-3.5" />
          Create New Rule
        </button>
      </div>

      {/* Dashboard health row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active Rules</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">
                {rules.filter(r => r.status === 'Active').length}
              </p>
              <p className="mt-1 text-xs font-medium text-emerald-600 flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" /> Auto-timetables active
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 shadow-inner">
              <Zap className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Workflows</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{rules.length}</p>
              <p className="mt-1 text-xs font-medium text-blue-600">Configured triggers</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-inner">
              <Sliders className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Background Loops</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">Online</p>
              <p className="mt-1 text-xs font-medium text-indigo-600">Background tasks live</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 shadow-inner">
              <Settings className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Rules Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-16">
          <Clock className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      ) : rules.length === 0 ? (
        <p className="text-xs text-gray-400 py-4 text-center">No automation rules configured. Build one to get started!</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {rules.map((rule) => (
            <div key={rule._id} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4 hover:scale-[1.005] transition flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-block text-[9px] font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    {rule.type} Rule
                  </span>
                  
                  {/* Status Toggle Switcher */}
                  <button
                    onClick={() => handleToggleStatus(rule._id)}
                    className="text-gray-400 hover:text-gray-900 cursor-pointer transition shrink-0"
                  >
                    {rule.status === 'Active' ? (
                      <ToggleRight className="w-8 h-8 text-emerald-500" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-gray-300" />
                    )}
                  </button>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-gray-800 leading-relaxed">{rule.name}</h3>
                  <p className="text-[10px] text-gray-400 font-bold mt-0.5">Target: {rule.targetAccount}</p>
                </div>

                {/* Trigger conditions */}
                <div className="p-3 bg-gray-50 border border-gray-50 rounded-xl space-y-1 text-[10px] text-gray-600 font-medium">
                  <p><strong className="text-gray-400 font-bold uppercase text-[8px] tracking-wider block">Trigger condition:</strong> {rule.trigger}</p>
                  <p><strong className="text-gray-400 font-bold uppercase text-[8px] tracking-wider block mt-1.5">Frequency index:</strong> {rule.frequency}</p>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-gray-50 pt-3 mt-4 shrink-0">
                <button
                  onClick={() => handleExecuteRule(rule._id)}
                  title="Execute and run rule immediately"
                  className="flex h-7 px-2.5 items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-[10px] font-bold cursor-pointer transition border border-blue-100"
                >
                  <Play className="w-2.5 h-2.5 fill-current" /> Run Now
                </button>
                <button
                  onClick={() => openEditBuilder(rule)}
                  className="flex h-7 px-3 items-center gap-1 bg-white border border-gray-100 hover:bg-gray-50 text-gray-600 rounded-lg text-[10px] font-bold cursor-pointer transition"
                >
                  <Edit2 className="w-2.5 h-2.5" /> Edit
                </button>
                <button
                  onClick={() => handleDelete(rule._id)}
                  className="flex h-7 w-7 items-center justify-center hover:bg-red-50 text-red-500 rounded-lg cursor-pointer transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Side-Drawer Builder Modal Overlay */}
      <AnimatePresence>
        {showBuilderModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
          >
            <motion.form
              onSubmit={handleSaveRule}
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white rounded-[24px] border border-gray-100 p-6 w-full max-w-md shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-blue-600 fill-current" />
                  {editingRule ? 'Edit Automation Rule' : 'Create Automation Rule'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowBuilderModal(false)}
                  className="p-1 hover:bg-gray-50 rounded-full text-gray-400 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Name */}
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block pl-1">Rule Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Daily Tech Insight Queue"
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-gray-100 text-xs font-semibold text-gray-700 bg-gray-50/50 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/25 transition"
                  />
                </div>

                {/* Rule Preset Type */}
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block pl-1">Rule Blueprint Type</label>
                  <select
                    value={ruleType}
                    onChange={(e) => handleTypePresetChange(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-gray-100 text-xs font-semibold text-gray-700 bg-gray-50/50 outline-none focus:border-blue-400 transition cursor-pointer"
                  >
                    <option value="daily">Daily Posting (Post daily at set hour)</option>
                    <option value="thread">Thread Rule (Publish threads weekly)</option>
                    <option value="repurpose">Repurpose Rule (Convert YouTube to X threads)</option>
                    <option value="recycle">Recycle Rule (Repost top tweets every 90 days)</option>
                  </select>
                </div>

                {/* Trigger */}
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block pl-1">Trigger Condition</label>
                  <input
                    type="text"
                    required
                    value={ruleTrigger}
                    onChange={(e) => setRuleTrigger(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-gray-100 text-xs font-semibold text-gray-700 bg-gray-50/50 outline-none focus:border-blue-400 transition"
                  />
                </div>

                {/* Frequency */}
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block pl-1">Execution Frequency</label>
                  <input
                    type="text"
                    required
                    value={ruleFreq}
                    onChange={(e) => setRuleFreq(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-gray-100 text-xs font-semibold text-gray-700 bg-gray-50/50 outline-none focus:border-blue-400 transition"
                  />
                </div>
              </div>

              <div className="bg-blue-50/30 border border-blue-100/50 p-3 rounded-xl flex gap-2">
                <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-[9px] leading-relaxed text-blue-700 font-medium">
                  Saving this automation rule registers the Cron timetable to our backend task queues. It operates asynchronously in a background worker.
                </p>
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
                  Save Automation Rule
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
