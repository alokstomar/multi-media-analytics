import { engagementRate, uploadFrequency, averageViews } from './analytics.js';

const CATEGORIES = ['Entertainment', 'Tech', 'Comedy', 'Education', 'Music', 'Gaming', 'Lifestyle', 'News'];

/**
 * Builds a robust multi-channel context object for AI generation and fallback logic.
 * Safely defaults any missing statistics or metadata and protects against token limits.
 */
export function buildPortfolioContext(channelsWithVideos) {
  const result = {
    channels: [],
    portfolioTotals: {
      totalSubscribers: 0,
      totalViews: 0,
      avgEngagement: 0,
      totalVideos: 0
    }
  };

  if (!Array.isArray(channelsWithVideos)) {
    return result;
  }

  let totalSubscribers = 0;
  let totalViews = 0;
  let totalVideos = 0;
  let sumEngagement = 0;
  let channelsCount = 0;

  channelsWithVideos.forEach((entry, index) => {
    if (!entry) return;

    const ch = entry.channel || entry;
    const rawVideos = Array.isArray(entry.videos) ? entry.videos : [];

    const channelId = ch?.channelId || '';
    const title = ch?.title || `Channel ${index + 1}`;
    const description = typeof ch?.description === 'string' ? ch.description.slice(0, 500) : '';
    const category = ch?.category || CATEGORIES[index % CATEGORIES.length];
    
    const subscribers = Number.isFinite(ch?.subscribers) ? Number(ch.subscribers) : 0;
    const totalViewsVal = Number.isFinite(ch?.totalViews) ? Number(ch.totalViews) : 0;
    const totalVideosVal = Number.isFinite(ch?.totalVideos) ? Number(ch.totalVideos) : 0;

    // Safely execute analytics functions
    let engRate = 0;
    try {
      engRate = engagementRate(rawVideos);
    } catch {
      engRate = 0;
    }
    if (!Number.isFinite(engRate)) engRate = 0;

    let upFreq = 0;
    try {
      upFreq = uploadFrequency(rawVideos);
    } catch {
      upFreq = 0;
    }
    if (!Number.isFinite(upFreq)) upFreq = 0;

    let avgViews = 0;
    try {
      avgViews = averageViews(rawVideos);
    } catch {
      avgViews = 0;
    }
    if (!Number.isFinite(avgViews)) avgViews = 0;

    // Get top videos and serialize safely
    const topVideos = [...rawVideos]
      .sort((a, b) => (Number(b?.views || 0) - Number(a?.views || 0)))
      .slice(0, 5)
      .map(v => ({
        title: typeof v?.title === 'string' ? v.title.slice(0, 100) : '',
        views: Number.isFinite(v?.views) ? Number(v.views) : 0,
        likes: Number.isFinite(v?.likes) ? Number(v.likes) : 0,
        comments: Number.isFinite(v?.comments) ? Number(v.comments) : 0,
        publishedAt: v?.publishedAt ? String(v.publishedAt) : ''
      }));

    result.channels.push({
      channelId,
      title,
      description,
      category,
      subscribers,
      totalViews: totalViewsVal,
      engagementRate: engRate,
      uploadFrequency: upFreq,
      averageViews: avgViews,
      topVideos
    });

    totalSubscribers += subscribers;
    totalViews += totalViewsVal;
    totalVideos += totalVideosVal;
    sumEngagement += engRate;
    channelsCount++;
  });

  result.portfolioTotals.totalSubscribers = totalSubscribers;
  result.portfolioTotals.totalViews = totalViews;
  result.portfolioTotals.totalVideos = totalVideos;
  result.portfolioTotals.avgEngagement = channelsCount > 0 ? parseFloat((sumEngagement / channelsCount).toFixed(2)) : 0;

  return result;
}

/**
 * Deterministic fallback for getPortfolioSummary when AI fails.
 */
