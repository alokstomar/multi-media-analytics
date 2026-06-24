import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plug,
  Sparkles,
  Globe,
  Zap,
  CheckCircle,
  RefreshCw,
  Key,
  Copy,
  Plus,
  ArrowRight,
  Info,
  Server,
  Activity,
  AlertCircle
} from 'lucide-react'

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

const INITIAL_AI_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', desc: 'GPT-4o & GPT-4 models for tweet optimizations and threads.', connected: true, status: 'Active', icon: Sparkles, badgeColor: 'bg-emerald-50 text-emerald-600 border-emerald-100', defaultModel: 'gpt-4o' },
  { id: 'claude', name: 'Anthropic Claude', desc: 'Claude 3.5 Sonnet for premium storytelling and listicles.', connected: false, status: 'Inactive', icon: Sparkles, badgeColor: 'bg-gray-100 text-gray-500 border-gray-200', defaultModel: 'claude-3-5-sonnet' },
  { id: 'gemini', name: 'Google Gemini', desc: 'Gemini 1.5 Pro for multi-channel repurposing and transcripts.', connected: false, status: 'Inactive', icon: Sparkles, badgeColor: 'bg-gray-100 text-gray-500 border-gray-200', defaultModel: 'gemini-1.5-pro' }
]

const INITIAL_SOCIALS = [
  { id: 'twitter', name: 'Twitter / X', desc: 'Direct publishing queue, automation rules, and dashboards.', connected: true, status: 'Connected', icon: TwitterIcon, badgeColor: 'bg-sky-50 text-sky-500 border-sky-100' },
  { id: 'linkedin', name: 'LinkedIn', desc: 'Direct post generator, preview, and scheduled calendar.', connected: true, status: 'Connected', icon: Globe, badgeColor: 'bg-blue-50 text-blue-600 border-blue-100' }
]

const INITIAL_PLATFORMS = [
  { id: 'zapier', name: 'Zapier', desc: 'Trigger automation rules when external webhooks fire.', connected: true, status: 'Active', icon: Zap, badgeColor: 'bg-orange-50 text-orange-600 border-orange-100' },
  { id: 'make', name: 'Make.com', desc: 'Visual integrations to route draft posts to external sheets.', connected: false, status: 'Inactive', icon: Zap, badgeColor: 'bg-gray-100 text-gray-500 border-gray-200' },
  { id: 'n8n', name: 'n8n Workflow', desc: 'Self-hosted or cloud-level automation workflows sync.', connected: false, status: 'Inactive', icon: Zap, badgeColor: 'bg-gray-100 text-gray-500 border-gray-200' }
]

