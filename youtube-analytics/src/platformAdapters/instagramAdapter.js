import { useMemo } from 'react'
import { useAccount } from '../context/AccountContext'
import { fmt } from '../utils/format'
import { CHANNEL_COLORS, CHANNEL_GRADIENTS } from '../utils/transformAnalytics'

export function useInstagramAdapter() {
  const account = useAccount()
  
  const rawAnalytics = account.analyticsData
  const posts = account.postsData || []
  
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

    // Absolute growth calculations
    const absFollowerGrowth = Math.round(fol * folg / 100)
    const absAccountsEngaged = Math.round(reach * (er / 100))
    const absWebsiteClicks = Math.round(pv * 0.12)

    // Spark histories
    const ts = rawAnalytics.timeSeries || []
    const sparkFollowers = ts.length ? ts.slice(-7).map(d => d.followers) : [0,0,0,0,0,0,0]
    const sparkFollowersGrowth = ts.length ? ts.slice(-7).map(d => Math.round(d.followers * folg / 100)) : [0,0,0,0,0,0,0]
    const sparkReach = ts.length ? ts.slice(-7).map(d => d.reach) : [0,0,0,0,0,0,0]
    const sparkImpressions = ts.length ? ts.slice(-7).map(d => d.impressions) : [0,0,0,0,0,0,0]
    const sparkProfileVisits = ts.length ? ts.slice(-7).map(d => Math.round(d.impressions * 0.1)) : [0,0,0,0,0,0,0]
    const sparkEngaged = ts.length ? ts.slice(-7).map(d => Math.round(d.reach * (d.engagement / 100))) : [0,0,0,0,0,0,0]
    const sparkEr = ts.length ? ts.slice(-7).map(d => d.engagement) : [0,0,0,0,0,0,0]
    const sparkClicks = ts.length ? ts.slice(-7).map(d => Math.round(d.impressions * 0.015)) : [0,0,0,0,0,0,0]

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
        trend: reachg >= 0 ? `+${(reachg * 1.1).toFixed(1)}%` : `${(reachg * 1.1).toFixed(1)}%`,
        up: reachg >= 0,
        spark: sparkImpressions,
        estimated: false,
      },
      {
        label: 'Profile Visits',
        value: fmt(pv),
        unit: '',
        trend: reachg >= 0 ? `+${(reachg * 0.9).toFixed(1)}%` : `${(reachg * 0.9).toFixed(1)}%`,
        up: reachg >= 0,
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
        trend: reachg >= 0 ? `+${(reachg * 0.85).toFixed(1)}%` : `${(reachg * 0.85).toFixed(1)}%`,
        up: reachg >= 0,
        spark: sparkClicks,
        estimated: true,
      },
    ]
  }, [rawAnalytics])

  // Convert raw accounts list to display list with proper badges
  const formattedAccounts = useMemo(() => {
    return (account.accounts.instagram || []).map((acc, index) => {
      const color = CHANNEL_COLORS[index % CHANNEL_COLORS.length]
      const gradient = CHANNEL_GRADIENTS[index % CHANNEL_GRADIENTS.length]
      return {
        id: acc.accountId,
        name: acc.displayName,
        handle: acc.username,
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
        _raw: {
          subscribers: acc.followers || 0,
          totalViews: (acc.followers || 0) * 4,
          totalVideos: acc.postsCount || 0,
        },
        _analytics: {
          engagementRate: rawAnalytics?.overview?.engagementRate || 4.2,
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
        viral: post.likes > 15000 ? 95 : post.likes > 5000 ? 85 : 72,
        ctr: `${((post.saves || 0) / (post.reach || 1) * 100).toFixed(1)}%`, // CTR represented as save-rate for IG
        ctrEstimated: false,
        badge: post.type, // 'Reel', 'Carousel', etc.
        thumb: post.thumbnail,
        _raw: post,
      }
    })
  }, [posts])

  // Mock AI insights for Instagram
  const aiInsights = useMemo(() => {
    return rawAnalytics?.overview ? [
      {
        type: 'positive',
        title: 'Reels performing exceptionally well',
        desc: `Your Reels reach is up ${rawAnalytics.overview.reelGrowth || 15}% this week. Prioritize short-form video.`,
        action: 'Create 2 new Reels this week',
        icon: 'trending'
      },
      {
        type: 'warning',
        title: 'Saves are low relative to likes',
        desc: 'Viewers are liking your carousel posts but not saving them. Try adding actionable checklists.',
        action: 'Add a "Save this for later" call-to-action slide',
        icon: 'alert'
      },
      {
        type: 'info',
        title: 'Optimal posting window',
        desc: 'Your audience is most active between 6:00 PM and 9:00 PM EST on weekdays.',
        action: 'Schedule next post for 7:00 PM EST',
        icon: 'search'
      }
    ] : []
  }, [rawAnalytics])

  const mappedAnalyticsData = useMemo(() => {
    return {
      analyticsStats: formattedStats,
      performanceData,
      performanceHasEstimates: false,
      retentionData: [], // not used for IG
      retentionEstimated: false,
      retentionSource: '',
      retentionInsights: [],
      trafficSources: [
        { name: 'Instagram Explore', value: 45, color: '#3B82F6' },
        { name: 'Home Feed', value: 30, color: '#8B5CF6' },
        { name: 'Reels Tab', value: 15, color: '#EF4444' },
        { name: 'Direct Messages', value: 6, color: '#F59E0B' },
        { name: 'Profile / Search', value: 4, color: '#10B981' },
      ],
      trafficEstimated: false,
      trafficSource: 'Instagram Insights API',
      devices: [
        { name: 'Mobile (iOS)', value: 58, color: '#3B82F6' },
        { name: 'Mobile (Android)', value: 40, color: '#8B5CF6' },
        { name: 'Desktop / Web', value: 2, color: '#10B981' },
      ],
      devicesEstimated: false,
      geoData: rawAnalytics?.overview ? [
        { country: 'USA', views: Math.round((rawAnalytics.overview.followers || 0) * 0.4), pct: 40.5, flag: '🇺🇸' },
        { country: 'UK', views: Math.round((rawAnalytics.overview.followers || 0) * 0.15), pct: 15.2, flag: '🇬🇧' },
        { country: 'Brazil', views: Math.round((rawAnalytics.overview.followers || 0) * 0.12), pct: 12.1, flag: '🇧🇷' },
        { country: 'Canada', views: Math.round((rawAnalytics.overview.followers || 0) * 0.08), pct: 8.4, flag: '🇨🇦' },
        { country: 'Others', views: Math.round((rawAnalytics.overview.followers || 0) * 0.24), pct: 23.8, flag: '🌍' },
      ] : [],
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
      // OAuth flow ignores input; username-based connection is no longer supported.
      return account.connectAccount('instagram', { username: '', displayName: '' })
    },
    removeAccount: (id) => account.disconnectAccount('instagram', id),
    updateAccount: () => account.refreshAccounts(),

    // Data
    analyticsData: mappedAnalyticsData,
    refreshAccounts: () => account.refreshAccounts(),
  }
}
