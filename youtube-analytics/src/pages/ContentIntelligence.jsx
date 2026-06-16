import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePlatform } from '../hooks/usePlatform'
import { usePlatformAdapter } from '../platformAdapters'
import ChannelSelector from '../components/analytics/ChannelSelector'

// Import modular Content Intelligence components
import MetricsOverview from '../components/content-intelligence/MetricsOverview'
import VideoIdeasSection from '../components/content-intelligence/VideoIdeasSection'
import ShortsIdeasSection from '../components/content-intelligence/ShortsIdeasSection'
import ContentGapSection from '../components/content-intelligence/ContentGapSection'
import TitleAnalyzer from '../components/content-intelligence/TitleAnalyzer'
import ThumbnailAnalyzer from '../components/content-intelligence/ThumbnailAnalyzer'
import ScriptFeedbackSection from '../components/content-intelligence/ScriptFeedbackSection'
import PerformancePrediction from '../components/content-intelligence/PerformancePrediction'
import CompetitorOpportunities from '../components/content-intelligence/CompetitorOpportunities'
import AIStrategistPanel from '../components/content-intelligence/AIStrategistPanel'

export default function ContentIntelligence() {
  const { selectedPlatform } = usePlatform()
  const {
    activeAccountId: activeChannelId,
    loading: isTransitioning,
    analyticsData: channelData,
    activeAccount: activeChannel,
    refreshAccounts: refreshChannels
  } = usePlatformAdapter()

  // Refresh channels cache check on mount
  useEffect(() => {
    if (refreshChannels) refreshChannels()
  }, [refreshChannels])

  /* Loading skeleton placeholder */
  const Skel = () => (
    <div className="space-y-7 animate-pulse">
      <div className="grid grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-[20px] bg-white p-5 border border-gray-100 h-32" />
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3 rounded-[20px] bg-white p-6 border border-gray-100 h-96" />
        <div className="rounded-[20px] bg-white p-6 border border-gray-100 h-96" />
      </div>
    </div>
  )

  return (
    <div className="min-h-screen space-y-6">
      <ChannelSelector />

      {/* ── Page Header ─────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Content Intelligence</h1>
          <p className="mt-1 text-sm text-gray-500">
            AI-powered content strategy, title analysis, thumbnail review, and performance forecasting
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:from-blue-700 hover:to-blue-800 transition shadow-lg shadow-blue-500/20 cursor-pointer">
            Generate Ideas
          </button>
          <button className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-[12px] font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-700 shadow-sm transition-all duration-200 cursor-pointer">
            Refresh Analysis
          </button>
          <button className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-[12px] font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-700 shadow-sm transition-all duration-200 cursor-pointer">
            Export Report
          </button>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {isTransitioning ? (
          <motion.div key="skel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Skel />
          </motion.div>
        ) : (
          <motion.div
            key={activeChannelId}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="space-y-7"
          >
            {/* ── Metric Cards ─────────────────────────── */}
            <MetricsOverview channelData={channelData} />

            {/* ── Grid Layout ─────────────────────────── */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
              
              {/* Left Column: Assembling Sections */}
              <div className="xl:col-span-3 space-y-6">
                
                {/* 1. AI Content Idea Generator */}
                <VideoIdeasSection channelData={channelData} />

                {/* 2. Shorts Idea Engine */}
                <ShortsIdeasSection channelData={channelData} />

                {/* 3. Content Gap Analysis */}
                <ContentGapSection channelData={channelData} />

                {/* 4. Title Analyzer */}
                <TitleAnalyzer />

                {/* 5. Thumbnail Analyzer */}
                <ThumbnailAnalyzer />

                {/* 6. Script Feedback AI */}
                <ScriptFeedbackSection />

                {/* 7. Performance Prediction Dashboard */}
                <PerformancePrediction />

                {/* 8. Competitor Content Opportunities */}
                <CompetitorOpportunities channelData={channelData} />

              </div>

              {/* Right Column: AI Strategist Panel */}
              <div className="xl:col-span-1 sticky top-6">
                <AIStrategistPanel channelData={channelData} />
              </div>

            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
