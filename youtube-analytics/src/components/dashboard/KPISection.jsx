import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useCountUp from '../../hooks/useCountUp'
import { getDashboard } from '../../services/api'
import { KPISkeleton, ErrorBanner } from '../ui/Skeleton'

const TABS = ['Overview', 'Videos', 'Audience', 'Engagement', 'SEO', 'Revenue']

function formatValue(v) {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}

function KPICard({ card, index }) {
  const { value, ref } = useCountUp(card.rawValue)

  return (
    <div
      className={`animate-fade-in-up stagger-${index + 1} rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-md`}
    >
      <div className="flex items-center justify-between">
        <div ref={ref}>
          <p className="text-sm text-gray-500">{card.title}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{card.display(value)}</p>
          <p
            className={`mt-1 text-sm font-medium ${
              card.growth >= 0 ? 'text-green-600' : 'text-red-500'
            }`}
          >
            {card.growth >= 0 ? '+' : ''}{card.growth}%
          </p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${card.color}`}>
          {card.icon}
        </div>
      </div>
    </div>
  )
}

export default function KPISection({ channelId, overrideCards }) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('Overview')
  const [compareMode, setCompareMode] = useState(false)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (overrideCards) {
      setLoading(false)
      return
    }
    if (!channelId) return
    setLoading(true)
    setError('')
    getDashboard(channelId)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load metrics'))
      .finally(() => setLoading(false))
  }, [channelId, overrideCards])

  if (loading) return <KPISkeleton />
  if (error) return <ErrorBanner message={error} onRetry={() => window.location.reload()} />

  if (overrideCards) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-gray-200">
          <nav className="-mb-px flex gap-6">
            {['Overview', 'Posts', 'Audience', 'Engagement', 'SEO', 'Revenue'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`border-b-2 pb-3 text-sm transition-all duration-200 ${
                  activeTab === tab
                    ? 'border-blue-600 font-semibold text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {overrideCards.map((card, i) => (
            <KPICard key={card.title} card={card} index={i} />
          ))}
        </div>
      </div>
    )
  }

  const ov = data?.overview || {}

  const KPI_CARDS = [
    {
      title: 'Total Views',
      rawValue: ov.totalViews || 0,
      display: (v) => formatValue(v),
      growth: ov.viewsGrowth || 0,
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
      color: 'bg-blue-100 text-blue-600',
    },
    {
      title: 'Subscribers',
      rawValue: ov.subscribers || 0,
      display: (v) => formatValue(v),
      growth: parseFloat(((ov.engagementRate || 0) * 0.8 + (ov.viewsGrowth || 0) * 0.2).toFixed(1)),
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      color: 'bg-purple-100 text-purple-600',
    },
    {
      title: 'Total Videos',
      rawValue: ov.totalVideos || 0,
      display: (v) => formatValue(v),
      growth: parseFloat(((ov.uploadFrequency || 0) * 10).toFixed(1)),
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      ),
      color: 'bg-red-100 text-red-500',
    },
    {
      title: 'Engagement Rate',
      rawValue: Math.round((ov.engagementRate || 0) * 10),
      display: (v) => `${(v / 10).toFixed(1)}%`,
      growth: 1.3,
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      color: 'bg-green-100 text-green-600',
    },
    {
      title: 'Avg. Views',
      rawValue: ov.averageViews || 0,
      display: (v) => formatValue(v),
      growth: ov.viewsGrowth || 0,
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'bg-yellow-100 text-yellow-600',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`border-b-2 pb-3 text-sm transition-all duration-200 ${
                activeTab === tab
                  ? 'border-blue-600 font-semibold text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">Compare Mode</span>
          <button
            onClick={() => {
              setCompareMode(true)
              navigate('/analytics?mode=portfolio')
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-all duration-200 ${
              compareMode ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                compareMode ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {KPI_CARDS.map((card, i) => (
          <KPICard key={card.title} card={card} index={i} />
        ))}
      </div>
    </div>
  )
}
