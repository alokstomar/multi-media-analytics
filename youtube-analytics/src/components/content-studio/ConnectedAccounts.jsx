import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link2, Globe, MessageCircle, Plus, Unplug, CheckCircle, AlertCircle } from 'lucide-react'
import { getConnectedAccounts, connectAccount, disconnectAccount } from '../../services/api'

const PLATFORMS = [
  { id: 'linkedin', name: 'LinkedIn', icon: Globe, color: 'bg-blue-50 text-blue-600 border-blue-100', desc: 'Connect your LinkedIn profile or page' },
  { id: 'twitter', name: 'Twitter / X', icon: MessageCircle, color: 'bg-sky-50 text-sky-500 border-sky-100', desc: 'Connect your Twitter account' },
]

export default function ConnectedAccounts() {
  const [isOpen, setIsOpen] = useState(false)
  const [accounts, setAccounts] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [connecting, setConnecting] = useState(null)

  useEffect(() => {
    if (isOpen) loadAccounts()
  }, [isOpen])

  const loadAccounts = async () => {
    setIsLoading(true)
    try {
      const res = await getConnectedAccounts()
      setAccounts(res?.data || [])
    } catch {
      setAccounts([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleConnect = async (platform) => {
    setConnecting(platform)
    try {
      await connectAccount({
        platform,
        platformAccountId: `demo_${platform}_${Date.now()}`,
        displayName: `Demo ${platform.charAt(0).toUpperCase() + platform.slice(1)} Account`,
        connected: true,
        accountType: 'profile',
        config: { autoPublish: false, defaultTone: 'professional' },
      })
      await loadAccounts()
    } catch { /* non-blocking */ }
    setConnecting(null)
  }

  const handleDisconnect = async (id) => {
    try {
      await disconnectAccount(id)
      setAccounts(accounts.filter(a => a._id !== id))
    } catch { /* non-blocking */ }
  }

  const isConnected = (platform) => accounts.some(a => a.platform === platform && a.connected)

  return (
    <div className="rounded-[20px] border border-gray-100 bg-white overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-5 flex items-center justify-between bg-white hover:bg-gray-50/30 transition-colors text-left focus:outline-none"
      >
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Link2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-[17px] font-bold text-gray-900 tracking-tight">Connected Accounts</h2>
            <p className="text-[12px] text-gray-500 mt-0.5 font-medium">Manage LinkedIn and Twitter/X integrations for direct publishing</p>
          </div>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gray-50 text-gray-400 border border-gray-100 hover:text-gray-600 transition-colors">
          {isOpen ? <span className="text-sm">&#9650;</span> : <span className="text-sm">&#9660;</span>}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="p-6 pt-3 border-t border-gray-50 space-y-5 bg-gray-50">
              {isLoading ? (
                <div className="py-8 flex items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-3 border-indigo-100 border-t-indigo-600" />
                </div>
              ) : (
                <div className="space-y-3">
                  {PLATFORMS.map((plat) => {
                    const Icon = plat.icon
                    const connected = isConnected(plat.id)
                    const account = accounts.find(a => a.platform === plat.id)

                    return (
                      <div key={plat.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3.5">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${plat.color}`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-[13px] font-bold text-gray-900">{plat.name}</p>
                              <p className="text-[11px] text-gray-400 font-medium">{plat.desc}</p>
                            </div>
                          </div>

                          {connected ? (
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
                                <CheckCircle className="h-3.5 w-3.5" />
                                Connected
                              </div>
                              <button
                                onClick={() => handleDisconnect(account._id)}
                                className="flex items-center gap-1.5 text-[10px] font-bold text-red-500 bg-red-50 px-2.5 py-1.5 rounded-lg border border-red-100 hover:bg-red-100/50 transition cursor-pointer"
                              >
                                <Unplug className="h-3 w-3" />
                                Disconnect
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleConnect(plat.id)}
                              disabled={connecting === plat.id}
                              className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 bg-indigo-50 px-3.5 py-2 rounded-xl border border-indigo-100 hover:bg-indigo-100/50 transition cursor-pointer disabled:opacity-50"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              {connecting === plat.id ? 'Connecting...' : 'Connect'}
                            </button>
                          )}
                        </div>

                        {connected && account && (
                          <div className="mt-3 pt-3 border-t border-gray-50 flex items-center gap-2">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Account:</span>
                            <span className="text-[11px] font-semibold text-gray-700">{account.displayName}</span>
                            <span className="text-[10px] font-semibold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{account.accountType}</span>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  <div className="bg-indigo-50/20 border border-indigo-100/30 rounded-2xl p-4 flex items-start gap-3">
                    <AlertCircle className="h-4 w-4 text-indigo-500 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-[12px] font-bold text-indigo-900">Integration Status</h4>
                      <p className="text-[10px] text-gray-600 font-semibold leading-relaxed mt-0.5">Platform connections use a preparation layer. Full OAuth integration and direct publishing will be available when API credentials are configured in the backend.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