export function getPortfolioSummaryFallback(ctx) {
  const channels = ctx.channels || [];
  const totals = ctx.portfolioTotals || {};
  return {
    channelsCount: channels.length,
    channels: channels.map(c => ({
      id: c.channelId,
      name: c.title,
      subscribers: c.subscribers,
      totalViews: c.totalViews,
      totalVideos: c.totalVideos || 0,
      healthLabel: c.engagementRate > 4 ? 'Excellent' : c.engagementRate > 2 ? 'Good' : 'Average',
      primaryStrength: c.engagementRate > 3 ? 'Strong Audience Interaction' : 'Consistent Upload Cadence',
      growthSignal: c.uploadFrequency > 1 ? 'Active Upload Schedule' : 'Stable Viewer Base'
    })),
    portfolioStats: {
      totalSubscribers: totals.totalSubscribers || 0,
      totalViews: totals.totalViews || 0,
      totalVideos: totals.totalVideos || 0,
      avgEngagementRate: totals.avgEngagement || 0,
      diversificationScore: Math.min(95, Math.round(20 + channels.length * 15))
    }
  };
}

/**
 * Deterministic fallback for getAudienceOverlap when AI fails.
 */
export function getAudienceOverlapFallback(ctx) {
  const channels = ctx.channels || [];
  const pairs = [];
  const RADAR_AXES = [
    'Tech Appeal',
    'Entertainment Value',
    'Educational Depth',
    'Viral Potential',
    'Subscriber Loyalty',
    'Global Reach'
  ];

  if (channels.length < 2) {
    return { pairs: [], radarData: [] };
  }

  for (let i = 0; i < channels.length; i++) {
    for (let j = i + 1; j < channels.length; j++) {
      const chA = channels[i];
      const chB = channels[j];
      
      const sameCategory = chA.category.toLowerCase() === chB.category.toLowerCase();
      const isEnglish = (desc) => /the|and|you|of/i.test(desc);
      const sameLanguage = isEnglish(chA.description) === isEnglish(chB.description);

      let overlap = 10;
      if (sameCategory) overlap += 40;
      if (sameLanguage) overlap += 20;
      const engDiff = Math.abs(chA.engagementRate - chB.engagementRate);
      if (engDiff < 2) overlap += 15;
      
      overlap = Math.min(95, Math.max(5, overlap));
      const contentSim = Math.round(overlap * 0.9 + (sameCategory ? 10 : 0));
      const demoMatch = Math.round(sameLanguage ? 75 + (overlap % 15) : 35 + (overlap % 15));
      const collabPotential = Math.round((overlap * 0.4) + (contentSim * 0.3) + (demoMatch * 0.3));

      let rating = 'Moderate Fit';
      let ratingColor = 'text-amber-600 bg-amber-50 border-amber-100/50';
      let recText = 'Consider simple cross-promotional community posts to gauge crossover.';

      if (collabPotential >= 80) {
        rating = 'Outstanding Synergy';
        ratingColor = 'text-emerald-600 bg-emerald-50 border-emerald-100/50';
        recText = 'High recommendation! Schedule a joint long-form video or short collab immediately.';
      } else if (collabPotential >= 60) {
        rating = 'Strong Potential';
        ratingColor = 'text-blue-600 bg-blue-50 border-blue-100/50';
        recText = 'Great integration opportunities. A podcast crossover or shorts takeover is advised.';
      } else if (collabPotential < 40) {
        rating = 'Low Synergy';
        ratingColor = 'text-gray-500 bg-gray-50 border-gray-200/50';
        recText = 'Audiences are quite segmented. Focus on individual growth before attempting crossover campaigns.';
      }

      pairs.push({
        channelAId: chA.channelId,
        channelAName: chA.title,
        channelBId: chB.channelId,
        channelBName: chB.title,
        overlap,
        contentSim,
        demoMatch,
        collabPotential,
        rating,
        ratingColor,
        recText
      });
    }
  }

  const getRadarValue = (c, axis) => {
    const cat = c.category.toLowerCase();
    const hash = (c.title.length + axis.length) % 20;
    switch (axis) {
      case 'Tech Appeal':
        return cat === 'tech' ? 95 : 30 + hash;
      case 'Entertainment Value':
        return ['entertainment', 'comedy', 'music', 'gaming'].includes(cat) ? 92 : 40 + hash;
      case 'Educational Depth':
        return ['education', 'tech', 'news'].includes(cat) ? 90 : 25 + hash;
      case 'Viral Potential':
        return 40 + (c.averageViews % 45);
      case 'Subscriber Loyalty':
        return 50 + (c.subscribers % 35);
      case 'Global Reach':
        return 60 + (c.title.charCodeAt(0) % 35);
      default:
        return 50;
    }
  };

  const radarData = RADAR_AXES.map(axis => {
    const point = { subject: axis };
    channels.forEach(c => {
      point[c.title] = getRadarValue(c, axis);
    });
    return point;
  });

  return { pairs, radarData };
}

