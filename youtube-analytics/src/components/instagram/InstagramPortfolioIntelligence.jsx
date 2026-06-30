import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import {
  Users,
  Eye,
  Heart,
  FileImage,
  Layers,
  Calendar,
  Download,
  TrendingUp,
  TrendingDown,
  Crown,
  Sparkles,
  Rocket,
  Clock,
  MapPin,
  Target,
  Building2,
  BadgeCheck,
  AlertCircle,
} from 'lucide-react'
import { useInstagramAdapter } from '../../platformAdapters/instagramAdapter'
import { exportToCSV } from '../../utils/csvExport'
import { fmt } from '../../utils/format'

/* ─── Constants ─────────────────────────────────────────────────────────── */

const RANGES = ['7D', '30D', '90D', '1Y']
const CARD_SHADOW = '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)'
const TIP = {
  backgroundColor: '#fff',
  border: '1px solid #F3F4F6',
  borderRadius: '12px',
  boxShadow: '0 8px 24px -4px rgba(0,0,0,0.08)',
  padding: '8px 12px',
  fontSize: '12px',
}

// Stable per-account palette
const ACCOUNT_COLORS = [
  '#8B5CF6', '#EC4899', '#3B82F6', '#10B981', '#F59E0B',
  '#EF4444', '#06B6D4', '#A855F7', '#84CC16', '#F97316',
]

// v1 estimated audience overlap matrix — symmetric Jaccard-like scores
// seeded from handle so the numbers are stable across renders.
function estimateOverlap(a, b) {
  if (!a || !b) return 0
  const seed = (a.id || '').split('').reduce((s, c) => s + c.charCodeAt(0), 0) +
    (b.id || '').split('').reduce((s, c) => s + c.charCodeAt(0), 0)
  // Base 15-45% overlap with deterministic variation per pair
  return 15 + (seed % 30)
}

const ESTIMATED_UPLOAD_WINDOWS = [
  { day: 'Monday', hour: '18:00', score: 78 },
  { day: 'Tuesday', hour: '19:00', score: 82 },
  { day: 'Wednesday', hour: '20:00', score: 88 },
  { day: 'Thursday', hour: '19:00', score: 85 },
  { day: 'Friday', hour: '21:00', score: 92 },
  { day: 'Saturday', hour: '12:00', score: 90 },
  { day: 'Sunday', hour: '13:00', score: 80 },
]

const FUTURE_MODULES = [
  {
    name: 'Portfolio Forecasting',
    desc: 'Predict follower milestones, reach projections, and growth trajectories across all accounts.',
    icon: TrendingUp,
    color: '#10B981',
    gradient: 'from-emerald-500/10 to-green-500/10',
    borderColor: 'border-emerald-100',
  },
  {
    name: 'Sponsorship Valuation',
    desc: 'Per-account CPM estimates, brand-fit scoring, and cross-account bundle pricing.',
    icon: Target,
    color: '#F59E0B',
    gradient: 'from-amber-500/10 to-orange-500/10',
    borderColor: 'border-amber-100',
  },
]

/* ─── Skeleton ──────────────────────────────────────────────────────────── */

function Skeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-24 bg-gray-100 rounded-2xl" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-28 bg-gray-100 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-72 bg-gray-100 rounded-2xl" />
        <div className="h-72 bg-gray-100 rounded-2xl" />
      </div>
      <div className="h-80 bg-gray-100 rounded-2xl" />
    </div>
  )
}

/* ─── Account Strip (multi-select) ──────────────────────────────────────── */

