import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Trash2,
  BadgeCheck,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react'
import { useInstagramAdapter } from '../../platformAdapters/instagramAdapter'

// ── Skeleton (initial load before any account is connected) ────────────────
function CarouselSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-3 w-32 bg-gray-200 rounded animate-pulse" />
      <div className="flex items-center gap-3 overflow-hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="shrink-0 w-[260px] rounded-2xl border border-gray-100 bg-white p-4 animate-pulse"
          >
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-gray-200" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 bg-gray-200 rounded" />
                <div className="h-2 w-16 bg-gray-100 rounded" />
              </div>
            </div>
            <div className="mt-3 flex justify-between">
              <div className="space-y-1.5">
                <div className="h-2 w-12 bg-gray-100 rounded" />
                <div className="h-3 w-16 bg-gray-200 rounded" />
              </div>
              <div className="space-y-1.5">
                <div className="h-2 w-12 bg-gray-100 rounded" />
                <div className="h-3 w-12 bg-gray-200 rounded" />
              </div>
            </div>
            <div className="mt-3 h-4 w-20 bg-gray-100 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Add Account Modal ──────────────────────────────────────────────────────
function AddAccountModal({ open, onClose, onSubmit, submitting, error }) {
  const [username, setUsername] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setUsername('')
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [open])

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = username.trim().replace(/^@+/, '')
    if (!trimmed) return
    onSubmit(trimmed)
  }

  const handleKey = (e) => {
    if (e.key === 'Escape') onClose()
  }

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        key="add-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          key="add-modal-panel"
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-sm mx-4 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKey}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                {/* Instagram camera icon inline SVG */}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                  <circle cx="12" cy="12" r="4"/>
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Add Instagram Account</p>
                <p className="text-[11px] text-gray-500">Enter a public username to start tracking</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Instagram Username
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium select-none">@</span>
                <input
                  ref={inputRef}
                  id="ig-add-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/^@+/, ''))}
                  placeholder="username"
                  disabled={submitting}
                  className="w-full pl-7 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition disabled:opacity-50"
                />
              </div>
              {error && (
                <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {error}
                </p>
              )}
            </div>

            <p className="text-[11px] text-gray-400 leading-relaxed">
              The account must be <strong className="text-gray-600">public</strong>. Analytics sync starts immediately and takes about 30 seconds.
            </p>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 py-2.5 text-xs font-semibold rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                id="ig-add-submit"
                type="submit"
                disabled={submitting || !username.trim()}
                className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Adding…
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    Add Account
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ── Disconnect Confirm Modal ───────────────────────────────────────────────
function DisconnectModal({ open, account, onClose, onConfirm }) {
  if (!open || !account) return null
  return (
    <AnimatePresence>
      <motion.div
        key="disc-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          key="disc-modal-panel"
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-sm mx-4 bg-white rounded-2xl shadow-2xl border border-gray-100 p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-100 text-red-600 shrink-0">
              <Trash2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Disconnect account?</p>
              <p className="text-xs text-gray-500 mt-0.5">@{account.handle?.replace('@', '')}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-5">
            Scheduled posts and queue dispatches will be suspended. You can re-add the account at any time.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 text-xs font-semibold rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              id="ig-disconnect-confirm"
              onClick={onConfirm}
              className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-red-500 text-white hover:bg-red-600 transition"
            >
              Disconnect
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ── Account Card ───────────────────────────────────────────────────────────
function AccountCard({ account, isActive, onSelect, onDisconnect }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24, scale: 0.95 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      onClick={() => onSelect(account.id)}
      className={`group relative shrink-0 w-[260px] rounded-2xl border-2 p-4 cursor-pointer transition-all duration-200 ${
        isActive
          ? 'border-purple-500 bg-purple-50/50 shadow-md shadow-purple-100'
          : 'border-gray-100 bg-white hover:border-purple-200 hover:shadow-sm'
      }`}
    >
      {/* Header: avatar + name + handle */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative shrink-0">
          <img
            src={account.avatar}
            alt={account.name}
            className={`h-11 w-11 rounded-full object-cover ring-2 ring-offset-1 transition-all ${
              isActive ? 'ring-purple-300' : 'ring-gray-100 group-hover:ring-purple-200'
            }`}
          />
          {isActive && (
            <motion.span
              layoutId="active-dot"
              className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-purple-500 border-2 border-white shadow-sm"
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-sm font-semibold text-gray-900 truncate">{account.name}</p>
            {account.verified && (
              <BadgeCheck className="h-3.5 w-3.5 text-blue-500 shrink-0" />
            )}
          </div>
          <p className="text-xs text-gray-500 truncate">{account.handle}</p>
        </div>
      </div>

      {/* Stats row: followers + growth */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[9px] uppercase font-semibold text-gray-400 tracking-wider">Followers</p>
          <p className="text-sm font-bold text-gray-900 tabular-nums">{account.subscribers}</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] uppercase font-semibold text-gray-400 tracking-wider">Growth</p>
          <p
            className={`text-xs font-bold flex items-center justify-end gap-0.5 ${
              account.growthUp ? 'text-emerald-600' : 'text-red-500'
            }`}
          >
            {account.growthUp ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {account.growth}
          </p>
        </div>
      </div>

      {/* Category badge + sync state */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 uppercase tracking-wider">
          {account.category || 'Creator'}
        </span>
        {account.syncStatus === 'syncing' && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
            Syncing
          </span>
        )}
        {account.syncStatus === 'error' && (
          <span
            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200"
            title={account.syncError || 'Sync failed'}
          >
            <AlertCircle className="h-2.5 w-2.5" />
            Sync error
          </span>
        )}
      </div>

      {/* Disconnect (hover only) */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDisconnect(account)
        }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition"
        title="Disconnect"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  )
}

// ── Empty State (replaces placeholder card) ────────────────────────────────
function EmptyState({ onConnect, connecting, error }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-5 rounded-2xl border-2 border-dashed border-purple-200 bg-purple-50/30"
    >
      <div className="flex items-start gap-3 flex-1">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 text-purple-700 shrink-0">
          <AlertCircle className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-bold text-purple-900">No Instagram accounts connected</p>
          <p className="text-xs text-purple-700/80 mt-0.5">
            Add an Instagram account by username to start tracking analytics.
          </p>
          {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
        </div>
      </div>
      <button
        id="ig-add-account-empty"
        onClick={onConnect}
        disabled={connecting}
        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm shrink-0"
      >
        <Plus className="h-3.5 w-3.5" />
        {connecting ? 'Adding…' : 'Add Account'}
      </button>
    </motion.div>
  )
}

// ── Main Carousel ──────────────────────────────────────────────────────────
export default function AccountCarousel() {
  const {
    accounts,
    selectedAccount,
    setActiveAccount,
    removeAccount,
    addAccount,
    loading,
  } = useInstagramAdapter()

  const [showAddModal, setShowAddModal] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [addError, setAddError] = useState('')

  const [showDiscModal, setShowDiscModal] = useState(false)
  const [pendingDisconnect, setPendingDisconnect] = useState(null)

  // Exclude generic demo/fallback placeholders — only show real connected accounts
  const realAccounts = accounts.filter(
    (a) =>
      a.id !== 'demo_ig' &&
      a.id !== 'demo' &&
      a.id !== 'demo_tt' &&
      a.id !== 'demo_li'
  )

  const activeId = selectedAccount?.id

  // ── Add Account ───────────────────────────────────────────────────────
  const openAddModal = () => {
    setAddError('')
    setShowAddModal(true)
  }

  const handleAddSubmit = async (username) => {
    setConnecting(true)
    setAddError('')
    try {
      await addAccount(username)
      setShowAddModal(false)
    } catch (err) {
      setAddError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          err.message ||
          'Failed to add Instagram account'
      )
    } finally {
      setConnecting(false)
    }
  }

  // ── Disconnect Account ────────────────────────────────────────────────
  const handleDisconnectRequest = (account) => {
    setPendingDisconnect(account)
    setShowDiscModal(true)
  }

  const handleDisconnectConfirm = async () => {
    if (!pendingDisconnect) return
    setShowDiscModal(false)
    try {
      await removeAccount(pendingDisconnect.id)
    } catch {
      // silently — nothing actionable here
    } finally {
      setPendingDisconnect(null)
    }
  }

  // Skeleton state — only on initial load (no real accounts AND adapter is loading)
  if (loading && realAccounts.length === 0) {
    return <CarouselSkeleton />
  }

  return (
    <>
      {/* ── Add Account Modal ── */}
      <AddAccountModal
        open={showAddModal}
        onClose={() => !connecting && setShowAddModal(false)}
        onSubmit={handleAddSubmit}
        submitting={connecting}
        error={addError}
      />

      {/* ── Disconnect Confirm Modal ── */}
      <DisconnectModal
        open={showDiscModal}
        account={pendingDisconnect}
        onClose={() => setShowDiscModal(false)}
        onConfirm={handleDisconnectConfirm}
      />

      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Connected Accounts</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {realAccounts.length === 0
                ? 'Connect your first Instagram account to begin.'
                : `${realAccounts.length} account${realAccounts.length === 1 ? '' : 's'} connected · click to switch`}
            </p>
          </div>
          {realAccounts.length > 0 && (
            <button
              id="ig-add-account-header"
              onClick={openAddModal}
              disabled={connecting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              {connecting ? 'Adding…' : 'Add'}
            </button>
          )}
        </div>

        {/* Body */}
        {realAccounts.length === 0 ? (
          <EmptyState onConnect={openAddModal} connecting={connecting} error={addError} />
        ) : (
          <div className="flex items-center gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
            <AnimatePresence mode="popLayout" initial={false}>
              {realAccounts.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  isActive={account.id === activeId}
                  onSelect={setActiveAccount}
                  onDisconnect={handleDisconnectRequest}
                />
              ))}
            </AnimatePresence>

            {/* Inline add-new affordance */}
            <motion.button
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              onClick={openAddModal}
              disabled={connecting}
              id="ig-add-account-inline"
              className="group shrink-0 w-[160px] min-h-[160px] rounded-2xl border-2 border-dashed border-gray-200 hover:border-purple-300 hover:bg-purple-50/30 flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 snap-start"
              title="Add another Instagram account"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 group-hover:bg-purple-100 transition-colors">
                <Plus className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold">
                {connecting ? 'Adding…' : 'Add New'}
              </span>
            </motion.button>
          </div>
        )}

        {addError && realAccounts.length > 0 && !showAddModal && (
          <p className="text-xs text-red-500 px-1">{addError}</p>
        )}
      </div>
    </>
  )
}
