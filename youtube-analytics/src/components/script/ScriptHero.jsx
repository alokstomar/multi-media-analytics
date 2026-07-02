import { motion } from 'framer-motion'
import { Clock, Users, Target, TrendingUp, Gauge, Eye, ThumbsUp, Sparkles } from 'lucide-react'

// Hero metrics strip. Pulls from both the AI response (estimatedDuration,
// targetAudience, heroTitle, overview) and the source recommendation
// (opportunity, trendScore, difficulty, predictedViews, predictedEngagement).
// Falls back gracefully when AI omits a top-level key.
function Metric({ icon: Icon, label, value, accent }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm px-3.5 py-3 flex items-center gap-3">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${accent}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-300 truncate">{label}</p>
        <p className="text-[13.5px] font-bold text-white truncate mt-0.5">{value || '—'}</p>
      </div>
    </div>
  )
}

export default function ScriptHero({ script = {}, recommendation = {} }) {
  const title = script.heroTitle || recommendation.title || 'Production Script'
  const metrics = [
    { icon: Clock, label: 'Est. Duration', value: script.estimatedDuration, accent: 'bg-white/10 text-white' },
    { icon: Users, label: 'Audience', value: script.targetAudience, accent: 'bg-white/10 text-white' },
    { icon: Target, label: 'Opportunity', value: recommendation.opportunity != null ? `${recommendation.opportunity}/100` : null, accent: 'bg-violet-500/30 text-violet-200' },
    { icon: TrendingUp, label: 'Trend Index', value: recommendation.trendScore != null ? `${recommendation.trendScore}/100` : null, accent: 'bg-emerald-500/30 text-emerald-200' },
    { icon: Gauge, label: 'Difficulty', value: recommendation.difficulty != null ? `${recommendation.difficulty}/100` : null, accent: 'bg-amber-500/30 text-amber-200' },
    { icon: Eye, label: 'Est. Views', value: recommendation.predictedViews, accent: 'bg-white/10 text-white' },
    { icon: ThumbsUp, label: 'Est. Likes', value: recommendation.predictedEngagement?.split(' ')[0], accent: 'bg-white/10 text-white' },
    { icon: Sparkles, label: 'Sections', value: Array.isArray(script.timeline) ? `${script.timeline.length} sections` : null, accent: 'bg-white/10 text-white' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-[24px] border border-violet-900/30"
      style={{
        background:
          'linear-gradient(135deg, #1a1530 0%, #2d1b69 40%, #4c1d95 75%, #6d28d9 100%)',
      }}
    >
      {/* Decorative glow */}
      <div
        className="absolute -top-24 -right-24 h-64 w-64 rounded-full opacity-40 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(196,181,253,0.45), transparent 70%)' }}
      />
      <div
        className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full opacity-25 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.55), transparent 70%)' }}
      />

      <div className="relative p-7 lg:p-9">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-violet-200 backdrop-blur-sm">
            <Sparkles className="h-3 w-3" />
            Production-Ready Script
          </span>
          {recommendation.tag && (
            <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-violet-100 backdrop-blur-sm">
              {recommendation.tag}
            </span>
          )}
        </div>

        <h1 className="text-[26px] sm:text-[30px] lg:text-[34px] font-bold text-white tracking-tight leading-tight max-w-4xl">
          {title}
        </h1>

        {script.overview && (
          <p className="mt-4 text-[14px] text-violet-100/80 leading-relaxed max-w-3xl">
            {script.overview}
          </p>
        )}

        <div className="mt-7 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {metrics.map((m) => (
            <Metric key={m.label} {...m} />
          ))}
        </div>
      </div>
    </motion.div>
  )
}
