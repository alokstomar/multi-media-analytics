import { motion } from 'framer-motion'
import { Eye, ThumbsUp, Target, TrendingUp, Gauge, Lightbulb } from 'lucide-react'

function Metric({ icon: Icon, label, value, accent }) {
  if (value == null || value === '' || value === undefined) return null
  return (
    <div className="rounded-xl border border-gray-100 bg-white px-3.5 py-3 flex items-center gap-3">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${accent}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 truncate">{label}</p>
        <p className="text-[13.5px] font-bold text-gray-900 truncate mt-0.5">{value}</p>
      </div>
    </div>
  )
}

export default function IdeaSummary({ recommendation = {}, channel = {}, styleMatch = null }) {
  const title = recommendation.title || 'Production Script'
  const whyRecommend = recommendation.whyRecommend

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="relative overflow-hidden rounded-2xl border border-violet-100 bg-white"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 8px 24px -8px rgba(139, 92, 246, 0.12)' }}
    >
      {/* Decorative violet glow in upper-right corner */}
      <div
        className="absolute -top-20 -right-20 h-56 w-56 rounded-full opacity-[0.18] pointer-events-none"
        style={{ background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)' }}
      />

      <div className="relative p-6 lg:p-7">
        {/* Tag + channel badge */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {recommendation.tag && recommendation.badgeColor && (
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border ${recommendation.badgeColor}`}>
              {recommendation.tag}
            </span>
          )}
          {styleMatch?.overall != null && (
            <span className="inline-flex items-center rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-violet-700 border border-violet-100">
              Style Match {Math.round(styleMatch.overall)}%
            </span>
          )}
          {channel?.title && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-600 border border-gray-100">
              {channel.profileImage && (
                <img src={channel.profileImage} alt="" className="h-3 w-3 rounded-full object-cover" />
              )}
              {channel.title}
            </span>
          )}
        </div>

        {/* Title */}
        <h2 className="text-[22px] sm:text-[26px] font-bold text-gray-900 tracking-tight leading-tight max-w-4xl">
          {title}
        </h2>

        {/* Why recommended */}
        {whyRecommend && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-violet-50/60 border border-violet-100/50 p-3 max-w-3xl">
            <Lightbulb className="h-4 w-4 mt-0.5 text-violet-500 shrink-0" />
            <p className="text-[12.5px] text-gray-700 leading-relaxed font-medium">{whyRecommend}</p>
          </div>
        )}

        {/* Metrics grid */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Metric icon={Eye} label="Est. Views" value={recommendation.predictedViews} accent="bg-violet-50 text-violet-600" />
          <Metric icon={ThumbsUp} label="Est. Likes" value={recommendation.predictedEngagement?.split(' ')[0]} accent="bg-violet-50 text-violet-600" />
          <Metric icon={Target} label="Opportunity" value={recommendation.opportunity != null ? `${recommendation.opportunity}/100` : null} accent="bg-violet-50 text-violet-600" />
          <Metric icon={TrendingUp} label="Trend Index" value={recommendation.trendScore != null ? `${recommendation.trendScore}/100` : null} accent="bg-emerald-50 text-emerald-600" />
          <Metric icon={Gauge} label="Difficulty" value={recommendation.difficulty != null ? `${recommendation.difficulty}/100` : null} accent="bg-amber-50 text-amber-600" />
        </div>
      </div>
    </motion.section>
  )
}
