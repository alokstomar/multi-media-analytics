import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Trash2,
  BadgeCheck,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Loader2,
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

  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')

  // Exclude generic demo/fallback placeholders — only show real connected accounts
  const realAccounts = accounts.filter(
    (a) =>
      a.id !== 'demo_ig' &&
      a.id !== 'demo' &&
      a.id !== 'demo_tt' &&
      a.id !== 'demo_li'
  )

  const activeId = selectedAccount?.id

  const handleConnect = async () => {
    const username = window.prompt('Enter Instagram username to add (e.g. nike):')
    if (!username || !username.trim()) return
    setConnecting(true)
    setError('')
    try {
      await addAccount(username.trim())
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          err.message ||
          'Failed to add Instagram account'
      )
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async (account) => {
    if (
      !window.confirm(
        `Disconnect ${account.name}?\nScheduled posts and queue dispatches will be suspended.`
      )
    )
      return
    try {
      await removeAccount(account.id)
    } catch (err) {
      alert('Failed to disconnect account')
    }
  }

  // Skeleton state — only on initial load (no real accounts AND adapter is loading)
  if (loading && realAccounts.length === 0) {
    return <CarouselSkeleton />
  }

  return (
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
            onClick={handleConnect}
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
        <EmptyState onConnect={handleConnect} connecting={connecting} error={error} />
      ) : (
        <div className="flex items-center gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
          <AnimatePresence mode="popLayout" initial={false}>
            {realAccounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                isActive={account.id === activeId}
                onSelect={setActiveAccount}
                onDisconnect={handleDisconnect}
              />
            ))}
          </AnimatePresence>

          {/* Inline add-new affordance (real button, not a placeholder card) */}
          <motion.button
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            onClick={handleConnect}
            disabled={connecting}
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

      {error && realAccounts.length > 0 && (
        <p className="text-xs text-red-500 px-1">{error}</p>
      )}
    </div>
  )
}