export default function Integrations() {
  const [successToast, setSuccessToast] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastSync, setLastSync] = useState('Just now')

  // Providers lists states
  const [aiProviders, setAiProviders] = useState(INITIAL_AI_PROVIDERS)
  const [socials, setSocials] = useState(INITIAL_SOCIALS)
  const [platforms, setPlatforms] = useState(INITIAL_PLATFORMS)

  // Webhooks states
  const [incomingUrl] = useState(`${window.location.origin}/api/studio/webhooks/incoming/tw_rule_9824`)
  const [outgoingUrl, setOutgoingUrl] = useState('https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX')
  const [testingOutgoing, setTestingOutgoing] = useState(false)

  const showToast = (msg) => {
    setSuccessToast(msg)
    setTimeout(() => setSuccessToast(''), 3000)
  }

  // Handle Refreshing all services
  const handleRefreshSync = () => {
    setIsRefreshing(true)
    showToast('Syncing all integration credentials and states...')
    setTimeout(() => {
      setIsRefreshing(false)
      setLastSync('Just now')
      showToast('All integrations fully synchronized!')
    }, 1500)
  }

  // Generic Toggle Handler
  const handleToggle = (type, id) => {
    if (type === 'ai') {
      setAiProviders(aiProviders.map(p => {
        if (p.id === id) {
          const nextVal = !p.connected
          showToast(`${p.name} integration is now ${nextVal ? 'Enabled' : 'Disabled'}`)
          return { ...p, connected: nextVal, status: nextVal ? 'Active' : 'Inactive', badgeColor: nextVal ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-gray-100 text-gray-500 border-gray-200' }
        }
        return p
      }))
    } else if (type === 'social') {
      setSocials(socials.map(s => {
        if (s.id === id) {
          const nextVal = !s.connected
          showToast(`${s.name} direct connection ${nextVal ? 'Restored' : 'Paused'}`)
          return { ...s, connected: nextVal, status: nextVal ? 'Connected' : 'Disconnected', badgeColor: nextVal ? (s.id === 'twitter' ? 'bg-sky-50 text-sky-500 border-sky-100' : 'bg-blue-50 text-blue-600 border-blue-100') : 'bg-gray-100 text-gray-500 border-gray-200' }
        }
        return s
      }))
    } else if (type === 'platform') {
      setPlatforms(platforms.map(pl => {
        if (pl.id === id) {
          const nextVal = !pl.connected
          showToast(`${pl.name} webhook bridge ${nextVal ? 'Activated' : 'Suspended'}`)
          return { ...pl, connected: nextVal, status: nextVal ? 'Active' : 'Inactive', badgeColor: nextVal ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-gray-100 text-gray-500 border-gray-200' }
        }
        return pl
      }))
    }
  }

  // Copy helper
  const handleCopy = (text) => {
    navigator.clipboard.writeText(text)
    showToast('Copied to clipboard!')
  }

  // Test Outgoing Webhook trigger
  const handleTestOutgoing = (e) => {
    e.preventDefault()
    if (!outgoingUrl.trim()) return
    setTestingOutgoing(true)

    setTimeout(() => {
      setTestingOutgoing(false)
      showToast('Mock Webhook test payload dispatched successfully! Response: 200 OK')
    }, 1200)
  }

  // Counts for status cards
  const connectedCount = aiProviders.filter(p => p.connected).length + socials.filter(s => s.connected).length + platforms.filter(pl => pl.connected).length
  const disconnectedCount = aiProviders.filter(p => !p.connected).length + socials.filter(s => !s.connected).length + platforms.filter(pl => !pl.connected).length

  return (
    <div className="min-h-screen bg-gray-50/50 space-y-6 pb-12">
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
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Plug className="h-4 w-4" />
            </span>
            Integrations Hub
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Connect AI models, social networks, and automation platforms to optimize your workflow.
          </p>
        </div>

        <button
          onClick={handleRefreshSync}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 h-10 px-4 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 text-xs font-bold transition shadow-xs self-start sm:self-center"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          Force Sync All
        </button>
      </div>

      {/* Top Status Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Connected Services</p>
              <p className="mt-1.5 text-2xl font-bold text-emerald-600">{connectedCount}</p>
              <p className="mt-1 text-xs font-medium text-gray-500">Active pipelines online</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 shadow-inner">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Setup Pending / Suspended</p>
              <p className="mt-1.5 text-2xl font-bold text-amber-500">{disconnectedCount}</p>
              <p className="mt-1 text-xs font-medium text-gray-500">Configured bridges offline</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-500 shadow-inner">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Last Synced Status</p>
              <p className="mt-1.5 text-2xl font-bold text-blue-600">{lastSync}</p>
              <p className="mt-1 text-xs font-medium text-gray-500">API health checks operational</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-inner">
              <Activity className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* SECTION 1: AI Providers */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-blue-500" />
            AI LLM Providers
          </h2>

          <div className="space-y-4">
            {aiProviders.map(prov => {
              const Icon = prov.icon
              return (
                <div key={prov.id} className="border border-gray-50 rounded-xl p-4 space-y-3.5 bg-gray-50/20 hover:border-gray-100 transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-3">
                      <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <Icon className="w-4.5 h-4.5" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-xs font-bold text-gray-900 leading-snug">{prov.name}</h3>
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${prov.badgeColor}`}>
                            {prov.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-500 font-medium leading-relaxed mt-0.5">{prov.desc}</p>
                      </div>
                    </div>

                    {/* Toggle Switch */}
                    <button
                      onClick={() => handleToggle('ai', prov.id)}
                      className={`w-9 h-5 rounded-full p-0.5 transition cursor-pointer shrink-0 flex ${prov.connected ? 'bg-emerald-500 justify-end' : 'bg-gray-200 justify-start'}`}
                    >
                      <span className="w-4 h-4 bg-white rounded-full shadow-xs" />
                    </button>
                  </div>

                  {prov.connected && (
                    <div className="grid grid-cols-2 gap-3 border-t border-gray-100/50 pt-3 select-none text-[10px]">
                      <div>
                        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">Target Model</span>
                        <span className="font-semibold text-gray-700">{prov.defaultModel}</span>
                      </div>
                      <div>
                        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">Token Usage (30d)</span>
                        <span className="font-semibold text-gray-700">142,500 tokens</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* SECTION 2: Social Accounts */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1 flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-emerald-500" />
            Connected Networks
          </h2>

          <div className="space-y-4">
            {socials.map(soc => {
              const Icon = soc.icon
              return (
                <div key={soc.id} className="border border-gray-50 rounded-xl p-4 space-y-3.5 bg-gray-50/20 hover:border-gray-100 transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-3">
                      <span className={`w-8 h-8 rounded-lg ${soc.id === 'twitter' ? 'bg-sky-50 text-sky-500' : 'bg-blue-50 text-blue-600'} flex items-center justify-center shrink-0`}>
                        <Icon className="w-4.5 h-4.5" fill={soc.id === 'twitter' ? 'currentColor' : 'none'} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-xs font-bold text-gray-900 leading-snug">{soc.name}</h3>
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${soc.badgeColor}`}>
                            {soc.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-500 font-medium leading-relaxed mt-0.5">{soc.desc}</p>
                      </div>
                    </div>

                    {/* Toggle Switch */}
                    <button
                      onClick={() => handleToggle('social', soc.id)}
                      className={`w-9 h-5 rounded-full p-0.5 transition cursor-pointer shrink-0 flex ${soc.connected ? 'bg-emerald-500 justify-end' : 'bg-gray-200 justify-start'}`}
                    >
                      <span className="w-4 h-4 bg-white rounded-full shadow-xs" />
                    </button>
                  </div>

                  {soc.connected && (
                    <div className="grid grid-cols-2 gap-3 border-t border-gray-100/50 pt-3 select-none text-[10px]">
                      <div>
                        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">Auto-Publish</span>
                        <span className="font-semibold text-emerald-600 flex items-center gap-0.5">Enabled</span>
                      </div>
                      <div>
                        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">OAuth Integration</span>
                        <span className="font-semibold text-gray-700">Verifying tokens</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* SECTION 3: Automation Platforms */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1 flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-orange-500" />
            Automation Workflow Platforms
          </h2>

          <div className="space-y-4">
            {platforms.map(plat => {
              const Icon = plat.icon
              return (
                <div key={plat.id} className="border border-gray-50 rounded-xl p-4 space-y-3.5 bg-gray-50/20 hover:border-gray-100 transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-3">
                      <span className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                        <Icon className="w-4.5 h-4.5" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-xs font-bold text-gray-900 leading-snug">{plat.name}</h3>
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${plat.badgeColor}`}>
                            {plat.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-500 font-medium leading-relaxed mt-0.5">{plat.desc}</p>
                      </div>
                    </div>

                    {/* Toggle Switch */}
                    <button
                      onClick={() => handleToggle('platform', plat.id)}
                      className={`w-9 h-5 rounded-full p-0.5 transition cursor-pointer shrink-0 flex ${plat.connected ? 'bg-emerald-500 justify-end' : 'bg-gray-200 justify-start'}`}
                    >
                      <span className="w-4 h-4 bg-white rounded-full shadow-xs" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* SECTION 4: Webhooks Config */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5 flex flex-col justify-between">
          <div className="space-y-5">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1 flex items-center gap-1.5">
              <Server className="w-4 h-4 text-purple-600" />
              Webhook Triggers
            </h2>

            {/* Incoming Webhook */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block pl-1">Incoming Webhook URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={incomingUrl}
                  className="w-full h-10 px-3 rounded-lg border border-gray-100 text-[10px] font-mono text-gray-500 bg-gray-50 outline-none select-all"
                />
                <button
                  onClick={() => handleCopy(incomingUrl)}
                  className="flex h-10 px-3 items-center justify-center border border-gray-100 hover:bg-gray-50 rounded-lg text-gray-600 cursor-pointer transition shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[8px] text-gray-400 font-medium pl-1 leading-relaxed">Send JSON payloads to trigger immediate automation rules from external systems.</p>
            </div>

            {/* Outgoing Webhook */}
            <form onSubmit={handleTestOutgoing} className="space-y-1.5">
              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block pl-1">Outgoing Webhook (Slack / Discord)</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  required
                  placeholder="Paste target slack/discord hook URL..."
                  value={outgoingUrl}
                  onChange={(e) => setOutgoingUrl(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-gray-100 text-[10px] font-mono text-gray-700 bg-gray-50/50 outline-none focus:border-blue-400 transition"
                />
                <button
                  type="submit"
                  disabled={testingOutgoing}
                  className="flex h-10 px-3.5 items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold cursor-pointer transition shrink-0 shadow-sm"
                >
                  {testingOutgoing ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>Test <ArrowRight className="w-3 h-3 ml-1" /></>
                  )}
                </button>
              </div>
              <p className="text-[8px] text-gray-400 font-medium pl-1 leading-relaxed">Dispatches posting summaries automatically to Slack or custom targets on publishing success.</p>
            </form>
          </div>

          <div className="bg-indigo-50/20 border border-indigo-100/50 p-4 rounded-xl flex gap-2.5 mt-5">
            <Info className="w-4.5 h-4.5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-[9.5px] font-bold text-indigo-900">OAuth Credentials Warning</p>
              <p className="text-[8px] leading-relaxed text-indigo-700 mt-0.5">Integrations currently operate under active sandbox configurations. Direct OAuth endpoints and custom server credentials will apply automatically once keys are entered inside production settings.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