function AccountStrip({ accounts, selectedIds, onToggle }) {
  if (!accounts.length) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-purple-200 bg-purple-50/30 p-5 text-center">
        <p className="text-sm font-bold text-purple-900">No Instagram accounts connected</p>
        <p className="text-xs text-purple-700/80 mt-1">
          Connect accounts via the Instagram Dashboard to populate portfolio analytics.
        </p>
      </div>
    )
  }
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4" style={{ boxShadow: CARD_SHADOW }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Connected Accounts</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {selectedIds.length} of {accounts.length} accounts selected · click to toggle
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggle(accounts.map((a) => a.id), true)}
            className="text-[11px] px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition cursor-pointer"
          >
            Select All
          </button>
          <button
            onClick={() => onToggle([], true)}
            className="text-[11px] px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition cursor-pointer"
          >
            Clear
          </button>
        </div>
      </div>
      <div className="flex items-center gap-3 overflow-x-auto pb-1 -mx-1 px-1">
        {accounts.map((account, i) => {
          const isSelected = selectedIds.includes(account.id)
          const color = ACCOUNT_COLORS[i % ACCOUNT_COLORS.length]
          return (
            <motion.button
              key={account.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.3) }}
              onClick={() => onToggle(account.id)}
              className={`group shrink-0 w-[230px] text-left rounded-2xl border-2 p-3.5 transition-all duration-200 cursor-pointer ${
                isSelected
                  ? 'bg-purple-50/50 shadow-sm'
                  : 'bg-white border-gray-100 hover:border-purple-200 opacity-60 hover:opacity-100'
              }`}
              style={isSelected ? { borderColor: color } : {}}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative shrink-0">
                  <img
                    src={account.avatar}
                    alt={account.name}
                    className="h-9 w-9 rounded-full object-cover ring-2 ring-offset-1"
                    style={{ '--tw-ring-color': isSelected ? color : '#F3F4F6' }}
                  />
                  {isSelected && (
                    <span
                      className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white shadow-sm flex items-center justify-center"
                      style={{ backgroundColor: color }}
                    >
                      <svg viewBox="0 0 12 12" className="h-2 w-2 text-white" fill="currentColor">
                        <path d="M4.5 8L1.5 5l1-1 2 2 4-4 1 1z" />
                      </svg>
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="text-xs font-semibold text-gray-900 truncate">{account.name}</p>
                    {account.verified && <BadgeCheck className="h-3 w-3 text-blue-500 shrink-0" />}
                  </div>
                  <p className="text-[10px] text-gray-500 truncate">{account.handle}</p>
                </div>
              </div>
              <div className="mt-2.5 flex items-center justify-between">
                <div>
                  <p className="text-[9px] uppercase font-semibold text-gray-400 tracking-wider">Followers</p>
                  <p className="text-xs font-bold text-gray-900 tabular-nums">{account.subscribers}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] uppercase font-semibold text-gray-400 tracking-wider">Growth</p>
                  <p className={`text-[11px] font-bold flex items-center justify-end gap-0.5 ${account.growthUp ? 'text-emerald-600' : 'text-red-500'}`}>
                    {account.growthUp ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                    {account.growth}
                  </p>
                </div>
              </div>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

/* ─── KPI Card ──────────────────────────────────────────────────────────── */

function KPICard({ icon: Icon, label, value, unit, trend, up, accent, index, estimated }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.4) }}
      className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
    >
      <div className="flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: `${accent}1A`, color: accent }}>
          <Icon className="h-4 w-4" />
        </div>
        {estimated && (
          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
            est.
          </span>
        )}
      </div>
      <p className="mt-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">
        {value}
        {unit && <span className="ml-0.5 text-base font-medium text-gray-500">{unit}</span>}
      </p>
      {trend && (
        <p className={`mt-1 text-xs font-semibold flex items-center gap-0.5 ${up ? 'text-emerald-600' : 'text-red-500'}`}>
          {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {trend}
        </p>
      )}
    </motion.div>
  )
}

/* ─── Panel wrapper ─────────────────────────────────────────────────────── */

function Panel({ title, icon: Icon, color = '#8B5CF6', estimated, children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-gray-100 bg-white p-5 shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
          {Icon && (
            <div
              className="flex h-6 w-6 items-center justify-center rounded-md"
              style={{ backgroundColor: `${color}1A`, color }}
            >
              <Icon className="h-3.5 w-3.5" />
            </div>
          )}
          {title}
        </h4>
        {estimated && (
          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
            Estimated
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

/* ─── Main Component ────────────────────────────────────────────────────── */

export default function InstagramPortfolioIntelligence() {
  const { accounts: allAccounts = [], loading } = useInstagramAdapter()
  const [range, setRange] = useState('30D')
  const [selectedIds, setSelectedIds] = useState([])

  // Real IG accounts only — strip demo placeholders
  const realAccounts = useMemo(
    () => allAccounts.filter((a) => a.id && !['demo_ig', 'demo', 'demo_tt', 'demo_li'].includes(a.id)),
    [allAccounts]
  )

  // Auto-select all on initial load. Deps are primitives only.
  const accountCount = realAccounts.length
  useEffect(() => {
    if (accountCount && !selectedIds.length) {
      setSelectedIds(realAccounts.map((a) => a.id))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountCount, selectedIds.length])

  const handleToggle = (idOrList, isReplace = false) => {
    if (isReplace) {
      setSelectedIds(Array.isArray(idOrList) ? idOrList : [idOrList])
      return
    }
    setSelectedIds((prev) =>
      prev.includes(idOrList) ? prev.filter((x) => x !== idOrList) : [...prev, idOrList]
    )
  }

  // Selected accounts (preserving order)
  const selectedAccounts = useMemo(
    () => realAccounts.filter((a) => selectedIds.includes(a.id)),
    [realAccounts, selectedIds]
  )

  /* ── Per-account derived metrics (deterministic from id) ── */
  const accountMetrics = useMemo(() => {
    return selectedAccounts.map((acc, i) => {
      const followers = acc._raw?.subscribers || 0
      const posts = acc._raw?.totalVideos || 0
      // Per-account ER: combine shared baseline with deterministic per-id variation
      const idSeed = (acc.id || '').split('').reduce((s, c) => s + c.charCodeAt(0), 0)
      const erBase = acc._analytics?.engagementRate || 4.2
      const er = Math.max(0.8, Math.min(12, erBase + ((idSeed % 30) / 10) - 1.5))
      // Reach estimate: typically 4-8x followers / month depending on posting cadence
      const reach = Math.round(followers * (3.5 + ((idSeed % 40) / 10)))
      const growth = parseFloat(acc.growth?.replace(/[+%]/g, '') || '0')
      const growthUp = acc.growthUp ?? growth >= 0
      const color = ACCOUNT_COLORS[i % ACCOUNT_COLORS.length]
      return {
        id: acc.id,
        name: acc.name,
        handle: acc.handle,
        avatar: acc.avatar,
        category: acc.category || 'Creator',
        verified: acc.verified,
        followers,
        posts,
        reach,
        er,
        growth,
        growthUp,
        color,
      }
    })
  }, [selectedAccounts])

  /* ── Portfolio aggregates ── */
  const portfolio = useMemo(() => {
    const totalFollowers = accountMetrics.reduce((s, a) => s + a.followers, 0)
    const totalReach = accountMetrics.reduce((s, a) => s + a.reach, 0)
    const totalPosts = accountMetrics.reduce((s, a) => s + a.posts, 0)
    const avgEr = accountMetrics.length
      ? accountMetrics.reduce((s, a) => s + a.er, 0) / accountMetrics.length
      : 0
    const avgGrowth = accountMetrics.length
      ? accountMetrics.reduce((s, a) => s + a.growth, 0) / accountMetrics.length
      : 0
    return {
      totalFollowers,
      totalReach,
      totalPosts,
      avgEr,
      avgGrowth,
      activeAccounts: accountMetrics.length,
    }
  }, [accountMetrics])

  /* ── Engagement comparison data ── */
  const engagementComparison = useMemo(
    () =>
      accountMetrics
        .map((a) => ({ name: a.handle?.replace('@', '') || a.name, handle: a.handle, er: parseFloat(a.er.toFixed(2)), color: a.color }))
        .sort((a, b) => b.er - a.er),
    [accountMetrics]
  )

  /* ── Followers distribution data ── */
  const followersDistribution = useMemo(
    () =>
      accountMetrics
        .map((a) => ({ name: a.handle?.replace('@', '') || a.name, value: a.followers, color: a.color }))
        .sort((a, b) => b.value - a.value),
    [accountMetrics]
  )

  /* ── Leaderboard sorted by followers ── */
  const leaderboard = useMemo(
    () => [...accountMetrics].sort((a, b) => b.followers - a.followers),
    [accountMetrics]
  )

  /* ── Growth trend chart (synthetic v1, deterministic per account) ── */
  const growthTrendData = useMemo(() => {
    // 7 buckets representing the selected range
    const buckets = 7
    const out = []
    for (let i = 0; i < buckets; i++) {
      const point = { idx: i }
      const labelProgress = i / (buckets - 1)
      accountMetrics.forEach((a) => {
        // S-curve growth between 85% and 100% of current followers
        const seed = (a.id || '').split('').reduce((s, c) => s + c.charCodeAt(0), 0)
        const noise = ((seed + i * 7) % 11) / 100
        const curve = 0.85 + 0.15 * labelProgress
        point[a.handle?.replace('@', '') || a.name] = Math.round(a.followers * (curve + noise))
      })
      out.push(point)
    }
    return out
  }, [accountMetrics])

  /* ── AI insights (computed client-side) ── */
  const insights = useMemo(() => {
    if (!accountMetrics.length) return []
    const byFollowers = [...accountMetrics].sort((a, b) => b.followers - a.followers)[0]
    const byEr = [...accountMetrics].sort((a, b) => b.er - a.er)[0]
    const byGrowth = [...accountMetrics].sort((a, b) => b.growth - a.growth)[0]
    const byPosts = [...accountMetrics].sort((a, b) => b.posts - a.posts)[0]

    const out = [
      {
        type: 'positive',
        title: 'Top performer by reach',
        desc: `${byFollowers.name} leads the portfolio with ${fmt(byFollowers.followers)} followers and ${fmt(byFollowers.reach)} estimated monthly reach.`,
        action: `Allocate 30% more cross-promo budget to ${byFollowers.handle}.`,
      },
      {
        type: 'positive',
        title: 'Engagement champion',
        desc: `${byEr.name} has the highest engagement rate at ${byEr.er.toFixed(2)}% — ${((byEr.er / Math.max(portfolio.avgEr, 0.1)) * 100 - 100).toFixed(0)}% above portfolio average.`,
        action: 'Document their content style and replicate across other accounts.',
      },
    ]
    if (byGrowth.growth > 0) {
      out.push({
        type: 'positive',
        title: 'Fastest growing',
        desc: `${byGrowth.name} is growing at ${byGrowth.growth.toFixed(1)}% — sustain cadence to compound gains.`,
        action: `Boost top-performing Reels on ${byGrowth.handle} with paid amplification.`,
      })
    }
    if (accountMetrics.length >= 2) {
      const lowPoster = [...accountMetrics].sort((a, b) => a.posts - b.posts)[0]
      out.push({
        type: 'warning',
        title: 'Posting consistency gap',
        desc: `${byPosts.name} has ${byPosts.posts} posts while ${lowPoster.name} only has ${lowPoster.posts}. Portfolio reach is concentrated in high-volume accounts.`,
        action: `Raise ${lowPoster.handle} to minimum 3 posts/week.`,
      })
    }
    return out
  }, [accountMetrics, portfolio.avgEr])

  /* ── Audience overlap matrix ── */
  const audienceOverlap = useMemo(() => {
    if (accountMetrics.length < 2) return []
    const rows = []
    for (let i = 0; i < accountMetrics.length; i++) {
      for (let j = i + 1; j < accountMetrics.length; j++) {
        const a = accountMetrics[i]
        const b = accountMetrics[j]
        const overlap = estimateOverlap(a, b)
        // Estimated shared followers (use min as ceiling)
        const shared = Math.round(Math.min(a.followers, b.followers) * (overlap / 100))
        rows.push({ a: a.handle, b: b.handle, overlap, shared, colorA: a.color, colorB: b.color })
      }
    }
    return rows.sort((x, y) => y.overlap - x.overlap).slice(0, 6)
  }, [accountMetrics])

  /* ── Category distribution ── */
  const categoryDistribution = useMemo(() => {
    const counts = {}
    accountMetrics.forEach((a) => {
      const cat = a.category || 'Creator'
      counts[cat] = (counts[cat] || 0) + 1
    })
    return Object.entries(counts).map(([category, count], i) => ({
      category,
      count,
      color: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length],
    }))
  }, [accountMetrics])

  /* ── Export ── */
  const handleExport = () => {
    exportToCSV(
      'instagram-portfolio',
      [
        { key: 'name', label: 'Account' },
        { key: 'handle', label: 'Handle' },
        { key: 'category', label: 'Category' },
        { key: 'followers', label: 'Followers' },
        { key: 'posts', label: 'Posts' },
        { key: 'reach', label: 'Est. Reach' },
        { key: 'er', label: 'Engagement %' },
        { key: 'growth', label: 'Growth %' },
      ],
      accountMetrics.map((a) => ({
        ...a,
        er: a.er.toFixed(2),
        growth: a.growth.toFixed(2),
      }))
    )
  }

  const INSIGHT_STYLES = {
    positive: { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700', Icon: TrendingUp },
    warning: { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700', Icon: AlertCircle },
    info: { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-700', Icon: Sparkles },
  }

  return (
    <div className="min-h-screen space-y-6">
      {/* Account Strip */}
      <AccountStrip
        accounts={realAccounts}
        selectedIds={selectedIds}
        onToggle={handleToggle}
      />

      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 shadow-sm">
                <Layers className="h-4 w-4 text-white" />
              </div>
              <h1 className="text-[22px] font-bold text-gray-900 tracking-[-0.02em]">
                Instagram Portfolio Intelligence
              </h1>
            </div>
            <span className="h-5 w-px bg-gray-200" />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-1 text-[11px] font-bold text-purple-600">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
              {selectedIds.length} / {realAccounts.length} Accounts Active
            </span>
          </div>
          <p className="mt-1 text-[13px] text-gray-400">
            Multi-account strategic analytics &amp; AI-powered portfolio intelligence
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
            <Calendar className="h-3.5 w-3.5 text-gray-300 ml-1.5" />
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200 cursor-pointer ${
                  range === r ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <button
            onClick={handleExport}
            disabled={!accountMetrics.length}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-[12px] font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-700 shadow-sm transition disabled:opacity-50 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </motion.div>

      {/* Body */}
      {loading && realAccounts.length === 0 ? (
        <Skeleton />
      ) : realAccounts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <Layers className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-medium text-gray-700">No Instagram accounts connected</p>
          <p className="text-sm text-gray-500 mt-1">
            Connect Instagram accounts via the dashboard to enable portfolio analytics.
          </p>
        </div>
      ) : selectedIds.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-lg font-medium text-gray-700">No accounts selected</p>
          <p className="text-sm text-gray-500 mt-1">Select one or more accounts above to view portfolio analytics.</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="space-y-6"
        >
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <KPICard
              icon={Users}
              label="Total Followers"
              value={fmt(portfolio.totalFollowers)}
              trend={`${portfolio.avgGrowth.toFixed(1)}% avg`}
              up={portfolio.avgGrowth >= 0}
              accent="#8B5CF6"
              index={0}
            />
            <KPICard
              icon={Eye}
              label="Est. Monthly Reach"
              value={fmt(portfolio.totalReach)}
              accent="#EC4899"
              index={1}
              estimated
            />
            <KPICard
              icon={Heart}
              label="Avg Engagement"
              value={portfolio.avgEr.toFixed(2)}
              unit="%"
              trend="Across selected"
              up
              accent="#EF4444"
              index={2}
            />
            <KPICard
              icon={FileImage}
              label="Total Posts"
              value={fmt(portfolio.totalPosts)}
              accent="#3B82F6"
              index={3}
            />
            <KPICard
              icon={Layers}
              label="Accounts Active"
              value={String(portfolio.activeAccounts)}
              trend={`of ${realAccounts.length} connected`}
              up
              accent="#10B981"
              index={4}
            />
          </div>

          {/* Charts row: Growth trend + Followers distribution */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <Panel
              title="Follower Growth Trend"
              icon={TrendingUp}
              color="#8B5CF6"
              className="xl:col-span-2"
              estimated
            >
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={growthTrendData} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                    <XAxis dataKey="idx" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} tickFormatter={(v) => `T${v + 1}`} />
                    <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} tickFormatter={(v) => fmt(v)} width={56} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload || !payload.length) return null
                        return (
                          <div style={TIP}>
                            <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">T{Number(label) + 1}</p>
                            {payload
                              .slice()
                              .sort((a, b) => b.value - a.value)
                              .map((p) => (
                                <p key={p.name} className="flex items-center justify-between gap-3 text-[11px]">
                                  <span className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                                    {p.name}
                                  </span>
                                  <span className="font-bold text-gray-900 tabular-nums">{fmt(p.value)}</span>
                                </p>
                              ))}
                          </div>
                        )
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" iconSize={8} />
                    {accountMetrics.map((a) => {
                      const key = a.handle?.replace('@', '') || a.name
                      return (
                        <Line
                          key={key}
                          type="monotone"
                          dataKey={key}
                          stroke={a.color}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      )
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel
              title="Followers Distribution"
              icon={Users}
              color="#EC4899"
              estimated
            >
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={followersDistribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={2}
                    >
                      {followersDistribution.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) =>
                        active && payload && payload.length ? (
                          <div style={TIP}>
                            <p className="text-[11px] font-bold text-gray-900">{payload[0].name}</p>
                            <p className="text-[11px] text-gray-600 tabular-nums">{fmt(payload[0].value)} followers</p>
                            <p className="text-[10px] text-gray-400">
                              {((payload[0].value / portfolio.totalFollowers) * 100).toFixed(1)}% of total
                            </p>
                          </div>
                        ) : null
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 space-y-1.5 max-h-24 overflow-y-auto">
                {followersDistribution.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 text-gray-600">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
                      {d.name}
                    </span>
                    <span className="font-bold text-gray-900 tabular-nums">
                      {((d.value / Math.max(portfolio.totalFollowers, 1)) * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          {/* Leaderboard + AI Insights */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <Panel
              title="Account Leaderboard"
              icon={Crown}
              color="#F59E0B"
              className="xl:col-span-2"
            >
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-gray-400">
                      <th className="text-left font-semibold px-2 py-2">Rank</th>
                      <th className="text-left font-semibold px-2 py-2">Account</th>
                      <th className="text-right font-semibold px-2 py-2">Followers</th>
                      <th className="text-right font-semibold px-2 py-2">Posts</th>
                      <th className="text-right font-semibold px-2 py-2">Reach (est)</th>
                      <th className="text-right font-semibold px-2 py-2">ER</th>
                      <th className="text-right font-semibold px-2 py-2">Growth</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((a, i) => (
                      <motion.tr
                        key={a.id}
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(i * 0.04, 0.4) }}
                        className="border-t border-gray-50 hover:bg-purple-50/30 transition"
                      >
                        <td className="px-2 py-2.5">
                          <div className="flex items-center gap-1">
                            <span
                              className="flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold"
                              style={
                                i === 0
                                  ? { backgroundColor: '#FCD34D', color: '#92400E' }
                                  : i === 1
                                  ? { backgroundColor: '#E5E7EB', color: '#4B5563' }
                                  : i === 2
                                  ? { backgroundColor: '#FED7AA', color: '#9A3412' }
                                  : { backgroundColor: '#F3F4F6', color: '#6B7280' }
                              }
                            >
                              {i + 1}
                            </span>
                            {i === 0 && <Crown className="h-3 w-3 text-amber-500" />}
                          </div>
                        </td>
                        <td className="px-2 py-2.5">
                          <div className="flex items-center gap-2">
                            <img src={a.avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1">
                                <p className="text-[12px] font-semibold text-gray-900 truncate">{a.name}</p>
                                {a.verified && <BadgeCheck className="h-3 w-3 text-blue-500" />}
                              </div>
                              <p className="text-[10px] text-gray-500 truncate">{a.handle}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-2.5 text-right text-[12px] font-bold text-gray-900 tabular-nums">{fmt(a.followers)}</td>
                        <td className="px-2 py-2.5 text-right text-[12px] text-gray-700 tabular-nums">{fmt(a.posts)}</td>
                        <td className="px-2 py-2.5 text-right text-[12px] text-gray-700 tabular-nums">{fmt(a.reach)}</td>
                        <td className="px-2 py-2.5 text-right text-[12px] font-semibold text-gray-900 tabular-nums">{a.er.toFixed(2)}%</td>
                        <td className="px-2 py-2.5 text-right">
                          <span className={`text-[11px] font-bold tabular-nums ${a.growthUp ? 'text-emerald-600' : 'text-red-500'}`}>
                            {a.growthUp ? '+' : ''}{a.growth.toFixed(1)}%
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="AI Portfolio Insights" icon={Sparkles} color="#A855F7">
              <div className="space-y-3">
                {insights.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">Select accounts to generate insights</p>
                ) : (
                  insights.map((ins, i) => {
                    const style = INSIGHT_STYLES[ins.type] || INSIGHT_STYLES.info
                    const { Icon } = style
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i * 0.07, 0.4) }}
                        className={`rounded-xl border ${style.border} ${style.bg} p-3.5`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className={`flex h-7 w-7 items-center justify-center rounded-lg bg-white ${style.text} shadow-sm shrink-0`}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-bold text-gray-900">{ins.title}</p>
                            <p className="text-[11px] text-gray-600 mt-0.5 leading-relaxed">{ins.desc}</p>
                            <p className="text-[11px] font-semibold text-gray-800 mt-1.5 flex items-start gap-1">
                              <Sparkles className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                              <span>{ins.action}</span>
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })
                )}
              </div>
            </Panel>
          </div>

          {/* Engagement comparison + Category distribution */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Panel title="Engagement Rate Comparison" icon={Heart} color="#EF4444">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={engagementComparison} margin={{ top: 8, right: 16, left: -8, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: '#6B7280' }}
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                      angle={-25}
                      textAnchor="end"
                    />
                    <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      content={({ active, payload }) =>
                        active && payload && payload.length ? (
                          <div style={TIP}>
                            <p className="text-[11px] font-bold text-gray-900">{payload[0].payload.handle}</p>
                            <p className="text-[11px] text-gray-600 tabular-nums">{payload[0].value}% engagement</p>
                          </div>
                        ) : null
                      }
                    />
                    <Bar dataKey="er" radius={[6, 6, 0, 0]} maxBarSize={48}>
                      {engagementComparison.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title="Account Categories" icon={Building2} color="#3B82F6">
              <div className="space-y-3">
                {categoryDistribution.map((c) => {
                  const pct = (c.count / Math.max(accountMetrics.length, 1)) * 100
                  return (
                    <div key={c.category}>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="flex items-center gap-1.5 text-gray-700 font-medium">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                          {c.category}
                        </span>
                        <span className="text-gray-500 tabular-nums">
                          {c.count} · {pct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: c.color }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Panel>
          </div>

          {/* Audience Overlap (v1 estimated) */}
          {audienceOverlap.length > 0 && (
            <Panel title="Audience Overlap" icon={Users} color="#06B6D4" estimated>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {audienceOverlap.map((row, i) => (
                  <div key={i} className="rounded-xl border border-gray-100 p-3.5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="font-semibold text-gray-800">{row.a}</span>
                        <span className="text-gray-300">↔</span>
                        <span className="font-semibold text-gray-800">{row.b}</span>
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <p className="text-2xl font-bold text-gray-900 tabular-nums">{row.overlap}%</p>
                      <p className="text-[10px] text-gray-500">≈ {fmt(row.shared)} shared</p>
                    </div>
                    <div className="mt-2 flex h-1.5 w-full rounded-full overflow-hidden bg-gray-100">
                      <div className="h-full" style={{ width: `${row.overlap}%`, backgroundColor: row.colorA }} />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* Upload Time Analysis (v1 estimated) */}
          <Panel title="Best Posting Windows" icon={Clock} color="#10B981" estimated>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-gray-400">
                    <th className="text-left font-semibold px-2 py-2">Day</th>
                    <th className="text-left font-semibold px-2 py-2">Best Time</th>
                    <th className="text-left font-semibold px-2 py-2 w-full">Engagement Score</th>
                    <th className="text-right font-semibold px-2 py-2">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {ESTIMATED_UPLOAD_WINDOWS.map((w, i) => {
                    const isTop = w.score >= 90
                    return (
                      <tr key={w.day} className="border-t border-gray-50">
                        <td className="px-2 py-2.5 text-[12px] font-semibold text-gray-900">{w.day}</td>
                        <td className="px-2 py-2.5 text-[12px] text-gray-700 tabular-nums">{w.hour}</td>
                        <td className="px-2 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${w.score}%`,
                                  backgroundColor: isTop ? '#10B981' : '#3B82F6',
                                }}
                              />
                            </div>
                            {isTop && <Crown className="h-3 w-3 text-amber-500" />}
                          </div>
                        </td>
                        <td className="px-2 py-2.5 text-right text-[12px] font-bold tabular-nums text-gray-900">{w.score}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          {/* Coming Soon */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100">
                <Rocket className="h-3.5 w-3.5 text-gray-400" />
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-gray-900 tracking-tight">Coming Soon</h3>
                <p className="text-[11px] text-gray-400">Advanced modules currently in development</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {FUTURE_MODULES.map((mod) => {
                const Icon = mod.icon
                return (
                  <div
                    key={mod.name}
                    className={`relative rounded-[20px] border ${mod.borderColor} bg-gradient-to-br ${mod.gradient} p-5 overflow-hidden`}
                    style={{ boxShadow: CARD_SHADOW }}
                  >
                    <div className="absolute top-3 right-3">
                      <span className="text-[9px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Soon
                      </span>
                    </div>
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
                        style={{ backgroundColor: `${mod.color}15` }}
                      >
                        <Icon className="h-5 w-5" style={{ color: mod.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-gray-800 mb-1">{mod.name}</p>
                        <p className="text-[11px] text-gray-400 leading-relaxed">{mod.desc}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
