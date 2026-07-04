import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from 'recharts'
import {
  Users,
  Eye,
  BarChart3,
  Heart,
  UserCheck,
  Sparkles,
  TrendingUp,
  TrendingDown,
  MapPin,
  Building2,
  Calendar,
  AlertCircle,
  Info,
  Lightbulb,
  Activity,
  RefreshCw,
} from 'lucide-react'
import { useInstagramAdapter } from '../../platformAdapters/instagramAdapter'
import { fmt } from '../../utils/format'
import AccountCarousel from './AccountCarousel'

/* ─── Constants ─────────────────────────────────────────────────────────── */

const RANGES = ['7D', '30D', '90D', '1Y']
const RANGE_DAYS = { '7D': 7, '30D': 30, '90D': 90, '1Y': 365 }

// v1 estimated audience distributions. Backend audience endpoint is pending;
// these are stable, reasonable defaults flagged with `estimated: true`.
const ESTIMATED_CITIES_BY_COUNTRY = {
  USA: [
    { name: 'New York', share: 0.30 },
    { name: 'Los Angeles', share: 0.22 },
    { name: 'Chicago', share: 0.15 },
    { name: 'Miami', share: 0.12 },
  ],
  UK: [
    { name: 'London', share: 0.45 },
    { name: 'Manchester', share: 0.20 },
    { name: 'Birmingham', share: 0.15 },
  ],
  Brazil: [
    { name: 'São Paulo', share: 0.40 },
    { name: 'Rio de Janeiro', share: 0.28 },
    { name: 'Brasília', share: 0.12 },
  ],
  Canada: [
    { name: 'Toronto', share: 0.35 },
    { name: 'Vancouver', share: 0.22 },
    { name: 'Montreal', share: 0.20 },
  ],
  India: [
    { name: 'Mumbai', share: 0.28 },
    { name: 'Delhi', share: 0.24 },
    { name: 'Bangalore', share: 0.18 },
  ],
  Germany: [
    { name: 'Berlin', share: 0.30 },
    { name: 'Munich', share: 0.22 },
    { name: 'Hamburg', share: 0.18 },
  ],
}
const FALLBACK_CITIES = [
  { name: 'Capital City', share: 0.35 },
  { name: 'Metro Area', share: 0.22 },
  { name: 'Coastal City', share: 0.15 },
]

const ESTIMATED_AGE = [
  { range: '13-17', pct: 6, color: '#C4B5FD' },
  { range: '18-24', pct: 31, color: '#8B5CF6' },
  { range: '25-34', pct: 36, color: '#6366F1' },
  { range: '35-44', pct: 15, color: '#3B82F6' },
  { range: '45-54', pct: 8, color: '#60A5FA' },
  { range: '55+', pct: 4, color: '#93C5FD' },
]

const ESTIMATED_GENDER = [
  { name: 'Women', pct: 52, color: '#EC4899' },
  { name: 'Men', pct: 46, color: '#3B82F6' },
  { name: 'Non-binary', pct: 2, color: '#8B5CF6' },
]

/* ─── Skeleton ──────────────────────────────────────────────────────────── */

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm animate-pulse">
      <div className="h-3 w-20 bg-gray-200 rounded mb-3" />
      <div className="h-7 w-28 bg-gray-200 rounded mb-2" />
      <div className="h-3 w-16 bg-gray-100 rounded" />
    </div>
  )
}

function ChartSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm animate-pulse">
      <div className="h-4 w-32 bg-gray-200 rounded mb-4" />
      <div className="h-40 bg-gray-100 rounded-xl" />
    </div>
  )
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <ChartSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <ChartSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

/* ─── KPI Card ──────────────────────────────────────────────────────────── */

const KPI_THEMES = {
  followers: { icon: Users, accent: '#8B5CF6', bg: 'bg-violet-50', fg: 'text-violet-600' },
  reach: { icon: Eye, accent: '#EC4899', bg: 'bg-pink-50', fg: 'text-pink-600' },
  impressions: { icon: BarChart3, accent: '#3B82F6', bg: 'bg-blue-50', fg: 'text-blue-600' },
  engagement: { icon: Heart, accent: '#EF4444', bg: 'bg-red-50', fg: 'text-red-600' },
  profileVisits: { icon: UserCheck, accent: '#10B981', bg: 'bg-emerald-50', fg: 'text-emerald-600' },
  contentScore: { icon: Sparkles, accent: '#F59E0B', bg: 'bg-amber-50', fg: 'text-amber-600' },
}