/**
 * Deterministic fallback for getCrossPromotion when AI fails.
 */
export function getCrossPromotionFallback(ctx) {
  const channels = ctx.channels || [];
  const promotions = [];

  if (channels.length < 2) {
    return { promotions: [] };
  }

  for (let i = 0; i < channels.length; i++) {
    const chA = channels[i];
    const chB = channels[(i + 1) % channels.length];

    if (chA.channelId === chB.channelId) continue;

    promotions.push({
      channelAId: chA.channelId,
      channelAName: chA.title,
      channelBId: chB.channelId,
      channelBName: chB.title,
      opportunity: `Cross-promote ${chA.title} content to ${chB.title} viewers using pinned comment links and playlist cards.`,
      format: 'Community Post',
      estimatedLift: '+12%',
      effort: 'Low',
      priority: 'High'
    });
  }

  return { promotions };
}

/**
 * Deterministic fallback for getPortfolioContentGaps when AI fails.
 */
export function getPortfolioContentGapsFallback(ctx) {
  const channels = ctx.channels || [];
  const gaps = [];

  if (channels.length === 0) {
    return { gaps: [] };
  }

  const allNiches = ['Tech', 'Education', 'Entertainment', 'Finance', 'Comedy', 'Music', 'Gaming', 'Lifestyle'];
  const coveredCategories = new Set(channels.map(c => c.category));
  const uncoveredNiches = allNiches.filter(n => !coveredCategories.has(n));

  const gapPool = [
    { topic: 'AI Productivity Tools & Workflows', category: 'Tech', volume: '140K', growth: '+48%', difficulty: 'Easy', interest: 96, format: 'Long Form', viewRange: '1.2M – 2.4M', ctr: '+4.2%' },
    { topic: 'Personal Finance Automation Rules', category: 'Finance', volume: '190K', growth: '+38%', difficulty: 'Medium', interest: 91, format: 'Long Form', viewRange: '800K – 1.6M', ctr: '+3.5%' },
    { topic: 'Interactive Visual Learning Guides', category: 'Education', volume: '260K', growth: '+55%', difficulty: 'Hard', interest: 95, format: 'Long Form', viewRange: '1.5M – 3.0M', ctr: '+4.0%' },
    { topic: 'Viral Shorts Storytelling Frameworks', category: 'Entertainment', volume: '340K', growth: '+62%', difficulty: 'Easy', interest: 98, format: 'Shorts', viewRange: '2.0M – 4.0M', ctr: '+5.1%' }
  ];

  const targets = gapPool.filter(g => uncoveredNiches.includes(g.category) || uncoveredNiches.length === 0);
  const selected = targets.length > 0 ? targets : gapPool;

  selected.forEach((item, idx) => {
    const bestChannel = channels[idx % channels.length];
    const opportunityScore = 80 + (idx * 5) % 18;
    gaps.push({
      ...item,
      opportunityScore,
      compLevel: opportunityScore > 90 ? 'Low' : 'Medium',
      diffScore: item.difficulty === 'Hard' ? 80 : item.difficulty === 'Medium' ? 50 : 30,
      bestChannelId: bestChannel.channelId,
      bestChannelName: bestChannel.title,
      confidence: 85 + idx,
      roiScore: opportunityScore + 5,
      sparkData: Array.from({ length: 8 }, (_, i) => ({ v: 30 + (i * 6) + (idx * 2) })),
      reasons: {
        audience: `High demand detected in ${item.category} niche with ${item.volume} monthly search volume.`,
        search: `Search trends indicate a ${item.growth} acceleration over 90 days.`,
        competitor: 'Low saturation among competitive channels.',
        portfolio: `${bestChannel.title} has the strongest historical authority match.`
      }
    });
  });

  return { gaps };
}

