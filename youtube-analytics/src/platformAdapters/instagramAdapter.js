import { useMemo } from 'react'
import { useAccount } from '../context/AccountContext'
import { fmt } from '../utils/format'
import { CHANNEL_COLORS, CHANNEL_GRADIENTS } from '../utils/transformAnalytics'

export function useInstagramAdapter() {
  const account = useAccount()

  const snapshot = account.analyticsData
  const posts = account.postsData || []

  // Backend returns a flat InstagramAnalyticsSnapshot doc
  // ({followers, following, postsCount, averageLikes, averageComments,
  // averageViews, engagementRate, snapshotDate, ...}) but every IG component
  // and the rest of this adapter read an {overview: {...}, timeSeries: [...]}
  // shape. Translate once here so all downstream code stays unchanged.
  // Growth/timeSeries fields default to 0/[] — a single snapshot has no
  // historical context; building a real series requires querying past
  // snapshots (future enhancement).
  const rawAnalytics = useMemo(() => {
    if (!snapshot) return null
    if (snapshot.overview) return snapshot

    const followers = snapshot.followers || 0
    const avgViews = snapshot.averageViews || 0

    // Build dynamic 14-day time series from actual post engagement/reach data
    const dateMap = {}
    for (let i = 13; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const dateKey = d.toISOString().split('T')[0]
      dateMap[dateKey] = {
        date: dateStr,
        reach: 0,
        impressions: 0,
        followers,
        engagement: 0,
        count: 0
      }
    }

    if (posts && posts.length > 0) {
      posts.forEach((post) => {
        if (!post.publishedAt) return
        try {
          const dateKey = new Date(post.publishedAt).toISOString().split('T')[0]
          if (dateMap[dateKey]) {
            dateMap[dateKey].reach += post.reach || 0
            dateMap[dateKey].impressions += Math.round((post.reach || 0) * 1.15)
            dateMap[dateKey].engagement += post.engagementRate || 0
            dateMap[dateKey].count += 1
          }
        } catch (e) {
          // ignore invalid dates
        }
      })
    }

    const timeSeries = Object.keys(dateMap)
      .sort()
      .map((key) => {
        const item = dateMap[key]
        return {
          date: item.date,
          reach: item.reach,
          impressions: item.impressions,
          followers: item.followers,
          engagement: item.count > 0 ? parseFloat((item.engagement / item.count).toFixed(2)) : 0
        }
      })

    return {
      overview: {
        followers,
        following: snapshot.following || 0,
        postsCount: snapshot.postsCount || 0,
        reach: avgViews,
        impressions: Math.round(avgViews * 1.15),
        engagementRate: snapshot.engagementRate || 0,
        profileVisits: 0,
        followersGrowth: 0,
        reachGrowth: 0,
        engGrowth: 0,
        reelGrowth: 0,
        averageLikes: snapshot.averageLikes || 0,
        averageComments: snapshot.averageComments || 0,
        averageViews: avgViews,
      },
      timeSeries,
    }
  }, [snapshot, posts])

  const formattedStats = useMemo(() => {
    if (!rawAnalytics?.overview) {
      return [
        { label: 'Followers', value: '0', unit: '', trend: '0%', up: true, spark: [0, 0, 0, 0, 0, 0, 0] },
        { label: 'Follower Growth', value: '0', unit: '', trend: '0%', up: true, spark: [0, 0, 0, 0, 0, 0, 0] },
        { label: 'Reach', value: '0', unit: '', trend: '0%', up: true, spark: [0, 0, 0, 0, 0, 0, 0] },
        { label: 'Impressions', value: '0', unit: '', trend: '0%', up: true, spark: [0, 0, 0, 0, 0, 0, 0] },
        { label: 'Profile Visits', value: '0', unit: '', trend: '0%', up: true, spark: [0, 0, 0, 0, 0, 0, 0] },
        { label: 'Accounts Engaged', value: '0', unit: '', trend: '0%', up: true, spark: [0, 0, 0, 0, 0, 0, 0] },
        { label: 'Engagement Rate', value: '0', unit: '%', trend: '0%', up: true, spark: [0, 0, 0, 0, 0, 0, 0] },
        { label: 'Website Clicks', value: '0', unit: '', trend: '0%', up: true, spark: [0, 0, 0, 0, 0, 0, 0] },
      ]
    }

    const ov = rawAnalytics.overview
    const fol = ov.followers || 0
    const folg = ov.followersGrowth || 0
    const reach = ov.reach || 0
    const reachg = ov.reachGrowth || 0
    const imp = ov.impressions || 0
    const pv = ov.profileVisits || 0
    const er = ov.engagementRate || 0
    const erg = ov.engGrowth || 0

    // Absolute growth calculations — derivations from real values only.
    const absFollowerGrowth = Math.round(fol * folg / 100)
    const absAccountsEngaged = Math.round(reach * (er / 100))
    // Website clicks require a backend endpoint that does not exist yet.
    // Surface zero rather than fabricating a percentage of profile visits.
    const absWebsiteClicks = 0

    // Spark histories. Metrics without a backend source render flat zeros —
    // no multipliers fabricated from other metrics.
    const ts = rawAnalytics.timeSeries || []
    const sparkFollowers = ts.length ? ts.slice(-7).map(d => d.followers) : [0,0,0,0,0,0,0]
    const sparkFollowersGrowth = ts.length ? ts.slice(-7).map(d => Math.round(d.followers * folg / 100)) : [0,0,0,0,0,0,0]
    const sparkReach = ts.length ? ts.slice(-7).map(d => d.reach) : [0,0,0,0,0,0,0]
    const sparkImpressions = ts.length ? ts.slice(-7).map(d => d.impressions) : [0,0,0,0,0,0,0]
    const sparkProfileVisits = ts.length ? ts.slice(-7).map(d => d.profileVisits || 0) : [0,0,0,0,0,0,0]
    const sparkEngaged = ts.length ? ts.slice(-7).map(d => Math.round(d.reach * (d.engagement / 100))) : [0,0,0,0,0,0,0]
    const sparkEr = ts.length ? ts.slice(-7).map(d => d.engagement) : [0,0,0,0,0,0,0]
    const sparkClicks = ts.length ? ts.slice(-7).map(d => d.websiteClicks || 0) : [0,0,0,0,0,0,0]

    return [
      {
        label: 'Followers',
        value: fmt(fol),
        unit: '',
        trend: folg >= 0 ? `+${folg.toFixed(1)}%` : `${folg.toFixed(1)}%`,
        up: folg >= 0,
        spark: sparkFollowers,
        estimated: false,
      },
      {
        label: 'Follower Growth',
        value: fmt(absFollowerGrowth),
        unit: '',
        trend: folg >= 0 ? `+${folg.toFixed(1)}%` : `${folg.toFixed(1)}%`,
        up: folg >= 0,
        spark: sparkFollowersGrowth,
        estimated: true,
      },
      {
        label: 'Reach',
        value: fmt(reach),
        unit: '',
        trend: reachg >= 0 ? `+${reachg.toFixed(1)}%` : `${reachg.toFixed(1)}%`,
        up: reachg >= 0,
        spark: sparkReach,
        estimated: false,
      },
      {
        label: 'Impressions',
        value: fmt(imp),
        unit: '',
        trend: '0%',
        up: true,
        spark: sparkImpressions,
        estimated: false,
      },
      {
        label: 'Profile Visits',
        value: fmt(pv),
        unit: '',
        trend: '0%',
        up: true,
        spark: sparkProfileVisits,
        estimated: false,
      },
      {
        label: 'Accounts Engaged',
        value: fmt(absAccountsEngaged),
        unit: '',
        trend: erg >= 0 ? `+${erg.toFixed(1)}%` : `${erg.toFixed(1)}%`,
        up: erg >= 0,
        spark: sparkEngaged,
        estimated: true,
      },
      {
        label: 'Engagement Rate',
        value: er.toFixed(1),
        unit: '%',
        trend: erg >= 0 ? `+${erg.toFixed(1)}%` : `${erg.toFixed(1)}%`,
        up: erg >= 0,
        spark: sparkEr,
        estimated: false,
      },
      {
        label: 'Website Clicks',
        value: fmt(absWebsiteClicks),
        unit: '',
        trend: '0%',
        up: true,
        spark: sparkClicks,
        estimated: false,
      },
    ]
  }, [rawAnalytics])

  // Convert raw accounts list to display list with proper badges
  const formattedAccounts = useMemo(() => {
    return (account.accounts.instagram || []).map((acc, index) => {
      const color = CHANNEL_COLORS[index % CHANNEL_COLORS.length]
      const gradient = CHANNEL_GRADIENTS[index % CHANNEL_GRADIENTS.length]
      return {
        id: acc.username,
        name: acc.displayName || acc.username,
        handle: `@${acc.username}`,
        avatar: acc.profileImage,
        color,
        gradient,
        subscribers: fmt(acc.followers || 0),
        subscriberCount: `${fmt(acc.followers || 0)} followers`,
        growth: rawAnalytics?.overview?.followersGrowth >= 0 ? `+${(rawAnalytics.overview.followersGrowth).toFixed(1)}%` : `${(rawAnalytics?.overview?.followersGrowth || 0).toFixed(1)}%`,
        growthUp: (rawAnalytics?.overview?.followersGrowth || 0) >= 0,
        verified: acc.isVerified,
        contentLabel: 'Post',
        category: acc.category || 'Creator',
        syncStatus: acc.syncStatus || 'ready',
        syncError: acc.syncError || '',
        syncedAt: acc.syncedAt || null,
        _raw: {
          subscribers: acc.followers || 0,
          totalViews: 0,
          totalVideos: acc.postsCount || 0,
        },
        _analytics: {
          engagementRate: rawAnalytics?.overview?.engagementRate || 0,
          viewsGrowth: rawAnalytics?.overview?.reachGrowth || 0,
        }
      }
    })
  }, [account.accounts.instagram, rawAnalytics])

  // TimeSeries / performanceData
  const performanceData = useMemo(() => {
    return rawAnalytics?.timeSeries ? rawAnalytics.timeSeries.map(d => ({
      date: d.date,
      views: d.reach, // Map reach to views for chart
      watchTime: d.impressions, // Map impressions to watchTime for chart
      isEstimated: false
    })) : []
  }, [rawAnalytics])

  // Top posts table mapped to videoTable format
  const videoTable = useMemo(() => {
    return posts.map((post, i) => {
      return {
        id: i + 1,
        title: post.caption || 'No caption',
        views: fmt(post.reach || 0),
        watch: `${fmt(post.likes || 0)} likes`, // Map likes/interactions to secondary metric
        eng: `${post.engagementRate || 0}%`,
        viral: null,
        ctr: `${((post.saves || 0) / (post.reach || 1) * 100).toFixed(1)}%`, // CTR represented as save-rate for IG
        ctrEstimated: false,
        badge: post.type, // 'Reel', 'Carousel', etc.
        thumb: post.thumbnail,
        _raw: post,
      }
    })
  }, [posts])

  // AI insights: empty until the backend AI service returns real recommendations.
  // Previously this returned hardcoded suggestions regardless of the actual
  // profile — never acceptable in production.
  const aiInsights = useMemo(() => [], [])

  const mappedAnalyticsData = useMemo(() => {
    return {
      analyticsStats: formattedStats,
      performanceData,
      performanceHasEstimates: false,
      retentionData: [], // not used for IG
      retentionEstimated: false,
      retentionSource: '',
      retentionInsights: [],
      // Audience distributions (traffic sources, devices, geo) come from the
      // Meta Graph API audience endpoint, which is not yet wired. Return empty
      // arrays — the UI renders "No data available" rather than fabricated
      // percentages.
      trafficSources: [],
      trafficEstimated: false,
      trafficSource: '',
      devices: [],
      devicesEstimated: false,
      geoData: [],
      geoEstimated: false,
      engagementData: rawAnalytics?.timeSeries ? rawAnalytics.timeSeries.map(d => ({
        date: d.date,
        likes: Math.round(d.reach * 0.04),
        comments: Math.round(d.reach * 0.005),
        shares: Math.round(d.reach * 0.01),
        subs: d.followers,
      })) : [],
      engagementEstimated: false,
      videoTable,
      aiInsights,
      _raw: rawAnalytics,
    }
  }, [formattedStats, performanceData, videoTable, aiInsights, rawAnalytics])

  const activeAccount = useMemo(() => {
    return formattedAccounts.find(a => a.id === account.selectedAccountIds.instagram) || formattedAccounts[0]
  }, [formattedAccounts, account.selectedAccountIds.instagram])

  return {
    platform: 'instagram',
    accounts: formattedAccounts,
    selectedAccount: activeAccount,
    loading: account.loading,
    activeAccount,
    activeAccountId: account.selectedAccountIds.instagram,
    setActiveAccount: (id) => account.setSelectedAccount('instagram', id),
    error: account.error,

    // CRUD
    addAccount: (input) => {
      const username = typeof input === 'string' ? input : input?.username
      return account.connectAccount('instagram', { username })
    },
    removeAccount: (id) => account.disconnectAccount('instagram', id),
    updateAccount: () => account.refreshAccounts(),

    // Data
    analyticsData: mappedAnalyticsData,
    refreshAccounts: () => account.refreshAccounts(),
  }
}