function KPICard({ themeKey, label, value, unit, trend, up, estimated, index }) {
  const theme = KPI_THEMES[themeKey] || KPI_THEMES.followers
  const Icon = theme.icon
  const trendVal = typeof trend === 'number' ? (up ? `+${trend.toFixed(1)}%` : `${trend.toFixed(1)}%`) : trend
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.4) }}
      className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${theme.bg} ${theme.fg} shrink-0`}>
          <Icon className="h-4 w-4" />
        </div>
        {estimated && (
          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100 flex items-center gap-0.5">
            <Info className="h-2.5 w-2.5" /> est.
          </span>
        )}
      </div>
      <p className="mt-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">
        {value}
        {unit && <span className="ml-0.5 text-base font-medium text-gray-500">{unit}</span>}
      </p>
      {trendVal && (
        <p className={`mt-1 text-xs font-semibold flex items-center gap-0.5 ${up ? 'text-emerald-600' : 'text-red-500'}`}>
          {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {trendVal}
        </p>
      )}
    </motion.div>
  )
}

/* ─── Tooltip ───────────────────────────────────────────────────────────── */

function ChartTooltip({ active, payload, label, valuePrefix = '' }) {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md">
      {label && <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{label}</p>}
      <p className="text-sm font-bold text-gray-900 tabular-nums">
        {valuePrefix}{payload[0].value.toLocaleString()}
      </p>
    </div>
  )
}

/* ─── Trend Chart ───────────────────────────────────────────────────────── */

function TrendChart({ data, dataKey, color, label, icon: Icon, estimated, range }) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return []
    const max = RANGE_DAYS[range] || 30
    return data.slice(-max)
  }, [data, range])

  const total = useMemo(
    () => chartData.reduce((s, d) => s + (d[dataKey] || 0), 0),
    [chartData, dataKey]
  )
  const last = chartData[chartData.length - 1]?.[dataKey] || 0
  const first = chartData[0]?.[dataKey] || 0
  const delta = first > 0 ? ((last - first) / first) * 100 : 0
  const up = delta >= 0

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {Icon && (
              <div
                className="flex h-6 w-6 items-center justify-center rounded-md"
                style={{ backgroundColor: `${color}1A`, color }}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
            )}
            <h4 className="text-sm font-bold text-gray-900 truncate">{label}</h4>
            {estimated && (
              <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-100 flex items-center gap-0.5">
                <Info className="h-2.5 w-2.5" /> est.
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Total <span className="font-semibold text-gray-700 tabular-nums">{fmt(total)}</span>
            <span className={`ml-2 font-semibold ${up ? 'text-emerald-600' : 'text-red-500'}`}>
              {up ? '+' : ''}{delta.toFixed(1)}%
            </span>
          </p>
        </div>
      </div>
      {chartData.length < 2 ? (
        <div className="h-40 flex items-center justify-center text-xs text-gray-400">
          Not enough data for this range.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#9CA3AF' }}
              tickLine={false}
              axisLine={false}
              minTickGap={20}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#9CA3AF' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => fmt(v)}
              width={48}
            />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              fill={`url(#grad-${dataKey})`}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

/* ─── Audience: Top Countries ───────────────────────────────────────────── */

function TopCountries({ data, estimated }) {
  const rows = useMemo(() => {
    if (!data || data.length === 0) return []
    return data
      .filter((d) => d.country !== 'Others')
      .map((d) => ({
        name: d.country,
        value: d.pct || 0,
        flag: d.flag || '🌍',
        accounts: d.views || 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  }, [data])

  return (
    <Panel
      title="Top Countries"
      icon={MapPin}
      color="#3B82F6"
      estimated={estimated}
      empty={rows.length === 0}
    >
      <div className="space-y-3">
        {rows.map((r, i) => (
          <GeoRow key={r.name} {...r} index={i} />
        ))}
      </div>
    </Panel>
  )
}

function GeoRow({ name, value, flag, accounts, color = '#3B82F6' }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-gray-700 font-medium flex items-center gap-1.5 min-w-0">
          <span className="text-base leading-none">{flag}</span>
          <span className="truncate">{name}</span>
        </span>
        <span className="text-gray-500 tabular-nums shrink-0 ml-2">
          {value.toFixed(1)}% · {fmt(accounts)}
        </span>
      </div>
      <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

/* ─── Audience: Top Cities (v1 estimated from country shares) ───────────── */

function TopCities({ countries, totalFollowers, estimated }) {
  const rows = useMemo(() => {
    if (!countries || !totalFollowers) return []
    const real = countries.filter((c) => c.country !== 'Others')
    const out = []
    real.forEach((c) => {
      const countryFollowers = Math.round((totalFollowers * (c.pct || 0)) / 100)
      const cityPool = ESTIMATED_CITIES_BY_COUNTRY[c.country] || FALLBACK_CITIES
      cityPool.forEach((city) => {
        out.push({
          name: city.name,
          flag: c.flag || '🏙️',
          value: ((c.pct || 0) * city.share),
          accounts: Math.round(countryFollowers * city.share),
        })
      })
    })
    return out.sort((a, b) => b.value - a.value).slice(0, 6)
  }, [countries, totalFollowers])

  const palette = ['#8B5CF6', '#EC4899', '#3B82F6', '#10B981', '#F59E0B', '#EF4444']

  return (
    <Panel
      title="Top Cities"
      icon={Building2}
      color="#8B5CF6"
      estimated={estimated}
      empty={rows.length === 0}
    >
      <div className="space-y-3">
        {rows.map((r, i) => (
          <GeoRow key={r.name} {...r} color={palette[i % palette.length]} />
        ))}
      </div>
    </Panel>
  )
}

/* ─── Audience: Age Distribution (v1 estimated) ─────────────────────────── */

function AgeDistribution({ estimated }) {
  return (
    <Panel
      title="Age Distribution"
      icon={Users}
      color="#6366F1"
      estimated={estimated}
      empty={ESTIMATED_AGE.length === 0}
    >
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={ESTIMATED_AGE} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
          <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} width={36} />
          <Tooltip
            cursor={{ fill: '#F9FAFB' }}
            content={({ active, payload }) =>
              active && payload && payload.length ? (
                <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md">
                  <p className="text-sm font-bold text-gray-900 tabular-nums">{payload[0].payload.pct}%</p>
                  <p className="text-[10px] text-gray-500">Age {payload[0].payload.range}</p>
                </div>
              ) : null
            }
          />
          <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
            {ESTIMATED_AGE.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Panel>
  )
}

/* ─── Audience: Gender Distribution (v1 estimated) ──────────────────────── */

function GenderDistribution({ estimated }) {
  return (
    <Panel
      title="Gender Distribution"
      icon={UserCheck}
      color="#EC4899"
      estimated={estimated}
      empty={ESTIMATED_GENDER.length === 0}
    >
      <div className="flex items-center gap-4">
        <ResponsiveContainer width="50%" height={140}>
          <PieChart>
            <Pie
              data={ESTIMATED_GENDER}
              dataKey="pct"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={32}
              outerRadius={56}
              paddingAngle={2}
            >
              {ESTIMATED_GENDER.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) =>
                active && payload && payload.length ? (
                  <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md">
                    <p className="text-sm font-bold text-gray-900 tabular-nums">{payload[0].value}%</p>
                    <p className="text-[10px] text-gray-500">{payload[0].name}</p>
                  </div>
                ) : null
              }
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex-1 space-y-2">
          {ESTIMATED_GENDER.map((g) => (
            <div key={g.name} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-gray-700 font-medium">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: g.color }} />
                {g.name}
              </span>
              <span className="font-semibold text-gray-900 tabular-nums">{g.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  )
}

/* ─── Panel wrapper ─────────────────────────────────────────────────────── */

function Panel({ title, icon: Icon, color, estimated, empty, children }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
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
          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100 flex items-center gap-0.5">
            <Info className="h-2.5 w-2.5" /> Estimated
          </span>
        )}
      </div>
      {empty ? (
        <p className="text-sm text-gray-400 py-8 text-center">No data available.</p>
      ) : (
        children
      )}
    </div>
  )
}

/* ─── AI Insight ────────────────────────────────────────────────────────── */

const INSIGHT_STYLES = {
  positive: { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700', Icon: TrendingUp },
  warning: { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700', Icon: AlertCircle },
  info: { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-700', Icon: Info },
}

function InsightCard({ insight, index }) {
  const style = INSIGHT_STYLES[insight.type] || INSIGHT_STYLES.info
  const { Icon } = style
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.07, 0.5) }}
      className={`rounded-2xl border ${style.border} ${style.bg} p-5`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-white ${style.text} shadow-sm shrink-0`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900">{insight.title}</p>
          <p className="mt-1 text-xs text-gray-600 leading-relaxed">{insight.desc}</p>
          <p className="mt-2 text-xs font-semibold text-gray-800 flex items-start gap-1">
            <Lightbulb className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
            <span>{insight.action}</span>
          </p>
        </div>
      </div>
    </motion.div>
  )
}

/* ─── Main Component ────────────────────────────────────────────────────── */

export default function InstagramAnalytics() {
  const {
    accounts = [],
    selectedAccount,
    analyticsData,
    loading,
    error,
    refreshAccounts,
  } = useInstagramAdapter()

  const [range, setRange] = useState('30D')

  const isDemo = !selectedAccount || selectedAccount.id === 'demo_ig'
  const activeAccount = isDemo ? null : selectedAccount
  const overview = analyticsData?._raw?.overview
  const timeSeries = analyticsData?._raw?.timeSeries || []
  const stats = analyticsData?.analyticsStats || []
  const insights = analyticsData?.aiInsights || []
  const geo = analyticsData?.geoData || []
  const hasOverview = !!overview

  /* ── 6 KPI cards: Followers, Reach, Impressions, Engagement, Profile Visits, Content Score ── */
  const kpis = useMemo(() => {
    const byLabel = Object.fromEntries(stats.map((s) => [s.label, s]))
    const followers = byLabel['Followers']
    const reach = byLabel['Reach']
    const impressions = byLabel['Impressions']
    const engagement = byLabel['Engagement Rate']
    const profileVisits = byLabel['Profile Visits']

    // Content Score: composite heuristic (0-100). Combines engagement rate,
    // reach consistency, and growth signal. Marked estimated.
    let contentScore = 0
    let contentTrend = 0
    let contentUp = true
    if (overview) {
      const er = overview.engagementRate || 0
      const reachVal = overview.reach || 0
      const followersVal = overview.followers || 1
      const growth = overview.followersGrowth || 0
      const erScore = Math.min(er * 8, 40) // 5% ER ~ 40 pts
      const reachScore = Math.min((reachVal / Math.max(followersVal, 1)) * 30, 30) // reach:follower ratio
      const growthScore = Math.max(Math.min(growth * 4, 30), 0) // up to 30 from growth
      contentScore = Math.round(erScore + reachScore + growthScore)
      contentTrend = growth
      contentUp = growth >= 0
    }

    return [
      {
        key: 'followers',
        label: 'Followers',
        value: followers?.value || '0',
        trend: followers?.trend || '0%',
        up: followers?.up ?? true,
        estimated: false,
      },
      {
        key: 'reach',
        label: 'Reach',
        value: reach?.value || '0',
        trend: reach?.trend || '0%',
        up: reach?.up ?? true,
        estimated: false,
      },
      {
        key: 'impressions',
        label: 'Impressions',
        value: impressions?.value || '0',
        trend: impressions?.trend || '0%',
        up: impressions?.up ?? true,
        estimated: false,
      },
      {
        key: 'engagement',
        label: 'Engagement',
        value: engagement?.value || '0',
        unit: engagement?.unit || '%',
        trend: engagement?.trend || '0%',
        up: engagement?.up ?? true,
        estimated: false,
      },
      {
        key: 'profileVisits',
        label: 'Profile Visits',
        value: profileVisits?.value || '0',
        trend: profileVisits?.trend || '0%',
        up: profileVisits?.up ?? true,
        estimated: false,
      },
      {
        key: 'contentScore',
        label: 'Content Score',
        value: String(contentScore),
        unit: '/100',
        trend: contentTrend,
        up: contentUp,
        estimated: true,
      },
    ]
  }, [stats, overview])

  /* ── 4 trend charts: Followers, Reach, Engagement, Impressions ── */
  const followersSeries = useMemo(
    () => timeSeries.map((d) => ({ date: d.date, followers: d.followers })),
    [timeSeries]
  )
  const reachSeries = useMemo(
    () => timeSeries.map((d) => ({ date: d.date, reach: d.reach })),
    [timeSeries]
  )
  const engagementSeries = useMemo(
    () => timeSeries.map((d) => ({ date: d.date, engagement: d.engagement })),
    [timeSeries]
  )
  const impressionsSeries = useMemo(
    () => timeSeries.map((d) => ({ date: d.date, impressions: d.impressions })),
    [timeSeries]
  )

  const followersTotal = overview?.followers || 0

  return (
    <div className="min-h-screen space-y-6">
      {/* Account Carousel (Phase 3) — drives activeAccount */}
      <AccountCarousel />

      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-[22px] font-bold text-gray-900 tracking-[-0.02em] flex items-center gap-2">
            Instagram Analytics
            {activeAccount && (
              <>
                <span className="h-5 w-px bg-gray-200" />
                <span className="text-[14px] font-medium text-gray-400">{activeAccount.name}</span>
              </>
            )}
          </h1>
          <p className="mt-1 text-[13px] text-gray-400">
            Performance metrics &amp; audience intelligence
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Time range */}
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
          {/* Refresh */}
          {refreshAccounts && (
            <button
              onClick={refreshAccounts}
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-[12px] font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-700 shadow-sm transition cursor-pointer"
              title="Refresh analytics"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          )}
        </div>
      </motion.div>

      {/* Body */}
      {loading && accounts.length === 0 ? (
        <AnalyticsSkeleton />
      ) : !activeAccount ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-lg font-medium text-gray-700">No connected Instagram account</p>
          <p className="text-sm text-gray-500 mt-1">
            Connect an Instagram account above to start tracking analytics.
          </p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-red-900">Failed to load analytics</p>
            <p className="text-xs text-red-700 mt-1">{error}</p>
            {refreshAccounts && (
              <button
                onClick={refreshAccounts}
                className="mt-3 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition cursor-pointer"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      ) : !hasOverview ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm max-w-xl mx-auto">
          <p className="text-lg font-medium text-gray-700">
            {selectedAccount?.syncStatus === 'syncing'
              ? 'Analytics are still syncing'
              : selectedAccount?.syncStatus === 'error'
              ? 'Sync failed'
              : 'No Instagram analytics available'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {selectedAccount?.syncStatus === 'syncing'
              ? 'Analytics are still syncing. Initial Instagram data is being fetched from RapidAPI.'
              : selectedAccount?.syncStatus === 'error'
              ? 'Unable to synchronize this Instagram account. Please try syncing again.'
              : 'No analytics available yet. The initial synchronization has not completed.'}
          </p>
        </div>
      ) : (
        <>
          {/* KPI grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {kpis.map((kpi, i) => (
              <KPICard key={kpi.key} themeKey={kpi.key} {...kpi} index={i} />
            ))}
          </div>

          {/* Trend charts (2x2) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TrendChart
              data={followersSeries}
              dataKey="followers"
              color="#8B5CF6"
              label="Followers Growth"
              icon={Users}
              estimated={false}
              range={range}
            />
            <TrendChart
              data={reachSeries}
              dataKey="reach"
              color="#EC4899"
              label="Reach Trend"
              icon={Eye}
              estimated={false}
              range={range}
            />
            <TrendChart
              data={engagementSeries}
              dataKey="engagement"
              color="#EF4444"
              label="Engagement Trend"
              icon={Activity}
              estimated={false}
              range={range}
            />
            <TrendChart
              data={impressionsSeries}
              dataKey="impressions"
              color="#3B82F6"
              label="Impressions Trend"
              icon={BarChart3}
              estimated={false}
              range={range}
            />
          </div>

          {/* Audience section */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <MapPin className="h-4 w-4 text-purple-500" />
              <h3 className="text-sm font-bold text-gray-900">Audience</h3>
              <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                v1 estimated
              </span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <TopCountries data={geo} estimated={false} />
              <TopCities countries={geo} totalFollowers={followersTotal} estimated />
              <AgeDistribution estimated />
              <GenderDistribution estimated />
            </div>
          </div>

          {/* AI Insights */}
          {insights.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1.5">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                AI Insights
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {insights.slice(0, 3).map((insight, i) => (
                  <InsightCard key={i} insight={insight} index={i} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
