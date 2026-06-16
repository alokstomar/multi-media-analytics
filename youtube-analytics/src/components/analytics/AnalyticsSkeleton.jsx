import { motion } from 'framer-motion'

/**
 * Full-page loading skeleton that matches the exact Analytics page layout.
 * Shown during the channel switch transition (600ms).
 */

function Pulse({ className = '' }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className}`} />
}

function StatCardSkeleton({ delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
      className="animate-pulse rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <Pulse className="h-3 w-20 mb-2" />
          <Pulse className="h-7 w-16" />
        </div>
        <Pulse className="h-10 w-10 rounded-xl" />
      </div>
      <div className="flex items-center gap-2">
        <Pulse className="h-8 w-20 rounded" />
        <Pulse className="h-4 w-12 rounded-full" />
      </div>
    </motion.div>
  )
}

function ChartBlockSkeleton({ height = 320, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="animate-pulse rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <Pulse className="h-5 w-36 mb-2" />
          <Pulse className="h-3 w-48" />
        </div>
        <Pulse className="h-8 w-24 rounded-lg" />
      </div>
      <Pulse className="h-7 w-20 rounded mb-4" />
      <div className="flex items-end gap-2" style={{ height }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-gray-100"
            style={{ height: `${35 + (i * 7) % 55}%` }}
          />
        ))}
      </div>
    </motion.div>
  )
}

function RetentionSkeleton({ delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="grid grid-cols-1 xl:grid-cols-5 gap-6"
    >
      {/* Chart */}
      <div className="xl:col-span-3 animate-pulse rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <Pulse className="h-5 w-40" />
          <Pulse className="h-6 w-16 rounded-full" />
        </div>
        <Pulse className="h-3 w-56 mb-5" />
        <div className="flex items-end gap-2 h-[260px]">
          {Array.from({ length: 14 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 rounded-t bg-gray-100"
              style={{ height: `${25 + (i * 6) % 65}%` }}
            />
          ))}
        </div>
      </div>

      {/* Insight cards */}
      <div className="xl:col-span-2 space-y-3">
        <Pulse className="h-5 w-24 mb-1" />
        <Pulse className="h-3 w-40 mb-3" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-xl border border-gray-100 p-4 bg-gray-50/50">
            <div className="flex items-start gap-3">
              <Pulse className="h-8 w-8 rounded-lg shrink-0" />
              <div className="flex-1">
                <Pulse className="h-3.5 w-3/4 mb-2" />
                <Pulse className="h-3 w-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

function TrafficGridSkeleton({ delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="grid grid-cols-1 lg:grid-cols-3 gap-6"
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <Pulse className="h-4 w-28 mb-2" />
          <Pulse className="h-3 w-36 mb-5" />
          <Pulse className="h-[160px] w-full rounded-lg" />
        </div>
      ))}
    </motion.div>
  )
}

function BottomGridSkeleton({ delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="grid grid-cols-1 xl:grid-cols-3 gap-6"
    >
      {/* Table skeleton */}
      <div className="xl:col-span-2 animate-pulse rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="p-6 pb-4">
          <Pulse className="h-5 w-36 mb-2" />
          <Pulse className="h-3 w-28" />
        </div>
        <div className="px-6 py-2 border-b border-gray-50">
          <Pulse className="h-3 w-full" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-6 py-3.5 border-b border-gray-50/50">
            <Pulse className="h-4 w-4" />
            <Pulse className="h-10 w-10 rounded-lg shrink-0" />
            <div className="flex-1">
              <Pulse className="h-3.5 w-3/4 mb-1" />
              <Pulse className="h-3 w-16 rounded-full" />
            </div>
            <Pulse className="h-4 w-12" />
            <Pulse className="h-4 w-16" />
          </div>
        ))}
      </div>

      {/* AI Panel skeleton */}
      <div className="animate-pulse rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <Pulse className="h-8 w-8 rounded-lg" />
          <div>
            <Pulse className="h-4 w-24 mb-1" />
            <Pulse className="h-3 w-40" />
          </div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-100 p-4 bg-gray-50/50">
              <div className="flex items-start gap-3">
                <Pulse className="h-9 w-9 rounded-lg shrink-0" />
                <div className="flex-1">
                  <Pulse className="h-3.5 w-3/4 mb-2" />
                  <Pulse className="h-3 w-full mb-2" />
                  <Pulse className="h-3 w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

export default function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} delay={i * 0.04} />
        ))}
      </div>

      {/* Performance chart */}
      <ChartBlockSkeleton delay={0.15} />

      {/* Retention + insights */}
      <RetentionSkeleton delay={0.2} />

      {/* Traffic grid */}
      <TrafficGridSkeleton delay={0.25} />

      {/* Engagement chart */}
      <ChartBlockSkeleton height={260} delay={0.3} />

      {/* Video table + AI panel */}
      <BottomGridSkeleton delay={0.35} />
    </div>
  )
}
