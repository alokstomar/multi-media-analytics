import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  CheckCircle,
  Clock,
  Plus,
  Trash2,
  TrendingUp,
  Activity,
  Award,
  RefreshCw,
  AlertCircle,
  Search,
  Filter
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  getInstagramAccounts,
  getInstagramAuthUrl,
  deleteInstagramAccount,
  refreshInstagramToken
} from '../services/api'

const InstagramIcon = (props) => (
  <svg
    className={props.className || "h-4 w-4"}
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
  </svg>
)

export default function InstagramAccounts() {
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(false)
  const [successToast, setSuccessToast] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const filteredAccounts = accounts.filter((acc) => {
    const q = search.toLowerCase()
    const matchSearch = (acc.displayName || '').toLowerCase().includes(q) ||
      (acc.username || '').toLowerCase().includes(q) ||
      (acc.instagramUserId || '').toLowerCase().includes(q)
    
    if (filter === 'active') return matchSearch && acc.connectionStatus === 'active'
    if (filter === 'expired') return matchSearch && acc.connectionStatus !== 'active'
    return matchSearch
  })

  const showToast = (msg) => {
    setSuccessToast(msg)
    setTimeout(() => setSuccessToast(''), 3000)
  }

  // Load connected accounts from DB
  const loadAccounts = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await getInstagramAccounts()
      if (res?.success) {
        setAccounts(res.data || [])
      } else {
        setAccounts([])
      }
    } catch (err) {
      console.error('Failed to load Instagram accounts:', err)
      showToast('Error loading connected accounts.')
      setAccounts([])
    } finally {
      setLoading(false)
    }
  }

  // Initialize and check redirect parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const connected = params.get('connected')
    const error = params.get('error')

    if (connected === 'true') {
      showToast('Successfully connected Instagram account!')
      window.history.replaceState({}, document.title, window.location.pathname)
    } else if (error) {
      showToast(`Connection failed: ${decodeURIComponent(error)}`)
      window.history.replaceState({}, document.title, window.location.pathname)
    }

    loadAccounts()
  }, [])

  // Trigger Facebook Login / Instagram OAuth flow
  const handleConnectAccount = async () => {
    setLoading(true)
    try {
      const res = await getInstagramAuthUrl()
      if (res?.success && res.data?.authUrl) {
        window.location.href = res.data.authUrl
      } else {
        showToast('Failed to retrieve authorization URL.')
      }
    } catch (err) {
      console.error('Instagram OAuth URL error:', err)
      showToast('Error connecting Instagram account.')
    } finally {
      setLoading(false)
    }
  }

  // Refresh expired/disconnected tokens manually
  const handleRefreshToken = async (id) => {
    setLoading(true)
    try {
      const res = await refreshInstagramToken(id)
      if (res?.success) {
        showToast('Access token extended successfully!')
        await loadAccounts(true)
      } else {
        showToast('Failed to refresh token.')
      }
    } catch (err) {
      console.error('Refresh token error:', err)
      showToast('Error refreshing token.')
    } finally {
      setLoading(false)
    }
  }

  // Disconnect account
  const handleDisconnect = async (id) => {
    if (!window.confirm('Are you sure you want to disconnect this Instagram account? Scheduled posts and queue dispatches will be suspended.')) {
      return
    }

    setLoading(true)
    try {
      const res = await deleteInstagramAccount(id)
      if (res?.success) {
        showToast('Account disconnected successfully!')
        await loadAccounts(true)
      } else {
        showToast('Failed to disconnect account.')
      }
    } catch (err) {
      console.error('Disconnect error:', err)
      showToast('Error disconnecting account.')
    } finally {
      setLoading(false)
    }
  }

  // Calculations
  const activeCount = accounts.filter(a => a.connectionStatus === 'active').length
  const totalFollowers = accounts.reduce((sum, a) => sum + (a.followers || 0), 0)

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
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-md shadow-purple-100">
              <InstagramIcon className="h-4.5 w-4.5" />
            </span>
            Instagram Connections
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Connect Meta-authorized Instagram Creator and Business accounts to schedule content dispatches.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search accounts..."
              className="w-44 rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 transition h-10 shadow-sm"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="appearance-none rounded-xl border border-gray-200 bg-white pl-9 pr-8 text-xs text-gray-600 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 transition cursor-pointer h-10 shadow-sm"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="expired">Re-auth needed</option>
            </select>
          </div>

          <button
            onClick={() => loadAccounts()}
            disabled={loading}
            className="flex h-10 w-10 items-center justify-center border border-gray-100 hover:bg-gray-50 text-gray-600 rounded-xl cursor-pointer transition shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          
          <button
            onClick={handleConnectAccount}
            disabled={loading}
            className="flex h-10 px-5 items-center gap-1.5 bg-gradient-to-r from-purple-600 to-purple-700 hover:opacity-90 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Connect Professional Account
          </button>
        </div>
      </div>

      {/* Connection metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active Connections</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{activeCount}</p>
              <p className="mt-1 text-xs font-medium text-emerald-600 flex items-center gap-0.5">
                <CheckCircle className="w-3 h-3 text-emerald-600" /> API integration verified
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 shadow-inner">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Followers Reach</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{totalFollowers.toLocaleString()}</p>
              <p className="mt-1 text-xs font-medium text-emerald-600 flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" /> Audience footprint
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 shadow-inner">
              <Award className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Scope Capabilities</p>
              <p className="mt-1.5 text-2xl font-bold text-indigo-600">Publish-Ready</p>
              <p className="mt-1 text-xs font-medium text-indigo-600">Direct Publishing &amp; Insights</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 shadow-inner">
              <Activity className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Main integration list */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        {accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-50 text-purple-600">
              <InstagramIcon className="w-8 h-8" />
            </div>
            <div className="max-w-xs space-y-1.5">
              <h3 className="text-sm font-bold text-gray-800">No Instagram integrations connected</h3>
              <p className="text-xs text-gray-400">
                Connect your Meta-authorized Instagram Creator or Business Account to enable scheduling and auto-publishing features.
              </p>
            </div>
            <button
              onClick={handleConnectAccount}
              className="flex h-9 px-4 items-center gap-1 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl text-xs font-bold hover:opacity-95 transition cursor-pointer"
            >
              Connect Account
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <th className="pb-3.5 pl-2">Professional Creator</th>
                  <th className="pb-3.5">Instagram URN ID</th>
                  <th className="pb-3.5">Followers</th>
                  <th className="pb-3.5">Connected On</th>
                  <th className="pb-3.5">Status</th>
                  <th className="pb-3.5 pr-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-xs font-semibold text-gray-700">
                {accounts.map((acc) => {
                  const status = acc.connectionStatus
                  const isExpired = status === 'expired' || status === 'error'
                  
                  return (
                    <tr key={acc._id} className="hover:bg-gray-50/20 transition">
                      <td className="py-4 pl-2">
                        <div className="flex items-center gap-3">
                          <img
                            src={acc.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(acc.displayName || 'IG')}&background=8B5CF6&color=fff`}
                            alt={acc.displayName}
                            className="w-10 h-10 rounded-full object-cover ring-1 ring-gray-100"
                          />
                          <div>
                            <p className="font-bold text-gray-900">{acc.displayName || 'Instagram Creator'}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5 font-medium">{acc.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 font-mono text-[10px] text-gray-500 select-all">
                        {acc.instagramUserId || 'N/A'}
                      </td>
                      <td className="py-4 font-bold text-gray-600">
                        {(acc.followers || 0).toLocaleString()}
                      </td>
                      <td className="py-4 text-gray-500 font-semibold">
                        {new Date(acc.connectedAt || acc.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-4">
                        <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          status === 'active'
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                            : 'bg-red-50 text-red-600 border border-red-100'
                        }`}>
                          {status === 'active' ? 'Active' : 'Re-auth'}
                        </span>
                      </td>
                      <td className="py-4 pr-2 text-right">
                        <div className="flex justify-end gap-1.5">
                          {isExpired && (
                            <button
                              onClick={() => handleRefreshToken(acc._id)}
                              className="flex h-7 px-2.5 items-center gap-1 hover:bg-emerald-50 text-emerald-600 border border-transparent hover:border-emerald-100 rounded-lg cursor-pointer transition"
                              title="Re-authorize access tokens"
                            >
                              <RefreshCw className="w-3 h-3" />
                              Re-authorize
                            </button>
                          )}
                          {!isExpired && (
                            <button
                              onClick={() => handleRefreshToken(acc._id)}
                              className="flex h-7 w-7 items-center justify-center hover:bg-gray-50 text-gray-500 border border-transparent hover:border-gray-100 rounded-lg cursor-pointer transition"
                              title="Refresh OAuth Tokens"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDisconnect(acc._id)}
                            className="flex h-7 w-7 items-center justify-center hover:bg-red-50 text-red-500 border border-transparent hover:border-red-100 rounded-lg cursor-pointer transition"
                            title="Disconnect Connection"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Health / FAQ Info */}
      <div className="bg-indigo-50/20 border border-indigo-100/50 rounded-2xl p-5 shadow-inner flex gap-3.5 items-start">
        <AlertCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-indigo-900">Meta Graph API Publishing Scope Requirements</h4>
          <p className="text-[10px] text-indigo-700 leading-relaxed font-medium">
            Instagram direct auto-publishing requires a **Professional Creator or Business Account** connected to an active Facebook Page. The connected user must have administrator permissions over the target Facebook Page in Meta Business Suite.
          </p>
        </div>
      </div>
    </div>
  )
}
