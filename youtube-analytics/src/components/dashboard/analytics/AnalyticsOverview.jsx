import { useState, useEffect } from 'react'
import ChartCard from './ChartCard'
import TopVideosCard from './TopVideosCard'
import DashboardBottom from './DashboardBottom'
import { getAnalytics } from '../../../services/api'
import { ChartSkeleton, ListSkeleton, ErrorBanner } from '../../ui/Skeleton'
import { usePlatform } from '../../../hooks/usePlatform'
import { usePlatformAdapter } from '../../../platformAdapters'

export default function AnalyticsOverview({ channelId }) {
  const { selectedPlatform } = usePlatform()
  const { analyticsData, loading: adapterLoading } = usePlatformAdapter()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (selectedPlatform !== 'youtube') {
      setLoading(adapterLoading)
      if (analyticsData) {
        setData(analyticsData)
        setError('')
      }
      return
    }

    if (!channelId) return
    setLoading(true)
    setError('')
    getAnalytics(channelId)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load analytics'))
      .finally(() => setLoading(false))
  }, [channelId, selectedPlatform, analyticsData, adapterLoading])

  if (error) return <ErrorBanner message={error} />

  // Extract variables safely based on platform
  const isYoutube = selectedPlatform === 'youtube'
  const monthlyViews = isYoutube
    ? (data?.monthlyViews || [])
    : (data?.performanceData || []).map(p => ({ month: p.date, views: p.views }))

  const overviewData = isYoutube
    ? (data?.overview || {})
    : (data?._raw?.overview || {})

  const topVideos = isYoutube
    ? (data?.topVideos || [])
    : (data?.videoTable || []).map(v => {
        // Strip out string commas or formatting for parsing views
        const cleanViews = typeof v.views === 'string' ? parseInt(v.views.replace(/[K,M,]/g, '')) * (v.views.includes('K') ? 1000 : v.views.includes('M') ? 1000000 : 1) : v.views
        return {
          videoId: v.id,
          title: v.title,
          views: cleanViews || 0,
          thumbnail: v.thumb
        }
      })

  const trafficData = isYoutube ? (data?.trafficSources || []) : (data?.trafficSources || [])
  
  const growthData = isYoutube
    ? (data?.subscribersGrowth || [])
    : (data?.engagementData || []).map(e => ({
        date: e.date,
        subscribers: e.subs
      }))

  const aiInsights = isYoutube ? [] : (data?.aiInsights || [])

  return (
    <div>
      {/* Section Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800">
          {isYoutube ? 'Analytics Overview' : 'Account Intelligence'}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {isYoutube 
            ? 'Track performance trends and audience behavior' 
            : 'Track follower growth, reach expansion, and post engagement'}
        </p>
      </div>

      {/* ===== TOP ROW ===== */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* LEFT: Views Over Time */}
        <div className="xl:col-span-2 bg-white rounded-2xl p-6 shadow-md border border-gray-100">
          {loading ? (
            <ChartSkeleton />
          ) : (
            <ChartCard monthlyViews={monthlyViews} overview={overviewData} />
          )}
        </div>

        {/* RIGHT: Top Videos */}
        {loading ? (
          <ListSkeleton rows={5} />
        ) : (
          <TopVideosCard 
            videos={topVideos} 
            title={isYoutube ? "Top Videos" : "Top Posts"}
            metricLabel={isYoutube ? "views" : "reach"}
          />
        )}
      </div>

      {/* ===== BOTTOM ROW ===== */}
      <DashboardBottom
        trafficSources={trafficData}
        subscribersGrowth={growthData}
        overview={overviewData}
        insights={[]}
        channelId={channelId}
        loading={loading}
        overrideInsights={aiInsights}
      />
    </div>
  )
}