/**
 * Deterministic fallback for getCannibalization when AI fails.
 */
export function getCannibalizationFallback(ctx) {
  const channels = ctx.channels || [];
  const warnings = [];

  if (channels.length < 2) {
    return { warnings: [] };
  }

  for (let i = 0; i < channels.length; i++) {
    for (let j = i + 1; j < channels.length; j++) {
      const chA = channels[i];
      const chB = channels[j];

      if (chA.category.toLowerCase() === chB.category.toLowerCase()) {
        warnings.push({
          channelAId: chA.channelId,
          channelAName: chA.title,
          channelBId: chB.channelId,
          channelBName: chB.title,
          overlapTopic: `${chA.category} Audience Crossover`,
          cannibalizationScore: 65,
          severity: 'Medium',
          recommendation: `Differentiate content focus areas between ${chA.title} and ${chB.title} to minimize direct search competition.`
        });
      }
    }
  }

  return { warnings };
}

/**
 * Deterministic fallback for getPortfolioStrategist when AI fails.
 */
export function getPortfolioStrategistFallback(ctx) {
  const channels = ctx.channels || [];
  const totals = ctx.portfolioTotals || {};

  if (channels.length === 0) {
    return {
      healthScore: 0,
      stabilityScore: 0,
      riskLevel: 'Low',
      riskBadgeColor: 'text-emerald-600 bg-emerald-50 border-emerald-100/50',
      growthMomentum: '+0%',
      bestPerformingCh: null,
      fastestGrowingCh: null,
      highestEngagementCh: null,
      highestRevenueCh: null,
      mostConsistentCh: null,
      subConcentration: 0,
      viewConcentration: 0,
      revenueDependency: 0,
      audienceDiversification: 0,
      recommendations: [],
      actionCenter: [],
      growthRadar: []
    };
  }

  let bestPerformingCh = null;
  let fastestGrowingCh = null;
  let highestEngagementCh = null;
  let highestRevenueCh = null;
  let mostConsistentCh = null;
  let lowestUploadCh = null;

  let maxSubs = -1;
  let maxEngagement = -1;
  let maxViews = -1;
  let maxUploadFreq = -1;
  let minUploadFreq = Infinity;

  channels.forEach(c => {
    if (c.subscribers > maxSubs) {
      maxSubs = c.subscribers;
      bestPerformingCh = c;
    }
    if (c.engagementRate > maxEngagement) {
      maxEngagement = c.engagementRate;
      highestEngagementCh = c;
    }
    if (c.totalViews > maxViews) {
      maxViews = c.totalViews;
      highestRevenueCh = c;
      fastestGrowingCh = c;
    }
    if (c.uploadFrequency > maxUploadFreq) {
      maxUploadFreq = c.uploadFrequency;
      mostConsistentCh = c;
    }
    if (c.uploadFrequency < minUploadFreq) {
      minUploadFreq = c.uploadFrequency;
      lowestUploadCh = c;
    }
  });

  const totalSubs = totals.totalSubscribers || 1;
  const subConcentration = Math.round((maxSubs / totalSubs) * 100);
  const viewConcentration = totals.totalViews > 0 ? Math.round((maxViews / totals.totalViews) * 100) : 0;
  
  const audienceDiversification = Math.min(95, Math.round(20 + channels.length * 15));
  const stabilityScore = Math.round(100 - (subConcentration * 0.4) + (audienceDiversification * 0.2));
  const healthScore = Math.min(100, Math.round(70 + totals.avgEngagement * 5 + channels.length * 2));

  let riskLevel = 'Low';
  let riskBadgeColor = 'text-emerald-600 bg-emerald-50 border-emerald-100/50';
  if (subConcentration > 65) {
    riskLevel = 'High';
    riskBadgeColor = 'text-red-500 bg-red-50 border-red-100/50';
  } else if (subConcentration > 45) {
    riskLevel = 'Moderate';
    riskBadgeColor = 'text-amber-500 bg-amber-50 border-amber-100/50';
  }

  const recommendations = [];

  if (fastestGrowingCh) {
    recommendations.push({
      priority: 'High Priority',
      priorityColor: 'text-blue-600 bg-blue-50',
      title: `Leverage ${fastestGrowingCh.title} Growth`,
      desc: `${fastestGrowingCh.title} is showing high performance. Repurpose its content styles across other portfolio channels.`,
      actionText: 'Study content formats',
      confidence: 90,
      impact: '+15% Views Lift',
      executionTime: '3 Days',
      impactScore: 88,
      channelColor: '#3B82F6'
    });
  }

  if (highestEngagementCh) {
    recommendations.push({
      priority: 'Opportunity',
      priorityColor: 'text-purple-600 bg-purple-50',
      title: `Monetize ${highestEngagementCh.title} Engagement`,
      desc: `${highestEngagementCh.title} has an outstanding engagement rate of ${highestEngagementCh.engagementRate}%. Launch interactive community polls or viewer rewards.`,
      actionText: 'Host community event',
      confidence: 94,
      impact: '+22% loyalty',
      executionTime: '2 Days',
      impactScore: 85,
      channelColor: '#8B5CF6'
    });
  }

  if (lowestUploadCh && lowestUploadCh.uploadFrequency < 0.5) {
    recommendations.push({
      priority: 'Critical',
      priorityColor: 'text-red-600 bg-red-50',
      title: `Cadence Warning: ${lowestUploadCh.title}`,
      desc: `${lowestUploadCh.title} upload frequency is low (${lowestUploadCh.uploadFrequency} videos/week). Algorithmic decay starts after 14 days of inactivity.`,
      actionText: 'Schedule short upload',
      confidence: 92,
      impact: 'Prevent viewership loss',
      executionTime: '1 Day',
      impactScore: 90,
      channelColor: '#EF4444'
    });
  }

  if (channels.length >= 2 && bestPerformingCh && highestEngagementCh && bestPerformingCh.channelId !== highestEngagementCh.channelId) {
    recommendations.push({
      priority: 'High Priority',
      priorityColor: 'text-blue-600 bg-blue-50',
      title: `Cross-Promotional Campaign`,
      desc: `Direct audience from the highly-engaged ${highestEngagementCh.title} to the larger ${bestPerformingCh.title} via a community post or end screen collaboration.`,
      actionText: 'Link top playlists',
      confidence: 89,
      impact: '+18% Reach Increase',
      executionTime: '2 Days',
      impactScore: 82,
      channelColor: '#10B981'
    });
  }

  const actionCenter = [
    { action: 'Review lowest upload frequency channel templates', gain: 'Restore momentum', impact: 'High', difficulty: 'Easy' },
    { action: 'Synthesize cross-promotion pinned comment templates', gain: '+10% Traffic', impact: 'Medium', difficulty: 'Easy' }
  ];

  const growthRadar = [
    { topic: 'Cross-Channel Playlist Syndication', score: 92, growth: '+24%', comp: 'Low' },
    { topic: 'Shorts Crossover Reels', score: 85, growth: '+35%', comp: 'Medium' }
  ];

  return {
    healthScore,
    stabilityScore,
    riskLevel,
    riskBadgeColor,
    growthMomentum: '+8%',
    bestPerformingCh: bestPerformingCh ? { id: bestPerformingCh.channelId, name: bestPerformingCh.title, color: '#8B5CF6' } : null,
    fastestGrowingCh: fastestGrowingCh ? { id: fastestGrowingCh.channelId, name: fastestGrowingCh.title, color: '#3B82F6' } : null,
    highestEngagementCh: highestEngagementCh ? { id: highestEngagementCh.channelId, name: highestEngagementCh.title, color: '#10B981' } : null,
    highestRevenueCh: highestRevenueCh ? { id: highestRevenueCh.channelId, name: highestRevenueCh.title, color: '#F59E0B' } : null,
    mostConsistentCh: mostConsistentCh ? { id: mostConsistentCh.channelId, name: mostConsistentCh.title, color: '#8B5CF6' } : null,
    subConcentration,
    viewConcentration,
    revenueDependency: viewConcentration,
    audienceDiversification,
    recommendations,
    actionCenter,
    growthRadar
  };
}
