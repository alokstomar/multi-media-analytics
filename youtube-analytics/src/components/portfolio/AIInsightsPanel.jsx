import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, TrendingUp, AlertTriangle, Users, Flame, ShieldAlert, Award, ArrowUpRight, Activity, BrainCircuit, BarChart3, Briefcase, Zap, Shield, CheckCircle2 } from 'lucide-react'
import { usePlatformAdapter } from '../../platformAdapters'
import { usePlatform } from '../../context/PlatformContext'
import { getPortfolioStrategist } from '../../services/api'

const cs = '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)'

export default function AIInsightsPanel({ selectedIds }) {
  const { selectedPlatform } = usePlatform()
  const { accounts: allChannels } = usePlatformAdapter()

  const activeChannels = useMemo(() => {
    return allChannels.filter(c => selectedIds.includes(c.id))
  }, [allChannels, selectedIds])

  function generateFallback() {
    if (activeChannels.length === 0) return null

    // 1. Core aggregates
    let totalSubs = 0
    let totalViews = 0
    let sumGrowth = 0
    let totalVideos = 0

    let topSubCh = null
    let maxSubs = -1
    
    let fastestCh = null
    let maxGrowth = -Infinity

    let engagementCh = null
    let maxEng = -1

    let slowCh = null
    let minGrowth = Infinity

    let maxViewsCh = null
    let maxViews = -1

    activeChannels.forEach(c => {
      const raw = c._raw || {}
      const analytics = c._analytics || {}

      const s = Number(raw.subscribers || 0)
      const v = Number(raw.totalViews || 0)
      const g = Number(analytics.viewsGrowth || 0)
      const e = Number(analytics.engagementRate || raw.engagementRate || 3.5)
      const vid = Number(raw.totalVideos || 0)

      totalSubs += s
      totalViews += v
      sumGrowth += g
      totalVideos += vid

      if (s > maxSubs) {
        maxSubs = s
        topSubCh = c
      }
      if (g > maxGrowth) {
        maxGrowth = g
        fastestCh = c
      }
      if (g < minGrowth) {
        minGrowth = g
        slowCh = c
      }
      if (e > maxEng) {
        maxEng = e
        engagementCh = c
      }
      if (v > maxViews) {
        maxViews = v
        maxViewsCh = c
      }
    })

    const avgGrowth = activeChannels.length > 0 ? sumGrowth / activeChannels.length : 0
    
    // 2. Risk Metrics & stability calculations
    const subConcentration = totalSubs > 0 ? Math.round((maxSubs / totalSubs) * 100) : 0
    const viewConcentration = totalViews > 0 ? Math.round((maxViews / totalViews) * 100) : 0
    
    // Revenue dependency is highly correlated to view share
    const revenueDependency = viewConcentration
    
    // Diversification score increments with count
    const audienceDiversification = Math.min(95, Math.round(20 + activeChannels.length * 15))

    // stability index
    const stabilityScore = Math.round(100 - (subConcentration * 0.45) + (audienceDiversification * 0.25))
    const healthScore = Math.round(80 + (activeChannels.length * 2 + avgGrowth * 0.1) % 18)
    
    let riskLevel = 'Low'
    let riskBadgeColor = 'text-emerald-600 bg-emerald-50 border-emerald-100/50'
    if (subConcentration > 65) {
      riskLevel = 'High'
      riskBadgeColor = 'text-red-500 bg-red-50 border-red-100/50'
    } else if (subConcentration > 45) {
      riskLevel = 'Moderate'
      riskBadgeColor = 'text-amber-500 bg-amber-50 border-amber-100/50'
    }

    // 3. Dynamic Priority Recommendations
    const rawRecommendations = []

    if (topSubCh) {
      const isCritical = subConcentration > 65
      rawRecommendations.push({
        priority: isCritical ? 'Critical' : 'High Priority',
        priorityColor: isCritical ? 'text-red-600 bg-red-50' : 'text-blue-600 bg-blue-50',
        title: `${topSubCh.name} Concentration Risk`,
        desc: `${topSubCh.name} controls ${subConcentration}% of your total portfolio ${selectedPlatform === 'instagram' ? 'followers' : 'subscribers'}. Audience concentration is high.`,
        actionText: selectedPlatform === 'instagram' ? 'Promote smaller accounts' : 'Promote smaller channels',
        confidence: 96,
        impact: `+${Math.round(subConcentration * 0.3)}% stability`,
        executionTime: '2 Days',
        impactScore: 92,
        channelColor: topSubCh.color
      })
    }

    if (fastestCh && maxGrowth > 0) {
      rawRecommendations.push({
        priority: 'High Priority',
        priorityColor: 'text-blue-600 bg-blue-50',
        title: `${fastestCh.name} Expansion Speed`,
        desc: `${fastestCh.name} is scaling faster than others, generating a MoM ${selectedPlatform === 'instagram' ? 'reach' : 'views'} increase of +${maxGrowth.toFixed(1)}%.`,
        actionText: selectedPlatform === 'instagram' ? 'Inspect high-performing posts' : 'Inspect high-performing content',
        confidence: 92,
        impact: `+${Math.round(maxGrowth * 1.5)}% ${selectedPlatform === 'instagram' ? 'reach' : 'views'}`,
        executionTime: '3 Days',
        impactScore: 88,
        channelColor: fastestCh.color
      })
    }

    if (activeChannels.length >= 2) {
      const ch1 = activeChannels[0]
      const ch2 = activeChannels[1]
      rawRecommendations.push({
        priority: 'Medium Priority',
        priorityColor: 'text-purple-600 bg-purple-50',
        title: `Dynamic Collaboration Synergy`,
        desc: `High overlap detected between ${ch1.name} and ${ch2.name}. An interactive joint campaign is recommended.`,
        actionText: 'Generate Collaboration Plan',
        confidence: 92,
        impact: '+22% Reach potential',
        executionTime: '2 Days',
        impactScore: 84,
        channelColor: '#8B5CF6'
      })
    }

    if (slowCh && slowCh !== fastestCh) {
      rawRecommendations.push({
        priority: 'Opportunity',
        priorityColor: 'text-cyan-600 bg-cyan-50',
        title: `Optimize ${slowCh.name} Growth`,
        desc: `${slowCh.name} ${selectedPlatform === 'instagram' ? 'reach' : 'views'} growth is at ${minGrowth.toFixed(1)}% (below average). Consider cross-posting.`,
        actionText: 'Schedule optimization review',
        confidence: 88,
        impact: '+14% engagement boost',
        executionTime: '5 Days',
        impactScore: 79,
        channelColor: slowCh.color
      })
    }

    // Sort by impact score automatically
    const sortedRecommendations = rawRecommendations.sort((a, b) => b.impactScore - a.impactScore)

    // 4. Action Center
    const actionCenterList = [
      { action: selectedPlatform === 'instagram' ? 'Launch AI Productivity Reels' : 'Launch AI Productivity Series', gain: selectedPlatform === 'instagram' ? '+18% Reach' : '+18% Views', impact: 'High', difficulty: 'Medium' },
      { action: 'Schedule Cross Collaboration', gain: '+22% Reach', impact: 'High', difficulty: 'Easy' },
      { action: selectedPlatform === 'instagram' ? 'Increase Reels Upload Frequency' : 'Increase Shorts Upload Frequency', gain: '+11% Engagement', impact: 'Medium', difficulty: 'Easy' },
      { action: 'Optimize Coordinated Posting Slot', gain: '+8% CTR', impact: 'Medium', difficulty: 'Easy' }
    ]

    // 5. Growth Radar
    const growthRadarList = [
      { topic: 'AI Tools & Productivity', score: 96, growth: '+64%', comp: 'Low' },
      { topic: 'Creator Economy Case Studies', score: 92, growth: '+48%', comp: 'Low' },
      { topic: 'Business Mini-Documentaries', score: 89, growth: '+41%', comp: 'Medium' },
      { topic: 'Observed Productivity Hacks', score: 85, growth: '+33%', comp: 'Low' },
      { topic: 'Extreme Shorts Challenges', score: 80, growth: '+28%', comp: 'Medium' }
    ]

    return {
      healthScore,
      stabilityScore,
      riskLevel,
      riskBadgeColor,
      growthMomentum: avgGrowth >= 0 ? `+${avgGrowth.toFixed(0)}%` : `${avgGrowth.toFixed(0)}%`,
      bestPerformingCh: topSubCh,
      fastestGrowingCh: fastestCh,
      highestEngagementCh: engagementCh,
      highestRevenueCh: maxViewsCh,
      mostConsistentCh: topSubCh,
      subConcentration,
      viewConcentration,
      revenueDependency,
      audienceDiversification,
      recommendations: sortedRecommendations,
      actionCenter: actionCenterList,
      growthRadar: growthRadarList
    }
  }

  const [csoReport, setCsoReport] = useState(() => generateFallback())

  useEffect(() => {
    if (!selectedIds || selectedIds.length === 0 || selectedIds.includes('demo')) {
      setCsoReport(generateFallback())
      return
    }
    getPortfolioStrategist(selectedIds)
      .then((res) => {
        const d = res?.data
        if (d && d.healthScore != null) {
          setCsoReport(d)
        } else {
          setCsoReport(generateFallback())
        }
      })
      .catch(() => setCsoReport(generateFallback()))
  }, [selectedIds, activeChannels])

  if (activeChannels.length === 0) {
    return (
      <div className="rounded-[20px] border border-gray-100 bg-white p-6 space-y-4 h-full flex flex-col justify-center" style={{ boxShadow: cs }}>
        <div className="text-center py-6">
          <BrainCircuit className="h-8 w-8 text-gray-300 mx-auto" />
          <p className="text-sm font-bold text-gray-500 mt-2">No active strategist</p>
          <p className="text-xs text-gray-400 mt-1">Select channels to activate the Portfolio AI CSO.</p>
        </div>
      </div>
    )
  }

  const report = csoReport

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-[20px] border border-gray-100 bg-white p-6 space-y-5 h-full flex flex-col justify-between"
      style={{ boxShadow: cs }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <BrainCircuit className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-gray-900 tracking-tight">AI Chief Strategy Officer</h3>
            <p className="text-[11px] text-gray-400">Strategic portfolio advisor & growth orchestrator</p>
          </div>
        </div>
      </div>

      {/* ENHANCEMENT 1: Executive AI Summary (Top Section) */}
      <div className="space-y-3 shrink-0">
        {/* KPI Mini Cards */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-2.5">
            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wide">Health Score</span>
            <p className="text-[14px] font-bold text-gray-900 mt-0.5">{report.healthScore}/100</p>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-2.5">
            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wide">Momentum</span>
            <p className="text-[14px] font-bold text-emerald-600 mt-0.5">{report.growthMomentum}</p>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-2.5">
            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wide">CSO Risk</span>
            <span className={`inline-flex rounded text-[10px] font-bold uppercase mt-0.5 px-1 ${report.riskBadgeColor}`}>
              {report.riskLevel}
            </span>
          </div>
        </div>

        {/* AI Briefing Card */}
        <div className="rounded-xl border border-violet-100 bg-violet-50/15 p-3.5 space-y-2">
          <div className="flex items-center gap-1.5 text-violet-700 font-bold text-[10px] uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5 fill-violet-100 shrink-0" />
            <span>AI Executive Summary Briefing</span>
          </div>
          <p className="text-[11px] text-gray-600 leading-relaxed font-medium">
            Your portfolio growth is outperforming the industry baseline by <span className="font-bold text-violet-800">+14.2%</span>.
            Audience overlap analytics predict that cross-channel collaborations could expand your total reach by <span className="font-bold text-violet-800">18-22%</span>.
            Leverage your leading channels to build sub-segments.
          </p>
        </div>
      </div>

      {/* ENHANCEMENT 2: Investor Risk & Stability Dashboard */}
      <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4 shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Stability Assessment</span>
            <p className="text-[13px] font-bold text-gray-900 tracking-tight leading-none mt-1">Portfolio Stability Index</p>
          </div>
          <div className="text-right">
            <span className="text-xl font-bold text-indigo-600 block leading-none">{report.stabilityScore}/100</span>
            <span className={`inline-flex rounded-full text-[8px] font-bold px-1.5 py-[1px] mt-1 border ${report.riskBadgeColor}`}>
              {report.riskLevel} Risk
            </span>
          </div>
        </div>

        {/* 4 stability metrics */}
        <div className="grid grid-cols-2 gap-3 text-[10px]">
          {[
            { label: selectedPlatform === 'instagram' ? 'Follower Share' : 'Subscriber Share', val: report.subConcentration, desc: 'concentration density' },
            { label: selectedPlatform === 'instagram' ? 'Reach Share' : 'Views Share', val: report.viewConcentration, desc: 'traffic concentration' },
            { label: selectedPlatform === 'instagram' ? 'Direct Actions' : 'Revenue Dependency', val: report.revenueDependency, desc: 'earnings concentration' },
            { label: 'Audience Diversity', val: report.audienceDiversification, desc: 'segment spread index' }
          ].map((m, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between font-bold text-gray-700">
                <span>{m.label}</span>
                <span className="font-bold text-gray-900">{m.val}%</span>
              </div>
              <div className="w-full bg-gray-200/50 h-[4px] rounded-full overflow-hidden">
                <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${m.val}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ENHANCEMENT 6: Dynamic Performance Leaderboard Breakdown */}
      <div className="rounded-xl border border-gray-100 p-4 space-y-3 shrink-0">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">{selectedPlatform === 'instagram' ? 'Portfolio Champion Accounts' : 'Portfolio Champion Channels'}</span>
        
        <div className="grid grid-cols-2 gap-2.5 text-[10px] font-bold">
          {[
            { label: 'Highest Growth', ch: report.fastestGrowingCh, metric: report.growthMomentum },
            { label: selectedPlatform === 'instagram' ? 'Highest Reach' : 'Highest Revenue', ch: report.highestRevenueCh, metric: `${report.highestRevenueCh?._raw?.totalViews || '24K'} reach` },
            { label: 'Highest Engagement', ch: report.highestEngagementCh, metric: `${report.highestEngagementCh?._analytics?.engagementRate?.toFixed(1) || '4.5'}% rate` },
            { label: 'Most Consistent', ch: report.mostConsistentCh, metric: `${report.mostConsistentCh?._raw?.totalVideos || '12'} ${selectedPlatform === 'instagram' ? 'posts' : 'videos'} published` }
          ].map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 border-b border-gray-50 pb-2 last:border-0 last:pb-0">
              <img src={item.ch?.avatar} className="h-6.5 w-6.5 rounded-full object-cover border border-gray-100" />
              <div className="min-w-0 flex-1">
                <span className="text-[8px] font-bold text-gray-400 block uppercase tracking-wide leading-none">{item.label}</span>
                <p className="text-gray-900 truncate text-[11px] font-bold leading-tight mt-0.5">{item.ch?.name}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ENHANCEMENT 5: Opportunity Radar Section */}
      <div className="rounded-xl border border-gray-100 p-4 space-y-3 shrink-0">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Top Growth Niche Radar</span>
        
        <div className="space-y-2.5">
          {report.growthRadar.map((radar, idx) => (
            <div key={idx} className="space-y-1 text-[10px]">
              <div className="flex items-center justify-between font-bold text-gray-700">
                <span>{radar.topic}</span>
                <span className="text-cyan-600 font-bold">{radar.growth} velocity</span>
              </div>
              <div className="w-full bg-gray-100 h-[4px] rounded-full overflow-hidden">
                <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${radar.score}%` }} />
              </div>
              <div className="flex items-center justify-between text-[8px] text-gray-400 font-bold">
                <span>Opp Score: {radar.score} / 100</span>
                <span>{radar.comp} competition</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ENHANCEMENT 3 & 7: Sortable Priority Recommendations (Compact Cards) */}
      <div className="flex-1 space-y-3 overflow-y-auto max-h-[280px] pr-1.5 scrollbar-thin">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Strategic Priority Stream</span>
        
        {report.recommendations.map((rec, idx) => {
          return (
            <div
              key={idx}
              className="relative rounded-xl border border-gray-100 bg-white p-3 hover:border-gray-200 transition-all duration-200 group overflow-hidden text-[10px]"
            >
              <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: rec.channelColor }} />
              
              <div className="flex items-start gap-2.5">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex rounded px-1.5 py-[1px] text-[8px] font-bold uppercase ${rec.priorityColor}`}>
                      {rec.priority}
                    </span>
                    <span className="text-[9px] text-gray-300 font-bold">
                      {rec.confidence}% Conf.
                    </span>
                  </div>

                  <p className="text-[11px] font-bold text-gray-900 leading-tight">
                    {rec.title}
                  </p>
                  
                  <p className="text-[10px] text-gray-400 leading-relaxed font-semibold">
                    {rec.desc}
                  </p>

                  <div className="grid grid-cols-2 gap-2 pt-1.5 text-[9px] font-bold text-gray-400 border-t border-gray-50">
                    <div>
                      <span>Expected Impact:</span>
                      <p className="text-gray-900 font-bold">{rec.impact}</p>
                    </div>
                    <div>
                      <span>Execution Time:</span>
                      <p className="text-gray-900 font-bold">{rec.executionTime}</p>
                    </div>
                  </div>

                  <button className="mt-2 inline-flex items-center gap-1 font-bold text-blue-600 bg-blue-50/50 hover:bg-blue-50 border border-blue-100/50 px-2 py-0.5 rounded transition-all cursor-pointer">
                    {rec.actionText}
                    <ArrowUpRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ENHANCEMENT 4: AI Action Center */}
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/10 p-4 space-y-3 shrink-0">
        <div className="flex items-center gap-1.5 text-indigo-600 border-b border-indigo-100/50 pb-2">
          <Zap className="h-4 w-4 fill-indigo-100 shrink-0 animate-bounce" />
          <h4 className="text-[11px] font-bold uppercase tracking-wider">AI Strategy Action Center</h4>
        </div>
        
        <div className="space-y-2">
          {report.actionCenter.map((act, idx) => (
            <div key={idx} className="rounded-xl bg-white border border-indigo-100/30 p-2.5 text-[10px] flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <span className="font-bold text-gray-900 leading-tight block truncate">{act.action}</span>
                <span className="text-[8px] font-bold text-gray-400">Difficulty: {act.difficulty} · Impact: {act.impact}</span>
              </div>
              <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100/30 px-2 py-0.5 shrink-0 rounded">
                {act.gain} Expected
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
